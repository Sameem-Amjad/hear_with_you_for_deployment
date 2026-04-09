import { randomInt } from 'crypto';

export function generateSixDigitOtp(): string {
  return randomInt(100000, 1000000).toString();
}
