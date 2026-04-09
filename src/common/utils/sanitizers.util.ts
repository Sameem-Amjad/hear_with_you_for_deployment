export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, '');
}

export function sanitizeUsername(username: string): string {
  return username.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function trimString(value: string): string {
  return value.trim();
}

export function stripSensitiveFields<T extends Record<string, unknown>>(
  payload: T,
): Partial<T> {
  const sensitiveKeys = new Set([
    'password',
    'confirmPassword',
    'newPassword',
    'otp',
    'idToken',
    'passwordHash',
  ]);
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !sensitiveKeys.has(key)),
  ) as Partial<T>;
}
