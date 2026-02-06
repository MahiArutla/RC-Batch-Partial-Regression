import path from 'path';
import { FileDetails } from '../models/fileDetails';
import { InputFileCreationService } from './inputFileCreation';
import { DbService } from './dbService';
import { loadEnv } from '../config/env';
import { copyFile, ensureDirectory, clearDirectory, updateBatchNumberInFordFile, updateBatchNumberInXifFile, updatePartnerReferenceInXifFile } from '../utils/fileSystem';
import { generateA8DigitReference, generateBatchNumber } from '../utils/random';

const env = loadEnv();

function formatAdjustedTimestamp(): string {
  const d = new Date(Date.now() - 10 * 60 * 1000);
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const HH = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  const f = Math.floor(d.getMilliseconds() / 100);
  return `_${yyyy}-${MM}-${dd}_${HH}-${mm}-${ss}_${f}`;
}

export class NfService {
  private readonly inputCreator = new InputFileCreationService();
  private dbService?: DbService;

  getDbService(): DbService {
    if (!this.dbService) this.dbService = new DbService();
    return this.dbService;
  }

  // GBC .XIF
  async createGbcNfXif(fileDetails: FileDetails): Promise<void> {
    fileDetails.batchNumber = generateBatchNumber();
    fileDetails.partnerReference = generateA8DigitReference();
    await this.inputCreator.createGbcNfFile(fileDetails);
    await this.getDbService().setProcessAndFileStatusToNotStarted(fileDetails);
  }

  // FORD .fc
  async createFordNfFc(fileDetails: FileDetails): Promise<void> {
    const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
    await ensureDirectory(scenarioArtifactsDir);

    const inputFileName = 'Canlien.fc';
    const localFilePath = path.join(scenarioArtifactsDir, inputFileName);
    await copyFile(fileDetails.sampleFile, localFilePath);

    fileDetails.batchNumber = generateBatchNumber();
    await updateBatchNumberInFordFile(localFilePath, fileDetails.batchNumber);

    // align batchNumber with header-derived value, sanitize any leading '-'
    const raw = (await (await import('fs')).promises.readFile(localFilePath, 'utf-8')).split(/\r?\n/);
    const header = raw[0] ?? '';
    const m = header.match(/\.([0-9]{6,})\s*$/) || header.match(/\.([0-9]{6,})/);
    if (m && m[1]) {
      fileDetails.batchNumber = m[1].replace(/^-/,'');
    } else {
      fileDetails.batchNumber = (fileDetails.batchNumber ?? '').replace(/^-/,'');
    }

    fileDetails.inputFileName = inputFileName;

    const targetPath = path.join(env.sftpRoot, 'ford', 'in', inputFileName);
    const targetDir = path.dirname(targetPath);
    await ensureDirectory(targetDir);
    await clearDirectory(targetDir);
    await copyFile(localFilePath, targetPath);
    await this.getDbService().setProcessAndFileStatusToNotStarted(fileDetails);
  }

