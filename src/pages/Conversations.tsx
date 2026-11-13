import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, RefreshCw } from "lucide-react";
import { api, json } from "../api";
import { useLabels, useReferences } from "../data";
import { useMessages } from "../messages";
import { formatTime } from "../time";
import type { Conversation } from "../types";
import {
  Badge,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeader,
  Submit,
  usePage,
} from "../ui";
export default function Conversations() {
  const query = usePage<Conversation>("/conversations");
  const refs = useReferences();
  const labels = useLabels();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [internal, setInternal] = useState(false);
  const cache = useQueryClient();
  const messages = useMessages(selected?.id);
  const refetchList = query.refetch;
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refetchList();
    }, 5000);
    return () => clearInterval(timer);
  }, [selected, refetchList]);
  const current = query.data?.find((c) => c.id === selected?.id) || selected;
  return (
    <>
      <PageHeader
        title="Conversations"
        description="Review conversations and manage requests for human help."
        action={
          <button onClick={() => query.refetch()}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      <ErrorNotice error={query.error || refs.error} />
      <div className="conversation-layout">
        <section className="panel conversation-list">
          <div className="panel-heading">
            <h2 id="conversation-list-heading">Customer conversations</h2>
          </div>
          {query.isPending ? (
            <Loading />
          ) : !query.data?.length ? (
            <Empty>
              Conversations will appear here when customers start chatting.
            </Empty>
          ) : (
            <div
              className="conversation-items"
              role="region"
              aria-labelledby="conversation-list-heading"
              tabIndex={0}
            >
              {query.data.map((c) => {
                const customer = refs.customers.find(
                  (r) => r.id === c.customer_id,
                );
                return (
                  <button
                    className={`conversation-item ${selected?.id === c.id ? "selected" : ""}`}
                    key={c.id}
                    onClick={() => setSelected(c)}
                  >
                    <span className="contact-avatar">
                      {customer?.name?.slice(0, 1) || "?"}
                    </span>
                    <span>
                      <strong>
                        {customer?.name ||
                          customer?.contact ||
                          "Guest conversation"}
                      </strong>
                      <small>{formatTime(c.created_at, labels.zone)}</small>
                      <Badge tone={c.handoff_active ? "amber" : "green"}>
                        {c.handoff_active ? "Needs staff" : "AI active"}
                      </Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {query.pagination}
        </section>
        <section className="panel conversation-detail">
          {!current ? (
            <div className="conversation-placeholder">
              <MessagesSquare size={36} />
              <h2>A conversation tells the story</h2>
              <p>Select one to read its history and manage handoff.</p>
            </div>
          ) : (
            <>
              <div className="panel-heading">
                <div>
                  <h2>
                    {refs.customers.find((c) => c.id === current.customer_id)
                      ?.name || "Guest conversation"}
                  </h2>
                  <span className="quiet small">
                    {current.channel} · {current.id.slice(0, 8)}
                  </span>
                </div>
                <button onClick={() => setHandoff(true)}>
                  {current.handoff_active ? "Resume AI" : "Pause for staff"}
                </button>
              </div>
              {current.handoff_active && (
                <div className="handoff-banner">
                  <strong>AI replies are paused</strong>
                  <p>{current.handoff_reason || "Staff handoff is active."}</p>
                  <small>
                    Customer messages are saved. Staff replies are not available
                    in this version.
                  </small>
                </div>
              )}
              <div className="message-toolbar">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />{" "}
                  Show tool history
                </label>
                <button
                  className="icon-button"
                  aria-label="Refresh messages"
                  onClick={() => messages.refetch()}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <ErrorNotice error={messages.error} />
              <div
                className="message-history"
                role="region"
                aria-label="Message history"
                aria-live="polite"
                tabIndex={0}
              >
                {messages.isPending ? (
                  <Loading />
                ) : !messages.data?.length ? (
                  <Empty>No messages yet.</Empty>
                ) : (
                  messages.data
                    .filter(
                      (m) =>
                        internal ||
                        ((m.role === "human" || m.role === "ai") && m.content),
                    )
                    .map((m) => (
                      <article
                        key={m.sequence}
                        className={`message ${m.role === "human" ? "human" : m.role === "ai" ? "assistant" : "tool"}`}
                      >
                        <small>
                          {m.role === "human"
                            ? labels.customer
                            : m.role === "ai"
                              ? "Assistant"
                              : m.role}
                        </small>
                        <p>{m.content || "(tool request)"}</p>
                      </article>
                    ))
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {handoff && current && (
        <Handoff
          conversation={current}
          close={() => setHandoff(false)}
          saved={async () => {
            await cache.invalidateQueries();
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
function Handoff({
  conversation,
  close,
  saved,
}: {
  conversation: Conversation;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        conversation.handoff_active ? "Resume assistant?" : "Pause AI for staff"
      }
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError(undefined);
          try {
            await api(
              `/conversations/${conversation.id}/handoff`,
              json("PUT", {
                active: !conversation.handoff_active,
                reason: conversation.handoff_active
                  ? null
                  : String(data.get("reason") || ""),
              }),
            );
            await saved();
            close();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {conversation.handoff_active ? (
          <p>
            New customer messages will receive AI responses again. Messages
            received during the pause will remain in history.
          </p>
        ) : (
          <>
            <p>Customer messages will be saved while AI replies are paused.</p>
            <Field label="Reason">
              <textarea name="reason" maxLength={1000} rows={3} />
            </Field>
          </>
        )}
        <ErrorNotice error={error} />
        <div className="form-actions">
          <Submit busy={busy}>
            {conversation.handoff_active ? "Resume AI" : "Pause AI"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
