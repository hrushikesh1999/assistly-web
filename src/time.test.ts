import { describe, expect, it } from "vitest";
import { formatTime, localISO } from "./time";
describe("business timezone handling", () => {
  it("sends the business offset rather than the browser offset", () => {
    expect(localISO("2026-11-02T09:30", "Asia/Kolkata")).toBe(
      "2026-11-02T09:30:00.000+05:30",
    );
  });
  it("renders UTC timestamps in business time", () => {
    expect(formatTime("2026-11-02T04:00:00Z", "Asia/Kolkata")).toBe(
      "02 Nov 2026, 09:30",
    );
  });
  it("rejects invalid and nonexistent daylight-saving times", () => {
    expect(() => localISO("2026-03-08T02:30", "America/New_York")).toThrow();
    expect(() => localISO("invalid", "Asia/Kolkata")).toThrow();
  });
  it("requires an unambiguous daylight-saving time", () => {
    expect(() => localISO("2026-11-01T01:30", "America/New_York")).toThrow(
      "occurs twice",
    );
  });
});
