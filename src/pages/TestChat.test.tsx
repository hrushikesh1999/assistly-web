import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TestChat from "./TestChat";
import { saveChat } from "../chat-state";
import type { ChatSession } from "../types";
vi.mock("../data", () => ({
  useLabels: () => ({
    zone: "Asia/Kolkata",
    provider: "doctor",
    customer: "patient",
  }),
  useReferences: () => ({
    services: [],
    providers: [],
    customers: [],
    loading: false,
    error: null,
  }),
}));
vi.mock("../messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../messages")>()),
  useMessages: () => ({
    data: [],
    isPending: false,
    error: null,
    refetch: async () => ({}),
  }),
}));
const base: ChatSession = {
  conversation_id: "demo-conversation",
  token: "customer-token",
  actions: [],
  completed: [],
  uncertain: [],
  handoff: false,
};
function mount(session: ChatSession = base) {
  saveChat(session);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TestChat />
    </QueryClientProvider>,
  );
  return client;
}
describe("test-chat interactions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("never confirms a proposal automatically and blocks rapid duplicate confirmation", async () => {
    let finish: (value: Response) => void = () => {};
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        String(url).includes("/confirm")
          ? new Promise<Response>((resolve) => {
              finish = resolve;
            })
          : new Response("[]"),
      );
    mount({
      ...base,
      actions: [
        {
          id: "proposal",
          kind: "book",
          details: { starts_at: "2099-01-01T10:00:00Z" },
          expires_at: "2099-01-01T11:00:00Z",
        },
      ],
    });
    await screen.findByRole("button", { name: "Confirm booking" });
    expect(
      fetcher.mock.calls.filter(([url]) => String(url).includes("/confirm")),
    ).toHaveLength(0);
    const button = screen.getByRole("button", { name: "Confirm booking" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([url]) => String(url).includes("/confirm")),
      ).toHaveLength(1),
    );
    await act(async () => finish(new Response("{}")));
    await screen.findByText("Confirmed");
  });
  it("reuses the exact request ID and text when retrying a transport failure", async () => {
    let attempts = 0;
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        if (String(url).endsWith("/chat/messages")) {
          attempts++;
          if (attempts === 1) throw new Error("offline");
          return new Response(
            JSON.stringify({
              reply: "Hello",
              handoff_active: false,
              pending_actions: [],
            }),
          );
        }
        return new Response("[]");
      });
    mount();
    fireEvent.change(screen.getByLabelText("Message your assistant"), {
      target: { value: "Please help me book" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry message" }),
    );
    await waitFor(() => expect(attempts).toBe(2));
    const calls = fetcher.mock.calls.filter(([url]) =>
      String(url).endsWith("/chat/messages"),
    );
    expect(calls[0][1]?.body).toBe(calls[1][1]?.body);
    expect(new Headers(calls[1][1]?.headers).get("Authorization")).toBe(
      "Bearer customer-token",
    );
  });
  it("disables confirmation during human handoff", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("[]"),
    );
    mount({
      ...base,
      handoff: true,
      actions: [
        {
          id: "proposal",
          kind: "book",
          details: {},
          expires_at: "2099-01-01T11:00:00Z",
        },
      ],
    });
    expect(
      screen
        .getByRole("button", { name: "Confirm booking" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByText("Waiting for staff")).toBeDefined();
  });
  it("does not restore a customer token after logout while a message completes", async () => {
    let finish: (value: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).endsWith("/chat/messages")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : new Response("[]"),
    );
    mount();
    fireEvent.change(screen.getByLabelText("Message your assistant"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    cleanup();
    sessionStorage.clear();
    await act(async () =>
      finish(
        new Response(
          JSON.stringify({
            reply: "Hello",
            handoff_active: false,
            pending_actions: [],
          }),
        ),
      ),
    );
    expect(sessionStorage.getItem("assistly.testChat")).toBeNull();
  });
});
