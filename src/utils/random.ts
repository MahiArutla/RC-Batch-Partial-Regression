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
