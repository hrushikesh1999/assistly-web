import { z } from "zod";
export const CUSTOMER_SESSION_KEY = "assistly.customerChat.v1";
const sessionSchema = z.object({
  conversation_id: z.string().uuid(),
  token: z.string().min(1),
  pendingMessage: z
    .object({
      request_id: z.string().uuid(),
      message: z.string().min(1).max(4000),
    })
    .optional(),
  uncertainActions: z.array(z.string().uuid()).default([]),
});
export type CustomerSession = z.infer<typeof sessionSchema>;
export function loadCustomerSession(): CustomerSession | null {
  try {
    const raw = sessionStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) return null;
    const value = sessionSchema.safeParse(JSON.parse(raw));
    return value.success ? value.data : null;
  } catch {
    return null;
  }
}
export function storeCustomerSession(session: CustomerSession | null) {
  if (session)
    sessionStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
}
