import path from 'path';
import { loadEnv } from '../config/env';
import { FileDetails } from '../models/fileDetails';
import { copyFile, ensureDirectory, clearDirectory, updateBatchNumberInFordFile } from '../utils/fileSystem';
import { generateBatchNumber } from '../utils/random';
import { DbService } from './dbService';

const env = loadEnv();

export class FordNfService {
  private dbService?: DbService;

  async createNfFileFc(fileDetails: FileDetails): Promise<FileDetails> {
    const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
    await ensureDirectory(scenarioArtifactsDir);

    const inputFileName = 'Canlien.fc';
    const localFilePath = path.join(scenarioArtifactsDir, inputFileName);
    await copyFile(fileDetails.sampleFile, localFilePath);

    // Update batch number only
    fileDetails.batchNumber = generateBatchNumber();
    await updateBatchNumberInFordFile(localFilePath, fileDetails.batchNumber);

    // Re-derive batch number from the updated file header to ensure alignment with parser
    const raw = (await (await import('fs')).promises.readFile(localFilePath, 'utf-8')).split(/\r?\n/);
    const header = raw[0] ?? '';
    const m = header.match(/\.([0-9]{6,})\s*$/) || header.match(/\.([0-9]{6,})/);
    if (m && m[1]) {
      fileDetails.batchNumber = m[1].replace(/^-/,'');
    } else {
      // fallback: sanitize any leading hyphen
      fileDetails.batchNumber = fileDetails.batchNumber.replace(/^-/,'');
    }

    fileDetails.inputFileName = inputFileName;

    // Upload to SFTP ford/in
    const targetPath = path.join(env.sftpRoot, 'ford', 'in', inputFileName);
    const targetDir = path.dirname(targetPath);
    await ensureDirectory(targetDir);
    await clearDirectory(targetDir);
    await copyFile(localFilePath, targetPath);
    await this.getDbService().setProcessAndFileStatusToNotStarted(fileDetails);
    return fileDetails;
  }

  getDbService(): DbService {
    if (!this.dbService) this.dbService = new DbService();
    return this.dbService;
  }
}
