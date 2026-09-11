import { describe, expect, it } from "vitest";
import { combineLocalDateAndTime, getSlotDurationMinutes, getUpcomingLocalDates, toLocalDateInputValue } from "../src/lib/booking";

describe("booking date rules", () => {
  it("keeps calendar values in local time", () => {
    const source = new Date(2026, 8, 11, 23, 45);
    expect(toLocalDateInputValue(source)).toBe("2026-09-11");
    expect(getUpcomingLocalDates(3, source)).toEqual(["2026-09-11", "2026-09-12", "2026-09-13"]);
  });

  it("combines validated local dates and times", () => {
    const date = combineLocalDateAndTime("2026-09-11", "14:30:00");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(11);
    expect(date.getHours()).toBe(14);
    expect(() => combineLocalDateAndTime("invalid", "14:30")).toThrow();
  });

  it("calculates slot duration", () => {
    expect(getSlotDurationMinutes({ startTime: "09:00:00", endTime: "10:15:00", isAvailable: true })).toBe(75);
  });
});
