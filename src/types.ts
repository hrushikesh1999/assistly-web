export interface RecordBase {
  id: string;
  created_at: string;
}
export type Capability = "support" | "sales" | "appointments";
export interface Business {
  id: number;
  name: string;
  timezone: string;
  details: Record<string, unknown>;
  terminology: Record<string, unknown>;
  instructions: string;
  enabled_capabilities: Capability[];
}
export interface Service extends RecordBase {
  name: string;
  description: string;
  duration_minutes: number;
  price: string | number;
  currency: string;
  active: boolean;
}
export interface Provider extends RecordBase {
  name: string;
  active: boolean;
  service_ids: string[];
}
export interface Customer extends RecordBase {
  name: string | null;
  contact: string | null;
}
export interface Appointment extends RecordBase {
  customer_id: string;
  service_id: string;
  provider_id: string;
  starts_at: string;
  ends_at: string;
  status: "booked" | "cancelled";
}
export interface Hours {
  id?: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
}
export interface Exception extends RecordBase {
  provider_id: string;
  starts_at: string;
  ends_at: string;
  available: boolean;
}
export interface Lead extends RecordBase {
  customer_id: string;
  interest: string;
  status: "new" | "contacted" | "qualified" | "closed";
}
export interface Conversation extends RecordBase {
  customer_id: string;
  channel: string;
  handoff_active: boolean;
  handoff_reason: string | null;
}
export interface Message {
  id?: string;
  sequence: number;
  role: string;
  content: string;
  created_at?: string;
}
export interface FAQ extends RecordBase {
  question: string;
  answer: string;
}
export interface KnowledgeDocument extends RecordBase {
  name: string;
  status: string;
}
export interface SearchResult {
  source: string;
  id?: string;
  chunk_id?: string;
  content: string;
}
export interface Slot {
  starts_at: string;
  ends_at: string;
}
export interface PendingAction {
  id: string;
  kind: "book" | "reschedule" | "cancel";
  details: Record<string, string>;
  expires_at: string;
}
export interface ChatResponse {
  reply: string | null;
  handoff_active: boolean;
  pending_actions: PendingAction[];
}
export interface ChatSession {
  conversation_id: string;
  token: string;
  actions: PendingAction[];
  handoff: boolean;
  completed: string[];
  uncertain: string[];
  attempts?: Record<string, number>;
  pendingMessage?: { request_id: string; message: string };
}
