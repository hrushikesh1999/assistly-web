import { DateTime } from "luxon";
export function localISO(value: string, zone: string): string {
  const date = DateTime.fromISO(value, { zone });
  if (
    !date.isValid ||
    date.toFormat("yyyy-MM-dd'T'HH:mm") !== value.slice(0, 16)
  )
    throw new Error("Choose a valid local date and time.");
  if (date.getPossibleOffsets().length > 1)
    throw new Error(
      "This time occurs twice due to daylight saving. Choose another time.",
    );
  return date.toISO()!;
}
export const today = (zone: string) =>
  DateTime.now().setZone(zone).toISODate()!;
export const formatTime = (value: string, zone: string) =>
  DateTime.fromISO(value).setZone(zone).toFormat("dd LLL yyyy, HH:mm");
export const formatClock = (value: string, zone: string) =>
  DateTime.fromISO(value).setZone(zone).toFormat("HH:mm");
