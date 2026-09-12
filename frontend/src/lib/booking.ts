import type { AvailabilitySlotDto } from "./api";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getUpcomingLocalDates(count: number, from = new Date()): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, offset) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset, 12);
    return toLocalDateInputValue(date);
  });
}

export function combineLocalDateAndTime(dateValue: string, timeValue: string): Date {
  if (!DATE_PATTERN.test(dateValue) || !TIME_PATTERN.test(timeValue)) {
    throw new Error("The selected booking date or time is invalid.");
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes, seconds = 0] = timeValue.split(":").map(Number);
  const result = new Date(year, month - 1, day, hours, minutes, seconds, 0);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hours ||
    result.getMinutes() !== minutes
  ) {
    throw new Error("The selected booking date or time is invalid.");
  }

  return result;
}

export function getSlotDurationMinutes(slot: AvailabilitySlotDto): number {
  const referenceDate = "2000-01-01";
  const start = combineLocalDateAndTime(referenceDate, slot.startTime);
  let end = combineLocalDateAndTime(referenceDate, slot.endTime);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

// The current .NET contract exposes offset-less schedule times (TimeSpan +
// DateTime). Preserve the selected wall-clock slot instead of shifting it to UTC.
export function toScheduleDateTime(date: string, time: string): string {
  combineLocalDateAndTime(date, time);
  return `${date}T${time.length === 5 ? time + ":00" : time}`;
}
