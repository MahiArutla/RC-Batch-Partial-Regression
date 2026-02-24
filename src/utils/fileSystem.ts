import fs from 'fs/promises';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { loadEnv } from '../config/env';
import { FileDetails } from '../models/fileDetails';
import { generateA8DigitReference, generateBatchNumber, generateBmoInputFileName, generateFordReference } from './random';

const env = loadEnv();

export async function ensureDirectory(targetDir: string): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
}

export async function copyFile(source: string, destination: string): Promise<void> {
  await ensureDirectory(path.dirname(destination));
  await fs.copyFile(source, destination);
}

export async function updateBatchNumberInTildeFile(filePath: string, batchNumber: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  content = content.replace(/^(FH1~[^~]+~[^~]+~)[^~]+/, `$1${batchNumber}`);
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function updateReferenceNumberInTildeFile(filePath: string, reference: string): Promise<void> {
  const lines = (await fs.readFile(filePath, 'utf-8')).split(/\r?\n/);
  const updated = lines
    .map((line) => {
      if (!line.startsWith('SH1~')) {
        return line;
      }
      const parts = line.split('~');
      if (parts.length > 3) {
        parts[3] = reference;
      }
      return parts.join('~');
    })
    .join('\n');
  await fs.writeFile(filePath, updated, 'utf-8');
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function updateBatchNumberInXifFile(filePath: string, batchNumber: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');

  // Case 1: Attribute form e.g., <Batch Number="250416">
  let updated = content.replace(/(<\s*Batch\b[^>]*\bNumber\s*=\s*")[^"]*(")/i, `$1${batchNumber}$2`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
    return;
  }
  // Attribute form with single quotes
  updated = content.replace(/(<\s*Batch\b[^>]*\bNumber\s*=\s*')[^']*(')/i, `$1${batchNumber}$2`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
    return;
  }

  // Case 2: Element form e.g., <BatchNumber>...</BatchNumber>
  if (/<\s*BatchNumber\s*>/i.test(content)) {
    updated = content.replace(/<\s*BatchNumber\s*>[^<]*<\s*\/\s*BatchNumber\s*>/i, `<BatchNumber>${batchNumber}</BatchNumber>`);
    if (updated !== content) {
      await fs.writeFile(filePath, updated, 'utf-8');
      return;
    }
  }

  // Case 3: Alternative element name e.g., <BatchNo>...</BatchNo>
  updated = content.replace(/<\s*BatchNo\s*>[^<]*<\s*\/\s*BatchNo\s*>/i, `<BatchNo>${batchNumber}</BatchNo>`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
  }
}

export async function updatePartnerReferenceInXifFile(filePath: string, partnerReference: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');

  // Primary: element with hyphenated tag <Partner-Reference>...</Partner-Reference>
  let updated = content.replace(/(<\s*Partner-Reference\s*>)[^<]*(<\s*\/\s*Partner-Reference\s*>)/i, `$1${partnerReference}$2`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
    return;
  }

  // Fallback: non-hyphenated tag <PartnerReference>...</PartnerReference>
  updated = content.replace(/(<\s*PartnerReference\s*>)[^<]*(<\s*\/\s*PartnerReference\s*>)/i, `$1${partnerReference}$2`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
  }
}

export async function clearDirectory(targetDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) return;
        const filePath = path.join(targetDir, entry.name);
        await fs.unlink(filePath);
      })
    );
  } catch {
    // Ignore errors (e.g., directory does not exist); caller may create it
  }
}

export async function updateBatchNumberInFordFile(filePath: string, newBatchNumber: string): Promise<void> {
  // Read all lines
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  const replaceFirstDate = (input: string, newDate: string): string => {
    const re = /\d{4}-\d{2}-\d{2}/;
    return input.replace(re, newDate);
  };

  const today = new Date();
  const yyyy = today.getFullYear();
  const MM = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${MM}-${dd}`;

  // Header line (line 0)
  if (lines.length > 0) {
    lines[0] = replaceFirstDate(lines[0], todayStr);
    // Replace only the literal token "BatchN" with the new batch number
    lines[0] = lines[0].replace(/\bBatchN\b/g, newBatchNumber);
    // Normalize: remove any hyphen directly before the 8-digit batch number
    lines[0] = lines[0].replace(/-(\d{8})(\b)/, '$1$2');
  }

  // Trailer / control record (line 15 => index 14)
  const trailerIndex = 14;
  if (lines.length > trailerIndex) {
    lines[trailerIndex] = replaceFirstDate(lines[trailerIndex], todayStr);
  }

  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
}

export async function updateReferenceNumberInFordFile(filePath: string, reference: string): Promise<void> {
  // Read all lines
  const raw = await fs.readFile(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  // Update line 2 (index 1) - replace 2AASMOKERN with the new reference
  if (lines.length > 1) {
    lines[1] = lines[1].replace(/2AASMOKERN/g, reference);
  }

  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
}

function generateId(prefix: string): string {
  const now = new Date();

  const date =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  const time =
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0");

  return `${prefix}${date} ${time}`;
}

// Usage
const value = generateId("LON-TDAF");
console.log(value);

export async function updateRenewalFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  if (lines.length > 0) {
    // Update the first line by replacing the old date with the current date
    const currentDate = new Date().toISOString().split('T')[0]; // yyyy-MM-dd
    lines[0] = lines[0].replace(/\d{4}-\d{2}-\d{2}/, currentDate);

    const now = new Date();
    const timeString =
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0') +
      String(now.getMilliseconds()).padStart(3, '0');

    // Replace characters from the 20th to 27th position (0-based: 19 to 26)
    if (lines[0].length >= 27) {
      lines[0] = lines[0].substring(0, 19) + timeString + lines[0].substring(27);
    }

    fileDetails.batchNumber = lines[0];
    fileDetails.batchNumber = fileDetails.batchNumber.replace(/,/g, '');

    // Check if there are at least 3 lines in the file
    if (lines.length >= 3) {
      // Split the third line into cells
      const cells = lines[2].split(',');

      // Replace the first cell with the new reference number
      if (cells.length > 0) {
        cells[0] = fileDetails.partnerReference || '';
      }

      // Reconstruct the third line
      lines[2] = cells.join(',');
    }
  }

  // Write the modified lines back to the file
  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions for timestamp and filename generation
// ─────────────────────────────────────────────────────────────────────────────

function formatTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  let hh = d.getHours();
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const hh12 = pad(((hh + 11) % 12) + 1);
  return `${yyyy}${MM}${dd}_${hh12}${mm}${ss}`;
}

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

function formatTimestampWithMillis(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const fff = d.getMilliseconds().toString().padStart(3, '0');
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}${fff}`;
}

