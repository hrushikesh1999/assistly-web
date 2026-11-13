import { ApiError, request } from "./transport";
export { ApiError, json, API_URL } from "./transport";
const ADMIN_KEY = "assistly.admin";
export const CHAT_KEY = "assistly.testChat";
export const adminToken = () => sessionStorage.getItem(ADMIN_KEY);
export function setAdminToken(token: string | null) {
  if (token) sessionStorage.setItem(ADMIN_KEY, token);
  else sessionStorage.removeItem(ADMIN_KEY);
}
type Auth = "admin" | "public" | { customerToken: string };
export async function api<T>(
  path: string,
  options: RequestInit = {},
  auth: Auth = "admin",
): Promise<T> {
  const token =
    auth === "admin"
      ? adminToken()
      : typeof auth === "object"
        ? auth.customerToken
        : undefined;
  try {
    return await request<T>(path, options, token || undefined);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && auth === "admin") {
      setAdminToken(null);
      window.dispatchEvent(new Event("assistly:expired"));
    }
    throw error;
  }
}
export async function allPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await api<T[]>(`${path}?limit=200&offset=${offset}`);
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}
