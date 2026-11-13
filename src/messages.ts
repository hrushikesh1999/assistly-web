import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Message } from "./types";
import { readMessagePages } from "./history";
export async function readMessages(
  id: string,
  customerToken?: string,
  after = 0,
): Promise<Message[]> {
  return readMessagePages(
    (cursor) =>
      api<Message[]>(
        `${customerToken ? "/chat" : ""}/conversations/${id}/messages?after=${cursor}`,
        {},
        customerToken ? { customerToken } : "admin",
      ),
    after,
  );
}
export function useMessages(id?: string, customerToken?: string) {
  const cache = useQueryClient();
  const key = ["messages", customerToken ? "customer" : "admin", id];
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const previous = cache.getQueryData<Message[]>(key) || [];
      const rows = await readMessages(
        id!,
        customerToken,
        previous.at(-1)?.sequence || 0,
      );
      return [
        ...previous,
        ...rows.filter((r) => !previous.some((p) => p.sequence === r.sequence)),
      ];
    },
    enabled: !!id,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}
