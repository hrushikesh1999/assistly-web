import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { Message } from "../types";
export default function MessageList({
  messages,
  pending,
  sending,
}: {
  messages: Message[];
  pending?: string;
  sending: boolean;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const signature = `${messages.at(-1)?.sequence || 0}:${pending || ""}`;
  useEffect(() => {
    const element = scroll.current;
    if (element && following.current)
      element.scrollTo?.({
        top: element.scrollHeight,
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
      });
  }, [signature]);
  return (
    <div
      className="customer-message-list"
      ref={scroll}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions text"
      onScroll={(e) => {
        const element = e.currentTarget;
        following.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 100;
      }}
    >
      {messages
        .filter((m) => m.content && (m.role === "human" || m.role === "ai"))
        .map((message) => (
          <article
            className={`customer-message ${message.role === "human" ? "from-customer" : "from-assistant"}`}
            key={message.sequence}
          >
            {message.role === "ai" && (
              <span className="assistant-message-icon" aria-hidden="true">
                <MessageCircle size={14} />
              </span>
            )}
            <div>
              <span className="message-author">
                {message.role === "human" ? "You" : "Assistant"}
              </span>
              <p>{message.content}</p>
            </div>
          </article>
        ))}
      {pending && (
        <article className="customer-message from-customer pending-message">
          <div>
            <span className="message-author">
              {sending ? "Sending…" : "Awaiting retry"}
            </span>
            <p>{pending}</p>
          </div>
        </article>
      )}
      {sending && (
        <div className="customer-typing" role="status">
          <span />
          <span />
          <span />
          <span className="sr-only">Working on your message</span>
        </div>
      )}
    </div>
  );
}
