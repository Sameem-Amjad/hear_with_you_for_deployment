import { Matches } from 'class-validator';

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export function IsStrongPassword() {
  return Matches(PASSWORD_REGEX, {
    message:
      'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character',
  });
}
