import path from 'path';
import { loadEnv } from '../config/env';
import { FileDetails } from '../models/fileDetails';
import {
  copyFile,
  ensureDirectory,
  updateBatchNumberInTildeFile,
  updateReferenceNumberInTildeFile
} from '../utils/fileSystem';
import {
  generateBatchNumber,
  generateA8DigitReference,
  generateBmoInputFileName
} from '../utils/random';

const env = loadEnv();

const sftpFolderByClient: Record<string, string> = {
  BMO: path.join('BMO', 'in')
};

export class NfFileService {
  async createNfFileTilde(fileDetails: FileDetails): Promise<void> {
    const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
    await ensureDirectory(scenarioArtifactsDir);

    const fileStem = generateBmoInputFileName();
    const localFileName = `${fileStem}.uif`;
    const localFilePath = path.join(scenarioArtifactsDir, localFileName);
    await copyFile(fileDetails.sampleFile, localFilePath);

    fileDetails.batchNumber = generateBatchNumber();
    fileDetails.partnerReference = generateA8DigitReference();

    await updateBatchNumberInTildeFile(localFilePath, fileDetails.batchNumber);
    await updateReferenceNumberInTildeFile(localFilePath, fileDetails.partnerReference);

    const sftpTarget = this.buildSftpPath(fileDetails.client, localFileName);
    await copyFile(localFilePath, sftpTarget);

    fileDetails.inputFileName = localFileName;
  }

  private buildSftpPath(client: string, fileName: string): string {
    const clientFolder = sftpFolderByClient[client];
    if (!clientFolder) {
      throw new Error(`SFTP folder mapping is missing for client ${client}.`);
    }
    return path.join(env.sftpRoot, clientFolder, fileName);
  }
}
