/**
 * Helpers for <input type="datetime-local"> and close-at display.
 * API timestamps are UTC; datetime-local uses the viewer's local wall clock.
 */

/** Fill a datetime-local input from an ISO / API string (local YYYY-MM-DDTHH:mm). */
export function formatForDatetimeLocal(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Send datetime-local value to the API as ISO UTC. */
export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

function startOfLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar days from local today to the close instant's local calendar day. */
export function calendarDaysUntilClose(dateStr: string): number {
  const close = new Date(dateStr);
  if (Number.isNaN(close.getTime())) return 0;
  const now = new Date();
  return Math.round(
    (startOfLocalDayMs(close) - startOfLocalDayMs(now)) / 86400000,
  );
}
