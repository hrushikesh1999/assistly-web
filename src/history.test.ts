import { describe, expect, it, vi } from "vitest";
import { readMessagePages } from "./history";
describe("message history pagination", () => {
  it("drains full history pages using the last sequence as the next cursor", async () => {
    const page = Array.from({ length: 100 }, (_, i) => ({
      sequence: i + 10,
      role: "human",
      content: "message",
    }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([{ sequence: 123, role: "ai", content: "reply" }]);
    const rows = await readMessagePages(fetchPage, 4);
    expect(rows).toHaveLength(101);
    expect(fetchPage.mock.calls).toEqual([[4], [109]]);
    expect(rows.at(-1)?.sequence).toBe(123);
  });
});
