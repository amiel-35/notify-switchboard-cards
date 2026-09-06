/**
 * Computes the number of whole minutes from `now` until the next
 * occurrence of `wakeTime` (a "HH:MM" 24h string). If that time has
 * already passed today, the result rolls over to tomorrow.
 *
 * Returns `null` when `wakeTime` is not a valid "HH:MM" string.
 */
export function minutesUntilWakeTime(wakeTime: string, now: Date = new Date()): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(wakeTime.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
}
