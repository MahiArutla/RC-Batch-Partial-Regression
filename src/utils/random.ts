import crypto from 'crypto';

function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

export function generateBatchNumber(): string {
  return randomInt(10_000_000, 99_999_999).toString();
}

export function generatePartnerReference(): string {
  const part = () => randomInt(10_000, 99_999).toString();
  const suffix = randomInt(1_000, 9_999).toString();
  return `${part()}-${suffix}-${suffix}`;
}

export function generateA8DigitReference(): string {
  return `Smoke${randomInt(10_000_000, 99_999_999)}`;
}

export function generateBmoInputFileName(): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 12);
  const digit = randomInt(0, 9);
  return `I${timestamp}${digit}`;
}

export function generateBcRegistrationNumber(): string {
  const length = 7;
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += randomInt(0, 9).toString();
  }
  return `${value}A`;
}

export function generateFordReference(): string {
  const fiveDigits = randomInt(10_000, 99_999).toString();
  return `2AASM${fiveDigits}`;
}

export function generateTdafReference(): string {
  return `S${randomInt(10_000_000, 99_999_999)}`;
}

export function generateVwReference(): string {
  return `VW${randomInt(10_000_000, 99_999_999)}`;
}

export function generateVin(make: string = 'VW'): string {
  // Generate a VIN for Volkswagen (3VV prefix for VW manufactured in Mexico)
  // Format: 3VV + 5 chars (model/trim) + check digit + model year + plant + 6-digit serial
  const now = new Date();
  const year = now.getFullYear() % 10; // Last digit of year (e.g., 2026 -> 6)
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  // Use timestamp-based serial for uniqueness: YYMMDDHHMI (10 digits, take last 6)
  const timestampSerial = `${year}${month}${day}${hours}${minutes}`.slice(-6);

  if (make.toUpperCase() === 'VW' || make.toUpperCase() === 'VOLKSWAGEN') {
    // 3VV = Volkswagen manufactured in Mexico
    // 8B7AX = Model identifier (e.g., Tiguan)
    // 7 = Check digit placeholder
    // R = Model year (R = 2024, S = 2025, T = 2026, etc.)
    const modelYears: Record<number, string> = { 4: 'R', 5: 'S', 6: 'T', 7: 'V', 8: 'W', 9: 'X' };
    const modelYearCode = modelYears[year] || 'T';
    // M = Plant code
    return `3VV8B7AX${modelYearCode}RM${timestampSerial}`;
  }

  // Generic VIN format for other makes
  return `1XX${randomInt(10_000, 99_999)}${year}X${timestampSerial}`;
}
