import type { Message } from "./types";
export async function readMessagePages(
  fetchPage: (after: number) => Promise<Message[]>,
  after = 0,
): Promise<Message[]> {
  const rows: Message[] = [];
  let cursor = after;
  for (;;) {
    const page = await fetchPage(cursor);
    rows.push(...page);
    if (page.length < 100) return rows;
    const next = page.at(-1)!.sequence;
    if (next <= cursor) return rows;
    cursor = next;
  }
}
