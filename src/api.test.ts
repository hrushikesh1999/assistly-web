import { beforeEach, describe, expect, it, vi } from "vitest";
import { allPages, api, ApiError, setAdminToken } from "./api";
describe("API authentication and errors", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });
  it("uses customer credentials independently of the admin token", async () => {
    setAdminToken("admin-only");
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("{}"));
    await api("/chat/messages", {}, { customerToken: "customer-only" });
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer customer-only");
    await api("/chat/conversations", {}, "public");
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).has("Authorization"),
    ).toBe(false);
  });
  it("clears the admin token and signals authentication expiry", async () => {
    setAdminToken("expired");
    const ended = vi.fn();
    window.addEventListener("assistly:expired", ended);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Expired" }), { status: 401 }),
    );
    await expect(api("/business")).rejects.toThrow("Expired");
    expect(sessionStorage.getItem("assistly.admin")).toBeNull();
    expect(ended).toHaveBeenCalledOnce();
    window.removeEventListener("assistly:expired", ended);
  });
  it("does not log an administrator out when a customer token fails", async () => {
    setAdminToken("valid-admin");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    await expect(
      api("/chat/messages", {}, { customerToken: "bad" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(sessionStorage.getItem("assistly.admin")).toBe("valid-admin");
  });
  it("preserves backend conflict explanations", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Slot already booked" }), {
        status: 409,
      }),
    );
    await expect(api("/appointments")).rejects.toMatchObject({
      status: 409,
      message: "Slot already booked",
    });
  });
  it("loads every page for related names", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(Array.from({ length: 200 }, (_, id) => ({ id }))),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 200 }])));
    expect(await allPages("/services")).toHaveLength(201);
    expect(fetcher.mock.calls[1][0]).toContain("offset=200");
  });
  it("reports connectivity failures without leaking request details", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("private transport detail"),
    );
    await expect(api("/business")).rejects.toMatchObject({
      status: 0,
      message: "Cannot reach the server. Check your connection and try again.",
    });
  });
});
