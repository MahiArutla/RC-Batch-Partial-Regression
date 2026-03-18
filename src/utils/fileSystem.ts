import fs from 'fs/promises';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { loadEnv } from '../config/env';
import { FileDetails } from '../models/fileDetails';
import { generateA8DigitReference, generateBatchNumber, generateBmoInputFileName, generateFordReference, generateTdafReference, generateVwReference, generateVin } from './random';

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

export async function updateSerialNumberInXifFile(filePath: string, serialNumber: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');

  // Update <Serial-Number>...</Serial-Number> tag
  let updated = content.replace(/(<\s*Serial-Number\s*>)[^<]*(<\s*\/\s*Serial-Number\s*>)/i, `$1${serialNumber}$2`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
    return;
  }

  // Fallback: non-hyphenated tag <SerialNumber>...</SerialNumber>
  updated = content.replace(/(<\s*SerialNumber\s*>)[^<]*(<\s*\/\s*SerialNumber\s*>)/i, `$1${serialNumber}$2`);
  if (updated !== content) {
    await fs.writeFile(filePath, updated, 'utf-8');
  }
}

export async function clearDirectory(targetDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const files = entries.filter(entry => entry.isFile());

    if (files.length > 0) {
      console.log(`Clearing ${files.length} file(s) from ${targetDir}`);
      await Promise.all(
        files.map(async (entry) => {
          const filePath = path.join(targetDir, entry.name);
          console.log(`Deleting: ${entry.name}`);
          await fs.unlink(filePath);
        })
      );
      console.log(`Directory cleared: ${targetDir}`);
    }
  } catch (error) {
    // Ignore errors (e.g., directory does not exist); caller may create it
    console.log(`clearDirectory: ${targetDir} - ${error instanceof Error ? error.message : 'Directory does not exist'}`);
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

export async function updateDischargeFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const client = (fileDetails.client || '').toUpperCase();

  // Handle VW discharge files (fixed-width format)
  if (client === 'VW' || client === 'VOLKSWAGEN') {
    let updatedContent = content;

    // Replace REGTNUM with baseRegistrationNum
    if (fileDetails.baseRegistrationNum) {
      updatedContent = updatedContent.replace(/REGTNUM/g, fileDetails.baseRegistrationNum);
    } else {
      throw new Error('baseRegistrationNum from cycle 1 is undefined for VW discharge');
    }

    // Set batch number (extract from file content if needed)
    // For VW, the batch number might be in a different format
    fileDetails.batchNumber = fileDetails.batchNumber || path.basename(filePath, path.extname(filePath));

    await fs.writeFile(filePath, updatedContent, 'utf-8');
    return;
  }

  // Handle TDAF discharge files (line-based format)
  const lines = content.split(/\r?\n/);

  if (lines.length > 0) {
    // Update the first line with current date and time
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ff = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
    const dateTimeString = `${yyyy}-${MM}-${dd} ${HH}${mm}${ss}${ff}`;

    // Replace the date-time portion in the first line
    lines[0] = lines[0].replace(/\d{4}-\d{2}-\d{2}\s+\d{8}/, dateTimeString);

    // Extract batch number from position 4 onwards (skip first 4 zeros)
    // e.g., "0000LON-TDAF2026-02-26 02413499" -> "LON-TDAF2026-02-26 02413499"
    fileDetails.batchNumber = lines[0].substring(4).replace(/,/g, '').trim();
  }

  // Update the second line with partner reference
  if (lines.length >= 2 && fileDetails.partnerReference) {
    lines[1] = lines[1].replace(/PARTNRREF/g, fileDetails.partnerReference);
  }

  // Write the modified lines back to the file
  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
}

