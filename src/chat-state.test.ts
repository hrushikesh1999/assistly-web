import { beforeEach, describe, expect, it } from "vitest";
import {
  canConfirm,
  confirmedMessage,
  loadChat,
  saveChat,
  matchesConfirmedAppointment,
} from "./chat-state";
import type { Appointment, ChatSession, PendingAction } from "./types";
const action: PendingAction = {
  id: "proposal",
  kind: "book",
  details: {
    service_id: "service",
    provider_id: "provider",
    starts_at: "2026-11-01T10:00:00+05:30",
  },
  expires_at: "2026-11-01T10:00:00Z",
};
const session: ChatSession = {
  conversation_id: "conversation",
  token: "opaque",
  actions: [action],
  completed: [],
  uncertain: [],
  handoff: false,
};
describe("explicit customer confirmation", () => {
  beforeEach(() => sessionStorage.clear());
  it("requires authoritative appointment state and ownership when reconciling a result", () => {
    const appointment: Appointment = {
      id: "booking",
      customer_id: "owner",
      service_id: "service",
      provider_id: "provider",
      starts_at: action.details.starts_at,
      ends_at: "2026-11-01T10:30:00+05:30",
      status: "booked",
      created_at: "",
    };
    expect(matchesConfirmedAppointment(action, appointment, "owner")).toBe(
      true,
    );
    expect(
      matchesConfirmedAppointment(action, appointment, "another-customer"),
    ).toBe(false);
    expect(
      matchesConfirmedAppointment(
        action,
        { ...appointment, provider_id: "different-provider" },
        "owner",
      ),
    ).toBe(false);
    expect(
      matchesConfirmedAppointment(
        action,
        { ...appointment, status: "cancelled" },
        "owner",
      ),
    ).toBe(false);
  });
  it("requires an unexpired, unused action and an idle, active session", () => {
    const now = Date.parse("2026-11-01T09:55:00Z");
    expect(canConfirm(action, session, false, now)).toBe(true);
    expect(canConfirm(action, session, true, now)).toBe(false);
    expect(canConfirm(action, { ...session, handoff: true }, false, now)).toBe(
      false,
    );
    expect(
      canConfirm(action, { ...session, completed: [action.id] }, false, now),
    ).toBe(false);
    expect(
      canConfirm(action, { ...session, uncertain: [action.id] }, false, now),
    ).toBe(false);
    expect(
      canConfirm(action, session, false, Date.parse(action.expires_at)),
    ).toBe(false);
  });
  it("restores the same request ID/text and uncertain confirmation across reloads", () => {
    saveChat({
      ...session,
      pendingMessage: { request_id: "stable-id", message: "Book please" },
      uncertain: ["proposal"],
      attempts: { proposal: 45 },
    });
    expect(loadChat()?.pendingMessage).toEqual({
      request_id: "stable-id",
      message: "Book please",
    });
    expect(loadChat()?.uncertain).toEqual(["proposal"]);
    expect(loadChat()?.attempts?.proposal).toBe(45);
  });
  it("ignores confirmation text from before the current attempt", () => {
    const message = {
      sequence: 9,
      role: "ai",
      content: "Appointment book confirmed. Reference: booking.",
    };
    expect(confirmedMessage(action, [message], 10)).toBeUndefined();
    expect(
      confirmedMessage(action, [{ ...message, sequence: 11 }], 10),
    ).toBeDefined();
  });
  it("matches the appointment for rescheduling and cancellation", () => {
    const cancellation = {
      ...action,
      kind: "cancel" as const,
      details: { appointment_id: "owned-booking" },
    };
    expect(
      confirmedMessage(
        cancellation,
        [
          {
            sequence: 12,
            role: "ai",
            content: "Appointment cancel confirmed. Reference: other-booking.",
          },
        ],
        10,
      ),
    ).toBeUndefined();
  });
});
