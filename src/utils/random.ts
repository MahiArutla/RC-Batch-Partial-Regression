import crypto from 'crypto';

function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const randomBytes = crypto.randomBytes(bytesNeeded);
  let value = 0;
  for (let i = 0; i < bytesNeeded; i += 1) {
    value = (value << 8) + randomBytes[i];
  }
  return min + (value % range);
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
