import fs from 'fs/promises';
import path from 'path';

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
