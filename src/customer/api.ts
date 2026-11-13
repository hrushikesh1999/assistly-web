import { json, request } from "../transport";
import type { Message } from "../types";
import type { ChatConfig, ConversationSnapshot, CustomerReply } from "./types";
import type { CustomerSession } from "./session";
import { readMessagePages } from "../history";

// This module intentionally has no access to admin authentication or storage.
export const customerApi = {
  config: () => request<ChatConfig>("/chat/config"),
  create: () =>
    request<{ conversation_id: string; token: string }>(
      "/chat/conversations",
      json("POST", {}),
    ),
  snapshot: (session: CustomerSession) =>
    request<ConversationSnapshot>(
      `/chat/conversations/${session.conversation_id}`,
      {},
      session.token,
    ),
  send: (
    session: CustomerSession,
    pending: NonNullable<CustomerSession["pendingMessage"]>,
  ) =>
    request<CustomerReply>(
      "/chat/messages",
      json("POST", { conversation_id: session.conversation_id, ...pending }),
      session.token,
    ),
  confirm: (session: CustomerSession, actionId: string, patientName?: string) =>
    request<unknown>(
      `/chat/conversations/${session.conversation_id}/actions/${actionId}/confirm`,
      json("POST", patientName ? { patient_name: patientName } : undefined),
      session.token,
    ),
  history: (session: CustomerSession, after = 0) =>
    readMessagePages(
      (cursor) =>
        request<Message[]>(
          `/chat/conversations/${session.conversation_id}/messages?after=${cursor}`,
          {},
          session.token,
        ),
      after,
    ),
};