  // BNS COMM .XML (XIF format)
  async createBnsCommNfXml(fileDetails: FileDetails): Promise<void> {
    const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
    await ensureDirectory(scenarioArtifactsDir);

    const inputFileName = `xifdoc${formatAdjustedTimestamp()}.XML`;
    const localFilePath = path.join(scenarioArtifactsDir, inputFileName);
    await copyFile(fileDetails.sampleFile, localFilePath);

    fileDetails.batchNumber = generateBatchNumber();
    // Only generate partnerReference if not already set (so it can be passed from test for both cycles)
    if (!fileDetails.partnerReference) {
      fileDetails.partnerReference = generateA8DigitReference();
    }
    await updateBatchNumberInXifFile(localFilePath, fileDetails.batchNumber);
    await updatePartnerReferenceInXifFile(localFilePath, fileDetails.partnerReference);

    fileDetails.inputFileName = inputFileName;

    const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', inputFileName);
    const targetDir = path.dirname(targetPath);
    await ensureDirectory(targetDir);
    await clearDirectory(targetDir);
    await copyFile(localFilePath, targetPath);
    await this.getDbService().setProcessAndFileStatusToNotStarted(fileDetails);
  }
    async createBnsCommDischargeXml(fileDetails: FileDetails): Promise<void> {
  
      // Discharge file creation logic moved from orchestrator
      const fs = await import('fs/promises');
      const { updateBatchNumberInXifFile, updatePartnerReferenceInXifFile } = await import('../utils/fileSystem');
      const { generateBatchNumber } = await import('../utils/random');

      // Use sampleFile as the template path
      const dischargeTemplatePath = fileDetails.sampleFile;
      const scenarioArtifactsDir = path.resolve(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });
      const dischargeInputFileName = `xifdoc${formatAdjustedTimestamp()}.XML`;
      const dischargeLocalFilePath = path.join(scenarioArtifactsDir, dischargeInputFileName);
      await fs.copyFile(dischargeTemplatePath, dischargeLocalFilePath);

      // Update batch number
      let newBatchNumber = generateBatchNumber();
      if (newBatchNumber.startsWith('-')) {
        newBatchNumber = newBatchNumber.replace(/^-+/, '');
      }
      await updateBatchNumberInXifFile(dischargeLocalFilePath, newBatchNumber);

      // Update partner reference
      if (!fileDetails.partnerReference) {
        throw new Error('partnerReference is undefined');
      }
      await updatePartnerReferenceInXifFile(dischargeLocalFilePath, fileDetails.partnerReference);

      // Update PPR-Registration-Number
      let dischargeContent = await fs.readFile(dischargeLocalFilePath, 'utf-8');
      if (fileDetails.baseRegistrationNum) {
        if (dischargeContent.match(/<PPR-Registration-Number>.*<\/PPR-Registration-Number>/i)) {
          dischargeContent = dischargeContent.replace(/(<PPR-Registration-Number>)[^<]*(<\/PPR-Registration-Number>)/i, `$1${fileDetails.baseRegistrationNum}$2`);
        } else if (dischargeContent.match(/<PPR-Registration-Number\s*\/?>(?!<)/i)) {
          dischargeContent = dischargeContent.replace(/<PPR-Registration-Number\s*\/?>(?!<)/i, `<PPR-Registration-Number>${fileDetails.baseRegistrationNum}</PPR-Registration-Number>`);
        }
        await fs.writeFile(dischargeLocalFilePath, dischargeContent, 'utf-8');
      } else {
        throw new Error('baseRegistrationNum from cycle 1 is undefined');
      }

      // Update fileDetails for SFTP upload
      fileDetails.sampleFile = dischargeLocalFilePath;
      fileDetails.batchNumber = newBatchNumber;
     
      fileDetails.inputFileName = dischargeInputFileName;
      const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', dischargeInputFileName);
    
     const targetDir = path.dirname(targetPath);
    await ensureDirectory(targetDir);
    await clearDirectory(targetDir);
    await copyFile(dischargeLocalFilePath, targetPath);
    await this.getDbService().setProcessAndFileStatusToNotStarted(fileDetails);
    }

  // Dispatcher based on client or sample extension
  async createNfFile(fileDetails: FileDetails): Promise<void> {
    const ext = (path.extname(fileDetails.sampleFile || '') || '').toLowerCase();
    const client = (fileDetails.client || '').toUpperCase();
    if (client === 'GBC' || ext === '.xif') {
      return this.createGbcNfXif(fileDetails);
    }
    if (client === 'FORD' || ext === '.fc') {
      return this.createFordNfFc(fileDetails);
    }
    if (client.includes('BNS') || ext === '.xml') {
      return this.createBnsCommNfXml(fileDetails);
    }
    // default to XIF path
    return this.createGbcNfXif(fileDetails);
  }
}