export async function updateChangeOfProvinceFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  if (lines.length > 0) {
    // Update the first line with current date and time
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ff = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
    const dateTimeString = `${yyyy}-${MM}-${dd} ${HH}${mm}${ss}${ff}`;

    // Replace the date-time portion in the first line
    lines[0] = lines[0].replace(/\d{4}-\d{2}-\d{2}\s+\d{8}/, dateTimeString);

    // Extract batch number from position 4 onwards (skip first 4 zeros)
    // e.g., "0000LON-TDAF2026-02-26 02413499" -> "LON-TDAF2026-02-26 02413499"
    fileDetails.batchNumber = lines[0].substring(4).replace(/,/g, '').trim();
  }

  // Update the second line with partner reference
  if (lines.length >= 2 && fileDetails.partnerReference) {
    lines[1] = lines[1].replace(/PARTNRREF/g, fileDetails.partnerReference);
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
      // Format: PPtoDH_yyyymmdd_hhmmss.XIF (24-hour format)
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const yyyy = d.getFullYear();
      const MM = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mm = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      const fileName = `PPtoDH_${yyyy}${MM}${dd}_${hh}${mm}${ss}.XIF`;
      console.log(`GBC filename generated: ${fileName}`);
      return fileName;
    case 'TDAF':
      return `TDC50toPPSA.${formatTimestampWithMillis()}.XIF`;
    case 'CLEARCHARGE':
      return `CC_NF_${formatTimestampWithMillis()}.dx2`;
    case 'FORD':
      return `FORD_NF_${formatTimestamp()}.FC`;
    case 'VW':
    case 'VOLKSWAGEN':
      return 'VCItoDH.XIF';
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

function buildDischargeFileName(fileDetails: FileDetails): string {
  switch (fileDetails.client.toUpperCase()) {
    case 'TDAF':
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `TDAF_Discharge_${yyyy}${mm}${dd}.txt`;
    case 'VW':
    case 'VOLKSWAGEN':
      const nowVW = new Date();
      const yyyyVW = nowVW.getFullYear();
      const mmVW = String(nowVW.getMonth() + 1).padStart(2, '0');
      const ddVW = String(nowVW.getDate()).padStart(2, '0');
      return `CSRSDischarge${mmVW}${ddVW}${yyyyVW}.txt`;
    default:
      return `DEFAULT_${formatTimestamp()}.txt`;
  }
}

function buildGreenlightDischargeFileName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `csrsdis.${yyyy}${mm}${dd}.txt`;
}

function buildChangeOfProvinceFileName(fileDetails: FileDetails): string {
  switch (fileDetails.client.toUpperCase()) {
    case 'TDAF':
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `TDAF_ChangeOfProvince_${yyyy}${mm}${dd}.txt`;
    default:
      return `DEFAULT_${formatTimestamp()}.txt`;
  }
}

function buildGmfclFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `GMFCL_${yyyy}${MM}${dd}_${hh}${mm}${ss}.xif`;
}

function buildGmfcrFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `GMFCR_${yyyy}${MM}${dd}_${hh}${mm}${ss}.xif`;
}

function buildSftpTarget(fileInfo: string, fileName: string): string {
  switch (fileInfo.toUpperCase()) {
    case 'GBC':
      return path.join(env.sftpRoot, 'GBC', 'in', fileName);
    case 'BMO':
      return path.join(env.sftpRoot, 'BMO', 'in', fileName);
    case 'CLEARCHARGE':
      return path.join(env.sftpRoot, 'CLEARCHARGE', 'in', fileName);
    case 'TDAF':
      return path.join(env.sftpRoot, 'tdaf', 'in', fileName);
    case 'VW':
    case 'VOLKSWAGEN':
      return path.join(env.sftpRoot, 'VW', 'in', fileName);
    default:
      throw new Error(`Client Format not found for ${fileInfo}`);
  }
}

const sftpFolderByClient: Record<string, string> = {
  BMO: path.join('BMO', 'in'),
  GBC: path.join('gbc', 'in')
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

  // Generate and update VIN for VW files
  if (fileDetails.client?.toUpperCase() === 'VW' || fileDetails.client?.toUpperCase() === 'VOLKSWAGEN') {
    const vin = generateVin('VW');
    await updateSerialNumberInXifFile(sourceFilePath, vin);
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

  // Use client-specific format for partner reference
  if (fileDetails.client?.toUpperCase() === 'TDAF') {
    fileDetails.partnerReference = generateTdafReference();
  } else if (fileDetails.client?.toUpperCase() === 'VW' || fileDetails.client?.toUpperCase() === 'VOLKSWAGEN') {
    fileDetails.partnerReference = generateVwReference();
  } else {
    fileDetails.partnerReference = generateA8DigitReference();
  }

  await updateNfFile(fileDetails);
}

export async function createClearChargeNfFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const content = await fs.readFile(fileDetails.sampleFile, 'utf-8');
  const lines = content.split(/\r?\n/);
  const firstLine = lines[0] ?? '';
  const headerFields = firstLine.split('^').map((token) => token.trim());
  const filePrefix = headerFields[1];
  if (!filePrefix || !headerFields[2]) {
    throw new Error('Unable to extract ClearCharge batch number from file header.');
  }

  const paddedBatch = String(Math.floor(100 + Math.random() * 900));
  const inputFileName = `${filePrefix}${paddedBatch}.dx2`;
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);

  headerFields[2] = paddedBatch;
  lines[0] = headerFields.join('^');
  await fs.writeFile(sourceFilePath, lines.join('\n'), 'utf-8');

  // Middleware status lookups use the numeric batch number for ClearCharge.
  fileDetails.batchNumber = paddedBatch;
  fileDetails.inputFileName = inputFileName;

  const targetPath = buildSftpTarget(fileDetails.fileInfo, inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
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

  // Format: xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml
  const inputFileName = `xifdoc${formatAdjustedTimestamp()}.xml`;
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

export async function createBnsCommNfXmlWithBatchNumber(fileDetails: FileDetails, batchNumber: string): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  // Format: xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml
  const inputFileName = `xifdoc${formatAdjustedTimestamp()}.xml`;
  const localFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, localFilePath);

  // Use the provided batch number instead of generating a new one
  fileDetails.batchNumber = batchNumber;
  // Only generate partnerReference if not already set
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

  console.log(`Created BNS COMM NF file with duplicate batch number: ${batchNumber}`);
  console.log(`File uploaded to: ${targetPath}`);
}

