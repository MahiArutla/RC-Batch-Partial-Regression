import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { FileDetails } from '../models/fileDetails';
import { loadEnv } from '../config/env';

interface ReadOptions {
  sheetName?: string;
}

export class TestDataHelper {
  private excelPath: string;
  private env = loadEnv();

  constructor(excelPath?: string) {
    this.excelPath = excelPath ?? path.resolve(process.cwd(), 'src', 'data', 'TestData.xlsx');
  }

  exists(): boolean {
    return fs.existsSync(this.excelPath);
  }

  readScenarioMap(options?: ReadOptions): Record<string, FileDetails> {
    if (!this.exists()) {
      return {};
    }

    const workbook = xlsx.readFile(this.excelPath);
    const sheetName = options?.sheetName ?? workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return {};
    }

    const rows = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: null });
    const map: Record<string, FileDetails> = {};

    for (const row of rows) {
      const scenarioId = (row.scenarioId ?? row.ScenarioId ?? row.scenario_id) as string | null;
      if (!scenarioId) {
        continue;
      }

      const client = (row.client ?? row.Client) as string | null;
      const fileInfo = (row.fileInfo ?? row.FileInfo) as string | null;
      const inputFileDescription = (row.inputFileDescription ?? row.InputFileDescription) as string | null;
      const sampleFileRaw = (row.sampleFile ?? row.SampleFile) as string | null;
      const downloadFileType = (row.downloadFileType ?? row.DownloadFileType) as string | null;
      const returnFileDescription = (row.returnFileDescription ?? row.ReturnFileDescription) as string | null;

      const sampleFile = this.resolveSamplePath(sampleFileRaw, client ?? undefined);

      const details: FileDetails = {
        scenarioId,
        client: client ?? '',
        fileInfo: fileInfo ?? '',
        inputFileDescription: inputFileDescription ?? '',
        sampleFile: sampleFile ?? '',
        downloadFileType: downloadFileType ?? '',
        returnFileDescription: returnFileDescription ?? null,
        testCaseType: (row.testCaseType ?? row.TestCaseType ?? null) as string | null,
        validationMessage: (row.validationMessage ?? row.ValidationMessage ?? null) as string | null,
        fromDate: (row.fromDate ?? row.FromDate ?? null) as string | null,
        toDate: (row.toDate ?? row.ToDate ?? null) as string | null,
        includeDeletedFile: (row.includeDeletedFile ?? row.IncludeDeletedFile ?? null) as boolean | null,
        renewalSampleFile: (row.renewalSampleFile ?? row.RenewalSampleFile ?? null) as string | null,
        renewalFileDescription: (row.renewalFileDescription ?? row.RenewalFileDescription ?? null) as string | null,
        dischargeSampleFile: (row.dischargeSampleFile ?? row.DischargeSampleFile ?? null) as string | null,
        dischargeFileDescription: (row.dischargeFileDescription ?? row.DischargeFileDescription ?? null) as string | null,
        copSampleFile: (row.copSampleFile ?? row.COPSampleFile ?? null) as string | null,
        copFileDescription: (row.copFileDescription ?? row.COPFileDescription ?? null) as string | null,
        greenlightDischargeSampleFile: (row.greenlightDischargeSampleFile ?? row.GreenlightDischargeSampleFile ?? null) as string | null,
        greenlightDischargeFileDescription: (row.greenlightDischargeFileDescription ?? row.GreenlightDischargeFileDescription ?? null) as string | null
      };

      map[scenarioId] = details;
    }

    return map;
  }

  private resolveSamplePath(sampleFileRaw: string | null, client?: string): string | null {
    if (!sampleFileRaw) return null;
    // If absolute, use as-is
    if (path.isAbsolute(sampleFileRaw)) return sampleFileRaw;
    // If relative, try joining with src/data folder and client folder when provided
    const dataRoot = path.resolve(__dirname, '../data');
    if (client) {
      const byClient = path.join(dataRoot, client, sampleFileRaw);
      if (fs.existsSync(byClient)) {
        return byClient;
      }

      // Some clients keep sample files flat under src/data (for example: src/data/clearcharge).
      const byRootSample = path.join(dataRoot, sampleFileRaw);
      if (fs.existsSync(byRootSample)) {
        return byRootSample;
      }

      const byRootClientName = path.join(dataRoot, client);
      if (fs.existsSync(byRootClientName)) {
        return byRootClientName;
      }
    }
    return path.join(dataRoot, sampleFileRaw);
  }
}

export function loadExcelScenarioMap(excelPath?: string, options?: ReadOptions): Record<string, FileDetails> {
  const helper = new TestDataHelper(excelPath);
  return helper.readScenarioMap(options);
}
