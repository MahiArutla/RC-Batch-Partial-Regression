import sql from 'mssql';
import { loadEnv } from '../config/env';
import { FileDetails } from '../models/fileDetails';

const env = loadEnv();

type BatchType = 'NF' | 'Return';

interface ProcessStatusFileStatusResponse {
  processStatusId: number;
  fileStatusId: number;
}

interface ProcessStatusIdResponse {
  processStatusId: number[];
  registrationId: number[];
}

export class DbService {
  private poolPromise: Promise<sql.ConnectionPool>;

  constructor() {
    if (!env.dbConnectionString) {
      throw new Error('DB_CONNECTION_STRING is not configured.');
    }
    this.poolPromise = sql.connect(env.dbConnectionString);
  }
  private async waitFor<T>(
    fetch: () => Promise<T>,
    predicate: (value: T) => boolean,
    options: { timeoutMs?: number; intervalMs?: number } = {}
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const intervalMs = options.intervalMs ?? 2_000;
    const start = Date.now();
    let last: T;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      last = await fetch();
      if (predicate(last)) return last;
      if (Date.now() - start > timeoutMs) return last;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    return this.poolPromise;
  }

  async enableClient(client: string): Promise<void> {
    const pool = await this.getPool();
    await pool
      .request()
      .input('client', sql.VarChar(50), client)
      .query(
        'UPDATE ClientInfo SET IsEnabled = CASE WHEN CorporationCode = @client THEN 1 ELSE 0 END'
      );
  }

  async getUniqueBatchFileId(fileDetails: FileDetails, type: BatchType): Promise<string> {
    const pool = await this.getPool();
    const description =
      type === 'Return' ? fileDetails.returnFileDescription : fileDetails.inputFileDescription;
    if (!description) {
      throw new Error(`Missing description for ${type} file.`);
    }
    const query =
      'SELECT TOP 1 UniqueId FROM ClientFileScheduleInfo ' +
      'WHERE ClientFileInfoId IN (' +
      'SELECT Id FROM ClientFileInfo WHERE ClientInfoId = (SELECT Id FROM ClientInfo WHERE CorporationCode = @client) ' +
      'AND Description = @description) AND IsEnabled = 1';
    const result = await pool
      .request()
      .input('client', sql.VarChar(50), fileDetails.client)
      .input('description', sql.VarChar(200), description)
      .query(query);
    const uniqueId: string | undefined = result.recordset[0]?.UniqueId;
    if (!uniqueId) {
      throw new Error(`UniqueId not found for ${fileDetails.scenarioId} (${type}).`);
    }
    return uniqueId;
  }

  async updateProcessAndFileStatusToNotStarted(uniqueId: string): Promise<void> {
    const pool = await this.getPool();
    await pool
      .request()
      .input('uniqueId', sql.VarChar(50), uniqueId)
      .query(
        'UPDATE ClientFileScheduleProcessStatus SET ProcessStatusId = 0, FileStatusId = 0 ' +
          'WHERE ClientFileScheduleInfoId IN (SELECT Id FROM ClientFileScheduleInfo WHERE UniqueId = @uniqueId)'
      );
  }

  async validateClientFileSchedulerJobStatus(fileDetails: FileDetails): Promise<void> {
    const pool = await this.getPool();
    if (!fileDetails.uniqueId) {
      throw new Error('fileDetails.uniqueId is required before validating scheduler status.');
    }
    const result = await pool
      .request()
      .input('client', sql.VarChar(50), fileDetails.client)
      .input('uniqueId', sql.VarChar(50), fileDetails.uniqueId)
      .query(
        'SELECT ProcessStatusId, FileStatusId FROM ClientFileScheduleProcessStatus WHERE ClientFileScheduleInfoId IN (' +
          'SELECT Id FROM ClientFileScheduleInfo WHERE ClientInfoId = (SELECT Id FROM ClientInfo WHERE CorporationCode = @client) ' +
          'AND UniqueId = @uniqueId)'
      );
    const status = result.recordset[0];
    if (!status) {
      throw new Error('ClientFileScheduleProcessStatus not found for scheduler job.');
    }
    if (status.ProcessStatusId !== 10 || status.FileStatusId !== 11) {
      throw new Error(
        `Unexpected FileScheduler status. ProcessStatusId=${status.ProcessStatusId}, FileStatusId=${status.FileStatusId}`
      );
    }
  }

