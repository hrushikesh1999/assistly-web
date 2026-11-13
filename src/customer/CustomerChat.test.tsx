import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerChat from "./CustomerChat";
import App from "../App";
import { CUSTOMER_SESSION_KEY, storeCustomerSession } from "./session";
import type {
  ChatConfig,
  ConversationSnapshot,
  ActionView,
  AppointmentResult,
} from "./types";
import type { Message } from "../types";

const cid = "11111111-1111-4111-8111-111111111111";
const aid = "22222222-2222-4222-8222-222222222222";
const config: ChatConfig = {
  name: "Sample Care Clinic",
  timezone: "Asia/Kolkata",
  terminology: { provider: "doctor", customer: "patient" },
  enabled_capabilities: ["support", "sales", "appointments"],
};
const proposal: ActionView = {
  id: aid,
  kind: "book",
  details: {
    service_id: "service",
    provider_id: "provider",
    service_name: "General consultation",
    provider_name: "Dr. Demo",
    starts_at: "2099-01-01T09:00:00+05:30",
    ends_at: "2099-01-01T09:30:00+05:30",
    price: "500.00",
    currency: "INR",
  },
  expires_at: "2099-01-01T10:00:00Z",
  status: "pending",
  result: null,
  confirmed_at: null,
};
const result: AppointmentResult = {
  id: "booking",
  service_id: "service",
  provider_id: "provider",
  service_name: "General consultation",
  provider_name: "Dr. Demo",
  starts_at: proposal.details.starts_at!,
  ends_at: proposal.details.ends_at!,
  price: "500.00",
  currency: "INR",
  status: "booked",
};
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}
function savedSession() {
  storeCustomerSession({
    conversation_id: cid,
    token: "customer-only",
    uncertainActions: [],
  });
}
function server(initial?: ActionView) {
  const state = {
    snapshot: {
      conversation_id: cid,
      handoff_active: false,
      pending_actions: initial ? [initial] : [],
      actions: initial ? [initial] : [],
    } as ConversationSnapshot,
    messages: [] as Message[],
    sends: [] as string[],
    confirmations: 0,
    confirmationBody: undefined as unknown,
    busyMessage: false,
    failMessage: false,
    invalid: false,
    snapshotBusy: false,
    loseConfirmation: false,
    finishConfirm: null as null | (() => Promise<void>),
  };
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url, options) => {
      const path = new URL(String(url)).pathname;
      if (path === "/chat/config") return response(config);
      if (path === "/chat/conversations")
        return response({ conversation_id: cid, token: "customer-only" }, 201);
      if (state.invalid)
        return response({ detail: "Conversation not found" }, 404);
      if (path.endsWith("/messages") && options?.method !== "POST")
        return response(
          state.messages.filter(
            (m) =>
              m.sequence >
              Number(new URL(String(url)).searchParams.get("after") || 0),
          ),
        );
      if (path === `/chat/conversations/${cid}`)
        return state.snapshotBusy
          ? response({ detail: "Conversation is busy" }, 409)
          : response(state.snapshot);
      if (path === "/chat/messages") {
        state.sends.push(String(options?.body));
        if (state.busyMessage) {
          state.busyMessage = false;
          return response({ detail: "Conversation is busy; retry with the same request ID" }, 409);
        }
        if (state.failMessage) {
          state.failMessage = false;
          throw new Error("connection lost");
        }
        const body = JSON.parse(String(options?.body));
        state.messages.push({
          sequence: state.messages.length + 1,
          role: "human",
          content: body.message,
        });
        if (!state.snapshot.handoff_active)
          state.messages.push({
            sequence: state.messages.length + 1,
            role: "ai",
            content: "Hello from your assistant.",
          });
        return response({
          reply: state.snapshot.handoff_active
            ? null
            : "Hello from your assistant.",
          handoff_active: state.snapshot.handoff_active,
          pending_actions: state.snapshot.pending_actions,
        });
      }
      if (path.endsWith("/confirm")) {
        state.confirmations++;
        state.confirmationBody = options?.body ? JSON.parse(String(options.body)) : undefined;
        if (state.finishConfirm) await state.finishConfirm();
        state.snapshot = {
          ...state.snapshot,
          pending_actions: [],
          actions: [
            {
              ...proposal,
              status: "confirmed",
              confirmed_at: new Date().toISOString(),
              result,
            },
          ],
        };
        if (state.loseConfirmation) throw new Error("lost response");
        return response(result);
      }
      throw new Error("Unexpected API request: " + path);
    });
  return { state, fetcher };
}
function mount(route = false) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/chat"]}>
        {route ? <App /> : <CustomerChat />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
beforeEach(() => {
  sessionStorage.clear();
  Element.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("public customer chat", () => {
  it("loads /chat without login and never reads or sends admin credentials", async () => {
    sessionStorage.setItem("assistly.admin", "private-admin");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const { fetcher } = server();
    mount(true);
    await screen.findByRole("heading", { name: "How can we help you today?" });
    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(read.mock.calls.some(([key]) => key === "assistly.admin")).toBe(
      false,
    );
    expect(
      fetcher.mock.calls.every(([url]) =>
        new URL(String(url)).pathname.startsWith("/chat/"),
      ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.every(
        ([, options]) => !new Headers(options?.headers).has("Authorization"),
      ),
    ).toBe(true);
  });
  it("starts with the first message and reuses the original request on retry", async () => {
    sessionStorage.setItem("assistly.admin", "must-never-be-sent");
    const { state, fetcher } = server();
    state.failMessage = true;
    mount();
    await screen.findByRole("heading", { name: "How can we help you today?" });
    fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), {
      target: { value: "Can you help me?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry message" }),
    );
    await screen.findByText("Hello from your assistant.");
    expect(state.sends).toHaveLength(2);
    expect(state.sends[0]).toBe(state.sends[1]);
    expect(
      fetcher.mock.calls
        .filter(([url]) => String(url).endsWith("/chat/messages"))
        .every(
          ([, options]) =>
            new Headers(options?.headers).get("Authorization") ===
            "Bearer customer-only",
        ),
    ).toBe(true);
  });
  it("automatically retries a busy send with the same request", async () => {
    const { state } = server();
    state.busyMessage = true;
    mount();
    fireEvent.change(await screen.findByRole("textbox", { name: "Your message" }), {
      target: { value: "Can you help me?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Hello from your assistant.");
    expect(state.sends).toEqual([state.sends[0], state.sends[0]]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("restores private history and readable proposals, confirms only on click and prevents double clicks", async () => {
    savedSession();
    const { state } = server(proposal);
    state.messages = [
      { sequence: 1, role: "human", content: "Please book a consultation." },
    ];
    let resolve: () => void = () => {};
    state.finishConfirm = () =>
      new Promise<void>((r) => {
        resolve = r;
      });
    mount();
    await screen.findByText("Please book a consultation.");
    const button = await screen.findByRole("button", {
      name: "Confirm booking",
    });
    expect(screen.getByText("General consultation")).toBeDefined();
    expect(screen.getByText("Dr. Demo")).toBeDefined();
    expect(state.confirmations).toBe(0);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Patient name" }), {
      target: { value: " Maya Demo " },
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(state.confirmations).toBe(1));
    expect(state.confirmationBody).toEqual({ patient_name: "Maya Demo" });
    await act(async () => resolve());
    await screen.findAllByText("Booking confirmed");
  });
  it("checks authoritative outcome after a lost confirmation without making another booking", async () => {
    savedSession();
    const { state } = server(proposal);
    state.loseConfirmation = true;
    mount();
    fireEvent.change(await screen.findByRole("textbox", { name: "Patient name" }), {
      target: { value: "Maya Demo" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm booking" }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Check saved result" }).length,
      ).toBeGreaterThan(0),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Check saved result" })[0],
    );
    await screen.findAllByText("Booking confirmed");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Check saved result" }),
      ).toBeNull(),
    );
    expect(state.confirmations).toBe(1);
  });
  it("does not enable retry while a snapshot is busy", async () => {
    storeCustomerSession({
      conversation_id: cid,
      token: "customer-only",
      uncertainActions: [aid],
    });
    const { state } = server(proposal);
    state.snapshotBusy = true;
    mount();
    await screen.findByText("Let’s check your last change.");
    fireEvent.click(screen.getByRole("button", { name: "Check saved result" }));
    await screen.findByRole("alert");
    expect(
      JSON.parse(sessionStorage.getItem(CUSTOMER_SESSION_KEY)!)
        .uncertainActions,
    ).toEqual([aid]);
    expect(state.confirmations).toBe(0);
  });
  it("disables expired proposals", async () => {
    savedSession();
    server({
      ...proposal,
      status: "pending",
      expires_at: "2020-01-01T10:00:00Z",
    });
    mount();
    await screen.findByText("This proposal expired. Ask for a new one.");
    expect(
      screen.queryByRole("button", { name: "Confirm booking" }),
    ).toBeNull();
  });
  it("does not invent details for confirmations that predate saved results", async () => {
    savedSession();
    server({
      ...proposal,
      status: "confirmed",
      result: null,
      confirmed_at: null,
    });
    mount();
    await screen.findByText("Confirmed earlier. Detailed result unavailable.");
    expect(screen.queryByText("General consultation")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirm booking" }),
    ).toBeNull();
  });
  it("shows handoff, saves messages without AI replies and prevents confirmation", async () => {
    savedSession();
    const { state } = server(proposal);
    state.snapshot.handoff_active = true;
    mount();
    await screen.findByText("Your conversation has been handed over.");
    expect(
      screen
        .getByRole("button", { name: "Confirm booking" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), {
      target: { value: "A message for staff" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("A message for staff");
    expect(screen.queryByText("Hello from your assistant.")).toBeNull();
  });
  it("offers explicit recovery for invalid sessions without silently creating a new identity", async () => {
    savedSession();
    const { state, fetcher } = server();
    state.invalid = true;
    mount();
    await screen.findByText(/This session is no longer accessible/);
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(0);
    expect(sessionStorage.getItem(CUSTOMER_SESSION_KEY)).not.toBeNull();
  });
  it("confirms reset and clears only the public session", async () => {
    savedSession();
    server();
    sessionStorage.setItem("assistly.admin", "keep-admin");
    sessionStorage.setItem("assistly.testChat", "keep-test-chat");
    mount();
    await screen.findByRole("button", { name: "New chat" });
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await screen.findByRole("dialog", { name: "Start a new chat?" });
    expect(sessionStorage.getItem(CUSTOMER_SESSION_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start new chat" }));
    await screen.findByRole("heading", { name: "How can we help you today?" });
    expect(sessionStorage.getItem(CUSTOMER_SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem("assistly.admin")).toBe("keep-admin");
    expect(sessionStorage.getItem("assistly.testChat")).toBe("keep-test-chat");
  });
});
