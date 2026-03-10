/** Convert a date string to local YYYY-MM-DD */
export function toLocalDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get today's date as local YYYY-MM-DD */
export function todayKey(): string {
  return toLocalDateKey(new Date().toISOString());
}
