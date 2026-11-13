import { CHAT_KEY } from "./api";
import type { Appointment, ChatSession, Message, PendingAction } from "./types";
export function loadChat(): ChatSession | null {
  try {
    const raw = sessionStorage.getItem(CHAT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value.conversation_id === "string" &&
      typeof value.token === "string" &&
      Array.isArray(value.actions) &&
      Array.isArray(value.completed) &&
      Array.isArray(value.uncertain)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveChat(session: ChatSession | null) {
  if (session) sessionStorage.setItem(CHAT_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(CHAT_KEY);
}
export function matchesConfirmedAppointment(
  action: PendingAction,
  appointment: Appointment,
  customerId: string,
) {
  if (appointment.customer_id !== customerId) return false;
  if (action.kind === "cancel")
    return (
      appointment.id === action.details.appointment_id &&
      appointment.status === "cancelled"
    );
  if (
    appointment.status !== "booked" ||
    Date.parse(appointment.starts_at) !== Date.parse(action.details.starts_at)
  )
    return false;
  return action.kind === "reschedule"
    ? appointment.id === action.details.appointment_id
    : appointment.service_id === action.details.service_id &&
        appointment.provider_id === action.details.provider_id;
}
export function canConfirm(
  action: PendingAction,
  session: ChatSession,
  busy: boolean,
  now = Date.now(),
) {
  return (
    !busy &&
    !session.handoff &&
    !session.completed.includes(action.id) &&
    !session.uncertain.includes(action.id) &&
    new Date(action.expires_at).getTime() > now
  );
}
export function confirmedMessage(
  action: PendingAction,
  messages: Message[],
  after: number,
) {
  return messages.find(
    (m) =>
      m.sequence > after &&
      m.role === "ai" &&
      m.content.startsWith(
        `Appointment ${action.kind} confirmed. Reference: `,
      ) &&
      (!action.details.appointment_id ||
        m.content.includes(action.details.appointment_id)),
  );
}
