import type { Capability } from "../types";
export interface ChatConfig {
  name: string;
  timezone: string;
  terminology: Record<string, string>;
  enabled_capabilities: Capability[];
}
export interface ActionDetails {
  service_id?: string | null;
  provider_id?: string | null;
  appointment_id?: string | null;
  starts_at?: string | null;
  previous_starts_at?: string | null;
  service_name: string | null;
  provider_name: string | null;
  ends_at: string | null;
  price: string | null;
  currency: string | null;
}
export interface AppointmentResult {
  id: string;
  service_id: string;
  provider_id: string;
  service_name: string | null;
  provider_name: string | null;
  starts_at: string;
  ends_at: string;
  status: "booked" | "cancelled";
  price: string | null;
  currency: string | null;
}
export interface ActionView {
  id: string;
  kind: "book" | "reschedule" | "cancel";
  details: ActionDetails;
  expires_at: string;
  status: "pending" | "expired" | "confirmed";
  confirmed_at: string | null;
  result: AppointmentResult | null;
}
export interface ConversationSnapshot {
  conversation_id: string;
  handoff_active: boolean;
  pending_actions: ActionView[];
  actions: ActionView[];
}
export interface CustomerReply {
  reply: string | null;
  handoff_active: boolean;
  pending_actions: ActionView[];
}
