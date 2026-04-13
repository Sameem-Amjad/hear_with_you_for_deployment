export function parseRangeDays(range: string): number {
  const normalized = (range || '30d').toLowerCase().trim();
  const match = normalized.match(/^(\d+)d$/);
  if (!match) return 30;
  const days = Number(match[1]);
  if (Number.isNaN(days) || days <= 0) return 30;
  return Math.min(days, 365);
}

export function changePct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}