  async getProcessStatusIds(fileDetails: FileDetails): Promise<number[]> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('client', sql.VarChar(50), fileDetails.client)
      .input('batchNumber', sql.VarChar(50), fileDetails.batchNumber)
      .query(
        'SELECT ProcessStatusId FROM RegistrationProcessStatus WHERE RegistrationId IN (' +
          'SELECT Id FROM Registration WHERE ClientInfoId = (SELECT Id FROM ClientInfo WHERE CorporationCode = @client) ' +
          'AND BatchNumber = @batchNumber)'
      );
    return result.recordset.map((row) => row.ProcessStatusId as number);
  }

  async validateProcessStatusAfterJob(fileDetails: FileDetails, expected: number, jobName: string): Promise<void> {
    const statuses = await this.getProcessStatusIds(fileDetails);
    if (!statuses.length) {
      throw new Error(`No RegistrationProcessStatus rows found for ${jobName}.`);
    }
    const mismatched = statuses.filter((id) => id !== expected);
    if (mismatched.length) {
      throw new Error(`${jobName} expected ProcessStatusId ${expected} but got ${mismatched.join(', ')}`);
    }
  }

  async validateHandshakeJobStatus(fileDetails: FileDetails): Promise<void> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('client', sql.VarChar(50), fileDetails.client)
      .input('batchNumber', sql.VarChar(50), fileDetails.batchNumber)
      .query(
        'SELECT TOP 1 HTTPStatusCode, ImportOrderStatus, OrderId FROM RegistrationCGeJson ' +
          'WHERE ClientInfoId = (SELECT Id FROM ClientInfo WHERE CorporationCode = @client) ' +
          'AND BatchNumber = @batchNumber AND IsCurrentData = 1 AND JSONResponse != ' + "'NULL'" +
          ' ORDER BY UpdatedDateTime DESC'
      );
    const row = result.recordset[0];
    if (!row) {
      throw new Error('RegistrationCGeJson row not found for handshake validation.');
    }
    if (row.HTTPStatusCode !== 'Created' || (row.ImportOrderStatus !== 'Submitted' && row.ImportOrderStatus !== 'Imported')) {
      throw new Error(
        `Handshake validation failed. HTTPStatusCode=${row.HTTPStatusCode}, ImportOrderStatus=${row.ImportOrderStatus}`
      );
    }
    if (!row.OrderId) {
      throw new Error('OrderId is missing from handshake response.');
    }
    fileDetails.orderId = row.OrderId.toString();
    console.log(`Handshake validated with HTTPStatusCode = ${row.HTTPStatusCode} , ImportOrderStatus = ${row.ImportOrderStatus} & OrderId: ${fileDetails.orderId}`);
  }

  async setProcessAndFileStatusToNotStartedReturn(fileDetails: FileDetails): Promise<void> {
    fileDetails.uniqueId = await this.getUniqueBatchFileId(fileDetails, 'Return');
    await this.enableClient(fileDetails.client);
    await this.updateProcessAndFileStatusToNotStarted(fileDetails.uniqueId);
  }

  async setProcessAndFileStatusToNotStarted(fileDetails: FileDetails): Promise<void> {
    fileDetails.uniqueId = await this.getUniqueBatchFileId(fileDetails, 'NF');
    await this.enableClient(fileDetails.client);
    await this.updateProcessAndFileStatusToNotStarted(fileDetails.uniqueId);
  }

  async getProcessAndFileStatus(uniqueBatchFileId: string): Promise<ProcessStatusFileStatusResponse> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('uniqueId', sql.VarChar(50), uniqueBatchFileId)
      .query(
        'SELECT ProcessStatusId, FileStatusId FROM ClientFileScheduleProcessStatus WHERE ClientFileScheduleInfoId IN (' +
          'SELECT Id FROM ClientFileScheduleInfo WHERE UniqueId = @uniqueId)'
      );
    const row = result.recordset[0];
    if (!row) {
      throw new Error('No process and file status found for the given UniqueId.');
    }
    return {
      processStatusId: row.ProcessStatusId,
      fileStatusId: row.FileStatusId
    };
  }

  async validateClientFileSchedulerJobFileStatusInDB(fileDetails: FileDetails): Promise<void> {
    const status = await this.waitFor<ProcessStatusFileStatusResponse>(
      () => this.getProcessAndFileStatus(fileDetails.uniqueId!),
      (s) => s.processStatusId === 10 && s.fileStatusId === 11,
      { timeoutMs: 60_000, intervalMs: 2_000 }
    );
    if (status.processStatusId !== 10) {
      throw new Error(`Process Status is not updated as Ready: ${status.processStatusId}`);
    }
    if (status.fileStatusId !== 11) {
      throw new Error(`File Status is not updated as Found: ${status.fileStatusId}`);
    }
  }

  async getProcessStatusAfterJob(fileDetails: FileDetails): Promise<ProcessStatusIdResponse> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('client', sql.VarChar(50), fileDetails.client)
      .input('batchNumber', sql.VarChar(50), fileDetails.batchNumber)
      .query(
        'SELECT ProcessStatusId, RegistrationId FROM [dbo].[RegistrationProcessStatus] WHERE RegistrationId IN (' +
          'SELECT Id FROM [dbo].[Registration] WHERE ClientInfoId = (SELECT Id FROM dbo.ClientInfo WHERE CorporationCode = @client) ' +
          'AND BatchNumber = @batchNumber)'
      );
    const response: ProcessStatusIdResponse = {
      processStatusId: [],
      registrationId: []
    };
    for (const row of result.recordset) {
      response.processStatusId.push(row.ProcessStatusId);
      response.registrationId.push(row.RegistrationId);
    }
    return response;
  }

  async validateProcessStatusIdAfterJobInDB(
    fileDetails: FileDetails,
    job: string,
    expectedProcessStatusId: number
  ): Promise<void> {
    const status = await this.waitFor<ProcessStatusIdResponse>(
      () => this.getProcessStatusAfterJob(fileDetails),
      (s) => s.processStatusId.length > 0 && s.processStatusId.every((id) => id === expectedProcessStatusId),
      { timeoutMs: 90_000, intervalMs: 2_000 }
    );
    if (status.processStatusId.length === 0) {
      throw new Error(`No registrations found with BatchNumber = ${fileDetails.batchNumber}`);
    }
    for (const processStatusId of status.processStatusId) {
      if (processStatusId !== expectedProcessStatusId) {
        throw new Error(`${job} Process Status Id is not Completed: ${processStatusId}`);
      }
    }
  }
}