function buildNfFileName(fileDetails: FileDetails): string {
  switch (fileDetails.client.toUpperCase()) {
    case 'GBC':
      return `PPtoDH_${formatTimestamp()}.XIF`;
    case 'TDAF':
      return `TDC50toPPSA.${formatTimestampWithMillis()}.XIF`;
    case 'FORD':
      return `FORD_NF_${formatTimestamp()}.FC`;
    default:
      return `DEFAULT_${formatTimestamp()}.XIF`;
  }
}
function buildRenewalFileName(fileDetails: FileDetails): string {
  switch (fileDetails.client.toUpperCase()) {
     case 'TDAF':
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `TDAF_Renewal_${yyyy}${mm}${dd}.csv`;
    default:
      return `DEFAULT_${formatTimestamp()}.XIF`;
  }
}

function buildSftpTarget(fileInfo: string, fileName: string): string {
  switch (fileInfo.toUpperCase()) {
    case 'GBC':
      return path.join(env.sftpRoot, 'GBC', 'in', fileName);
    case 'BMO':
      return path.join(env.sftpRoot, 'BMO', 'in', fileName);
       case 'TDAF':
      return path.join(env.sftpRoot, 'tdaf', 'in', fileName);
    default:
      throw new Error(`Client Format not found for ${fileInfo}`);
  }
}

const sftpFolderByClient: Record<string, string> = {
  BMO: path.join('BMO', 'in')
};

function buildSftpPathForClient(client: string, fileName: string): string {
  const clientFolder = sftpFolderByClient[client];
  if (!clientFolder) {
    throw new Error(`SFTP folder mapping is missing for client ${client}.`);
  }
  return path.join(env.sftpRoot, clientFolder, fileName);
}

// ─────────────────────────────────────────────────────────────────────────────
// File creation functions (formerly from inputFileCreation, nfFileService, nfService)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateNfFile(fileDetails: FileDetails): Promise<FileDetails> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildNfFileName(fileDetails);
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  if (fileDetails.batchNumber) {
    await updateBatchNumberInXifFile(sourceFilePath, fileDetails.batchNumber);
  }

  if (fileDetails.partnerReference) {
    await updatePartnerReferenceInXifFile(sourceFilePath, fileDetails.partnerReference);
  }

  fileDetails.inputFileName = inputFileName;
  const targetPath = buildSftpTarget(fileDetails.fileInfo, inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  return fileDetails;
}

export async function createNfFileTilde(fileDetails: FileDetails): Promise<void> {
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

  const sftpTarget = buildSftpPathForClient(fileDetails.client, localFileName);
  await copyFile(localFilePath, sftpTarget);

  fileDetails.inputFileName = localFileName;
}

export async function createNfFile(fileDetails: FileDetails): Promise<void> {
  fileDetails.batchNumber = generateBatchNumber();
  fileDetails.partnerReference = generateA8DigitReference();
  await updateNfFile(fileDetails);
}

export async function createFordNfFc(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = 'Canlien.fc';
  const localFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, localFilePath);

  fileDetails.batchNumber = generateBatchNumber();
  await updateBatchNumberInFordFile(localFilePath, fileDetails.batchNumber);
  fileDetails.partnerReference = generateFordReference();
  await updateReferenceNumberInFordFile(localFilePath, fileDetails.partnerReference);
  
  // align batchNumber with header-derived value, sanitize any leading '-'
  const raw = (await fs.readFile(localFilePath, 'utf-8')).split(/\r?\n/);
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
}

export async function createBnsCommNfXml(fileDetails: FileDetails): Promise<void> {
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
}

export async function createBnsCommDischargeXml(fileDetails: FileDetails): Promise<void> {
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
}

export async function createNfFileByClient(fileDetails: FileDetails): Promise<void> {
  const ext = (path.extname(fileDetails.sampleFile || '') || '').toLowerCase();
  const client = (fileDetails.client || '').toUpperCase();
  if (client === 'GBC' || ext === '.xif') {
    return createNfFile(fileDetails);
  }
  if (client === 'TDAF' ) {

     return createNfFile(fileDetails);
  }
  if (client === 'FORD' || ext === '.fc') {
    return createFordNfFc(fileDetails);
  }
  if (client.includes('BNS') || ext === '.xml') {
    return createBnsCommNfXml(fileDetails);
  }
  // default to XIF path
  return createNfFile(fileDetails);
}

export async function createRenewalFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildRenewalFileName(fileDetails);
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateRenewalFile(sourceFilePath, fileDetails);

  const targetPath = buildSftpTarget(fileDetails.fileInfo, inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

