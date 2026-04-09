import { Matches } from 'class-validator';

export const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function IsE164Phone() {
  return Matches(E164_REGEX, {
    message: 'Phone must be in E.164 format (e.g., +1234567890)',
  });
}
