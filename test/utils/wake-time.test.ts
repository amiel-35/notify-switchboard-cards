import { describe, expect, it } from "vitest";
import { minutesUntilWakeTime } from "../../src/utils/wake-time";

describe("minutesUntilWakeTime", () => {
  it("computes minutes until later today", () => {
    const now = new Date("2026-09-06T05:00:00");
    expect(minutesUntilWakeTime("07:00", now)).toBe(120);
  });

  it("rolls over to tomorrow when the wake time already passed", () => {
    const now = new Date("2026-09-06T08:00:00");
    expect(minutesUntilWakeTime("07:00", now)).toBe(23 * 60);
  });

  it("rolls over to tomorrow when the wake time is exactly now", () => {
    const now = new Date("2026-09-06T07:00:00");
    expect(minutesUntilWakeTime("07:00", now)).toBe(24 * 60);
  });

  it("returns null for a malformed wake time", () => {
    expect(minutesUntilWakeTime("not-a-time")).toBeNull();
    expect(minutesUntilWakeTime("25:00")).toBeNull();
    expect(minutesUntilWakeTime("07:60")).toBeNull();
  });
});