export async function createBnsCommDischargeXml(fileDetails: FileDetails): Promise<void> {
  // Use sampleFile as the template path
  const dischargeTemplatePath = fileDetails.sampleFile;
  const scenarioArtifactsDir = path.resolve(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await fs.mkdir(scenarioArtifactsDir, { recursive: true });
  const dischargeInputFileName = `xifdoc${formatAdjustedTimestamp()}.xml`;
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

export async function createBnsCommRenewalXmlWithBatchNumber(
  fileDetails: FileDetails,
  batchNumber: string,
  registrationNumber: string,
  partnerReference: string
): Promise<void> {
  const scenarioArtifactsDir = path.resolve(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await fs.mkdir(scenarioArtifactsDir, { recursive: true });

  // Format: xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml
  const renewalInputFileName = `xifdoc${formatAdjustedTimestamp()}.xml`;
  const renewalLocalFilePath = path.join(scenarioArtifactsDir, renewalInputFileName);
  await fs.copyFile(fileDetails.sampleFile, renewalLocalFilePath);

  // Use the provided batch number instead of generating a new one
  fileDetails.batchNumber = batchNumber;
  fileDetails.partnerReference = partnerReference;
  fileDetails.baseRegistrationNum = registrationNumber;

  // Update batch number
  await updateBatchNumberInXifFile(renewalLocalFilePath, fileDetails.batchNumber);

  // Update partner reference
  await updatePartnerReferenceInXifFile(renewalLocalFilePath, fileDetails.partnerReference);

  // Update PPR-Registration-Number
  let renewalContent = await fs.readFile(renewalLocalFilePath, 'utf-8');
  if (fileDetails.baseRegistrationNum) {
    if (renewalContent.match(/<PPR-Registration-Number>.*<\/PPR-Registration-Number>/i)) {
      renewalContent = renewalContent.replace(/(<PPR-Registration-Number>)[^<]*(<\/PPR-Registration-Number>)/i, `$1${fileDetails.baseRegistrationNum}$2`);
    } else if (renewalContent.match(/<PPR-Registration-Number\s*\/?>(?!<)/i)) {
      renewalContent = renewalContent.replace(/<PPR-Registration-Number\s*\/?>(?!<)/i, `<PPR-Registration-Number>${fileDetails.baseRegistrationNum}</PPR-Registration-Number>`);
    }
    await fs.writeFile(renewalLocalFilePath, renewalContent, 'utf-8');
  } else {
    throw new Error('baseRegistrationNum from cycle 1 is undefined');
  }

  fileDetails.inputFileName = renewalInputFileName;

  const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', renewalInputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(renewalLocalFilePath, targetPath);

  console.log(`Created BNS COMM Renewal file with duplicate batch number: ${batchNumber}`);
  console.log(`File uploaded to: ${targetPath}`);
}

export async function createBnsCommDischargeXmlWithBatchNumber(
  fileDetails: FileDetails,
  batchNumber: string,
  registrationNumber: string,
  partnerReference: string
): Promise<void> {
  const scenarioArtifactsDir = path.resolve(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await fs.mkdir(scenarioArtifactsDir, { recursive: true });

  // Format: xifdoc_yyyy-MM-dd_HH-mm-ss_f.xml
  const dischargeInputFileName = `xifdoc${formatAdjustedTimestamp()}.xml`;
  const dischargeLocalFilePath = path.join(scenarioArtifactsDir, dischargeInputFileName);
  await fs.copyFile(fileDetails.sampleFile, dischargeLocalFilePath);

  // Use the provided batch number instead of generating a new one
  fileDetails.batchNumber = batchNumber;
  fileDetails.partnerReference = partnerReference;
  fileDetails.baseRegistrationNum = registrationNumber;

  // Update batch number
  await updateBatchNumberInXifFile(dischargeLocalFilePath, fileDetails.batchNumber);

  // Update partner reference
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

  fileDetails.inputFileName = dischargeInputFileName;

  const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', dischargeInputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(dischargeLocalFilePath, targetPath);

  console.log(`Created BNS COMM Discharge file with duplicate batch number: ${batchNumber}`);
  console.log(`File uploaded to: ${targetPath}`);
}

export async function createBnsCommAmendmentXml(fileDetails: FileDetails): Promise<void> {
  // Use sampleFile as the template path
  const amendmentTemplatePath = fileDetails.sampleFile;
  const scenarioArtifactsDir = path.resolve(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await fs.mkdir(scenarioArtifactsDir, { recursive: true });
  const amendmentInputFileName = `xifdoc${formatAdjustedTimestamp()}.xml`;
  const amendmentLocalFilePath = path.join(scenarioArtifactsDir, amendmentInputFileName);
  await fs.copyFile(amendmentTemplatePath, amendmentLocalFilePath);

  // Update batch number
  let newBatchNumber = generateBatchNumber();
  if (newBatchNumber.startsWith('-')) {
    newBatchNumber = newBatchNumber.replace(/^-+/, '');
  }
  await updateBatchNumberInXifFile(amendmentLocalFilePath, newBatchNumber);

  // Update partner reference
  if (!fileDetails.partnerReference) {
    throw new Error('partnerReference is undefined');
  }
  await updatePartnerReferenceInXifFile(amendmentLocalFilePath, fileDetails.partnerReference);

  // Update PPR-Registration-Number
  let amendmentContent = await fs.readFile(amendmentLocalFilePath, 'utf-8');
  if (fileDetails.baseRegistrationNum) {
    if (amendmentContent.match(/<PPR-Registration-Number>.*<\/PPR-Registration-Number>/i)) {
      amendmentContent = amendmentContent.replace(/(<PPR-Registration-Number>)[^<]*(<\/PPR-Registration-Number>)/i, `$1${fileDetails.baseRegistrationNum}$2`);
    } else if (amendmentContent.match(/<PPR-Registration-Number\s*\/?>(?!<)/i)) {
      amendmentContent = amendmentContent.replace(/<PPR-Registration-Number\s*\/?>(?!<)/i, `<PPR-Registration-Number>${fileDetails.baseRegistrationNum}</PPR-Registration-Number>`);
    }
    await fs.writeFile(amendmentLocalFilePath, amendmentContent, 'utf-8');
  } else {
    throw new Error('baseRegistrationNum from cycle 1 is undefined');
  }

  // Update fileDetails for SFTP upload
  fileDetails.sampleFile = amendmentLocalFilePath;
  fileDetails.batchNumber = newBatchNumber;
  fileDetails.inputFileName = amendmentInputFileName;

  const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', amendmentInputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(amendmentLocalFilePath, targetPath);
}

export async function createNfFileByClient(fileDetails: FileDetails): Promise<void> {
  const ext = (path.extname(fileDetails.sampleFile || '') || '').toLowerCase();
  const client = (fileDetails.client || '').toUpperCase();
  if (client === 'GBC' || ext === '.xif') {
    return createNfFile(fileDetails);
  }
  if (client === 'CLEARCHARGE' || ext === '.dx2') {
    return createClearChargeNfFile(fileDetails);
  }
  if (client === 'TDAF') {
    return createNfFile(fileDetails);
  }
  if (client === 'VW' || client === 'VOLKSWAGEN') {
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

export async function createDischargeFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildDischargeFileName(fileDetails);
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateDischargeFile(sourceFilePath, fileDetails);

  const targetPath = buildSftpTarget(fileDetails.fileInfo, inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

export async function createChangeOfProvinceFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildChangeOfProvinceFileName(fileDetails);
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateChangeOfProvinceFile(sourceFilePath, fileDetails);

  const targetPath = buildSftpTarget(fileDetails.fileInfo, inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

export async function verifyTdafHandshakeFileExists(fileDetails: FileDetails): Promise<string> {
  const handshakeDir = path.join(env.sftpRoot, 'tdaf', 'handshake');

  const files = await fs.readdir(handshakeDir);

  const handshakePattern = /^Fiserv_HandShake_Batch_.*\.csv$/i;
  const matchingFiles = files.filter(f => handshakePattern.test(f));

  if (matchingFiles.length === 0) {
    throw new Error(
      `No handshake file found in ${handshakeDir}. ` +
      `Expected file pattern: Fiserv_HandShake_Batch_*.csv`
    );
  }

  const latestFile = matchingFiles.sort().reverse()[0];
  const fullPath = path.join(handshakeDir, latestFile);

  const exists = await pathExists(fullPath);
  if (!exists) {
    throw new Error(`Handshake file not found: ${fullPath}`);
  }

  console.log(`✓ Handshake file verified: ${latestFile}`);
  return fullPath;
}

export async function createGreenlightDischargeFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildGreenlightDischargeFileName();
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateGreenlightDischargeFile(sourceFilePath, fileDetails);

  const targetPath = path.join(env.sftpRoot, 'tdaf', 'in', inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

async function updateGreenlightDischargeFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  // Greenlight Discharge has special format:
  // Line 0: "RECORD COUNT:     0000000001" (keep as-is)
  // Line 1: "0000PARTNRREF RAQUEL EVARDO" (replace PARTNRREF with partner reference from cycle 1)

  // Replace partner reference in line 1
  if (lines.length >= 2 && fileDetails.partnerReference) {
    lines[1] = lines[1].replace(/PARTNRREF/g, fileDetails.partnerReference);
  }

  // For Greenlight Discharge, use the filename without extension as batch number (e.g., csrsdis.20260311)
  const fileName = path.basename(filePath, '.txt');
  fileDetails.batchNumber = fileName;

  await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
}

function buildBnsCommExternalFileName(): string {
  // Use same format as BNS_COMM NF
  return `xifdoc${formatAdjustedTimestamp()}.xml`;
}

async function updateBnsCommExternalFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');

  // Generate new partner reference
  const partnerRef = fileDetails.partnerReference || generateBmoInputFileName();
  fileDetails.partnerReference = partnerRef;
  console.log(`Generated Partner Reference: ${partnerRef}`);

  // Generate registration number in format: 6 digits + 1 letter (e.g., 223828A)
  if (!fileDetails.baseRegistrationNum) {
    const sixDigits = Math.floor(100000 + Math.random() * 900000); // Random 6-digit number
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // Random A-Z
    fileDetails.baseRegistrationNum = `${sixDigits}${letter}`;
  }
  const registrationNum = fileDetails.baseRegistrationNum;
  console.log(`Generated Registration Number: ${registrationNum}`);

  const batchNumber = generateBatchNumber();
  fileDetails.batchNumber = batchNumber;

  // Update Partner-Reference
  content = content.replace(/BNS_COMM_RefNum/g, partnerRef);

  // Update Registration-Number inside PPR block (hardcoded value 240607B)
  content = content.replace(
    /<Registration-Number>[^<]*<\/Registration-Number>/g,
    `<Registration-Number>${registrationNum}</Registration-Number>`
  );

  // Update PPR-Registration-Number (hardcoded value 240607A)
  content = content.replace(
    /<PPR-Registration-Number>[^<]*<\/PPR-Registration-Number>/g,
    `<PPR-Registration-Number>${registrationNum}</PPR-Registration-Number>`
  );

  // Update Batch Number
  content = content.replace(/<Batch Number="[^"]*">/g, `<Batch Number="${batchNumber}">`);

  console.log(`✓ Updated Registration-Number to: ${registrationNum}`);
  console.log(`✓ Updated PPR-Registration-Number to: ${registrationNum}`);
  console.log(`✓ Updated Batch Number to: ${batchNumber}`);

  await fs.writeFile(filePath, content, 'utf-8');
}

export async function createBnsCommExternalFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildBnsCommExternalFileName();
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateBnsCommExternalFile(sourceFilePath, fileDetails);

  const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

function buildBnsCommSearchFileName(): string {
  return `xifdoc${formatAdjustedTimestamp()}.xml`;
}

async function updateBnsCommSearchFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');

  // Generate new partner reference
  const partnerRef = fileDetails.partnerReference || generateBmoInputFileName();
  fileDetails.partnerReference = partnerRef;
  console.log(`Generated Partner Reference: ${partnerRef}`);

  const batchNumber = generateBatchNumber();
  fileDetails.batchNumber = batchNumber;

  // Update Partner-Reference
  content = content.replace(/<Partner-Reference>[^<]*<\/Partner-Reference>/g, `<Partner-Reference>${partnerRef}</Partner-Reference>`);

  // Update Batch Number
  content = content.replace(/<Batch Number="[^"]*">/g, `<Batch Number="${batchNumber}">`);

  console.log(`✓ Updated Partner-Reference to: ${partnerRef}`);
  console.log(`✓ Updated Batch Number to: ${batchNumber}`);

  await fs.writeFile(filePath, content, 'utf-8');
}

export async function createBnsCommSearchFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildBnsCommSearchFileName();
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateBnsCommSearchFile(sourceFilePath, fileDetails);

  const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

function buildBnsCommLookupFileName(): string {
  return `xifdoc${formatAdjustedTimestamp()}.xml`;
}

async function updateBnsCommLookupFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');

  const batchNumber = generateBatchNumber();
  fileDetails.batchNumber = batchNumber;

  // Extract existing registration number from the file for reference
  const regNumMatch = content.match(/<PPR-Registration-Number>([^<]*)<\/PPR-Registration-Number>/);
  if (regNumMatch && regNumMatch[1]) {
    fileDetails.baseRegistrationNum = regNumMatch[1].trim();
    console.log(`Using existing Registration Number: ${fileDetails.baseRegistrationNum}`);
  }

  // Update Batch Number only
  content = content.replace(/<Batch Number="[^"]*">/g, `<Batch Number="${batchNumber}">`);

  console.log(`✓ Updated Batch Number to: ${batchNumber}`);

  await fs.writeFile(filePath, content, 'utf-8');
}

export async function createBnsCommLookupFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildBnsCommLookupFileName();
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  await updateBnsCommLookupFile(sourceFilePath, fileDetails);

  const targetPath = path.join(env.sftpRoot, 'BNSCommercial', 'BNSXML', inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
}

// ─────────────────────────────────────────────────────────────────────────────
// GMFCL file creation
// ─────────────────────────────────────────────────────────────────────────────

async function updateGmfclFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  // Update batch number and partner reference in XIF file
  await updateBatchNumberInXifFile(filePath, fileDetails.batchNumber!);
  await updatePartnerReferenceInXifFile(filePath, fileDetails.partnerReference!);
}

export async function createGmfclNfFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildGmfclFileName();
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  // Generate batch number and partner reference
  fileDetails.batchNumber = generateBatchNumber();
  fileDetails.partnerReference = generateA8DigitReference();

  await updateGmfclFile(sourceFilePath, fileDetails);

  const targetPath = path.join(env.sftpRoot, 'GMFCLCR', 'in', inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
  console.log(`✓ GMFCL file created: ${inputFileName}`);
  console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
  console.log(`  Batch Number: ${fileDetails.batchNumber}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GMFCR file creation
// ─────────────────────────────────────────────────────────────────────────────

async function updateGmfcrFile(filePath: string, fileDetails: FileDetails): Promise<void> {
  // Update batch number and partner reference in XIF file
  await updateBatchNumberInXifFile(filePath, fileDetails.batchNumber!);
  await updatePartnerReferenceInXifFile(filePath, fileDetails.partnerReference!);
}

export async function createGmfcrNfFile(fileDetails: FileDetails): Promise<void> {
  const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
  await ensureDirectory(scenarioArtifactsDir);

  const inputFileName = buildGmfcrFileName();
  const sourceFilePath = path.join(scenarioArtifactsDir, inputFileName);
  await copyFile(fileDetails.sampleFile, sourceFilePath);

  // Generate batch number and partner reference
  fileDetails.batchNumber = generateBatchNumber();
  fileDetails.partnerReference = generateA8DigitReference();

  await updateGmfcrFile(sourceFilePath, fileDetails);

  const targetPath = path.join(env.sftpRoot, 'GMFCLCR', 'in', inputFileName);
  const targetDir = path.dirname(targetPath);
  await ensureDirectory(targetDir);
  await clearDirectory(targetDir);
  await copyFile(sourceFilePath, targetPath);
  fileDetails.inputFileName = inputFileName;
  console.log(`✓ GMFCR file created: ${inputFileName}`);
  console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
  console.log(`  Batch Number: ${fileDetails.batchNumber}`);
}

