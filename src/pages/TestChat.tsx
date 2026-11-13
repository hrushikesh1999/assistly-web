import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  FlaskConical,
  RefreshCw,
  RotateCcw,
  MessageCircle,
} from "lucide-react";
import { allPages, api, ApiError, json } from "../api";
import {
  canConfirm,
  confirmedMessage,
  loadChat,
  matchesConfirmedAppointment,
  saveChat,
} from "../chat-state";
import { useLabels, useReferences } from "../data";
import { readMessages, useMessages } from "../messages";
import { formatTime } from "../time";
import type {
  Appointment,
  ChatResponse,
  ChatSession,
  Conversation,
  PendingAction,
} from "../types";
import {
  Badge,
  Confirm,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  PageHeader,
  Submit,
} from "../ui";
export default function TestChat() {
  const [session, setSession] = useState<ChatSession | null>(loadChat);
  const currentRef = useRef(session);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<unknown>();
  const [draft, setDraft] = useState("");
  const [reset, setReset] = useState(false);
  const [now, setNow] = useState(Date.now());
  const end = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const refs = useReferences();
  const labels = useLabels();
  const messages = useMessages(session?.conversation_id, session?.token);
  const conversations = useQuery({
    queryKey: ["test-conversations", session?.conversation_id],
    queryFn: () => allPages<Conversation>("/conversations"),
    enabled: !!session,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
  const update = (next: ChatSession | null) => {
    if (!mounted.current) return;
    currentRef.current = next;
    saveChat(next);
    setSession(next);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.data?.length]);
  useEffect(() => {
    const conversation = conversations.data?.find(
      (c) => c.id === currentRef.current?.conversation_id,
    );
    if (
      conversation &&
      currentRef.current &&
      conversation.handoff_active !== currentRef.current.handoff
    ) {
      const next = {
        ...currentRef.current,
        handoff: conversation.handoff_active,
      };
      currentRef.current = next;
      saveChat(next);
      setSession(next);
    }
  }, [conversations.data]);
  const beginBusy = () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };
  const endBusy = () => {
    busyRef.current = false;
    setBusy(false);
  };
  const refresh = async () => {
    if (!mounted.current) return;
    await cache.invalidateQueries();
    await messages.refetch();
  };
  const send = async (retry = false) => {
    const current = currentRef.current;
    if (!current || !beginBusy()) return;
    const pending = retry
      ? current.pendingMessage
      : { request_id: crypto.randomUUID(), message: draft.trim() };
    if (!pending?.message) {
      endBusy();
      return;
    }
    update({ ...current, pendingMessage: pending });
    setDraft("");
    setError(undefined);
    try {
      const response = await api<ChatResponse>(
        "/chat/messages",
        json("POST", { conversation_id: current.conversation_id, ...pending }),
        { customerToken: current.token },
      );
      const latest = currentRef.current!;
      update({
        ...latest,
        pendingMessage: undefined,
        handoff: response.handoff_active,
        actions: response.handoff_active
          ? latest.actions
          : response.pending_actions,
      });
      await refresh();
      if (
        !response.reply?.trim() &&
        !response.handoff_active &&
        !response.pending_actions.length
      )
        setError(
          new Error(
            "The assistant returned no answer. Please rephrase your message or check the conversation history.",
          ),
        );
    } catch (err) {
      setError(err);
    } finally {
      endBusy();
    }
  };
  const reconcile = async (action: PendingAction) => {
    const current = currentRef.current!;
    const after = current.attempts?.[action.id] || 0;
    const history = await readMessages(
      current.conversation_id,
      current.token,
      after,
    );
    const hint = confirmedMessage(action, history, after);
    const [savedAppointments, savedConversations] = await Promise.all([
      allPages<Appointment>("/appointments"),
      allPages<Conversation>("/conversations"),
    ]);
    const customerId = savedConversations.find(
      (row) => row.id === current.conversation_id,
    )?.customer_id;
    const reference = hint?.content.match(/Reference: ([0-9a-f-]{36})\./i)?.[1];
    const confirmed =
      !!customerId &&
      savedAppointments.some(
        (row) =>
          row.id === reference &&
          matchesConfirmedAppointment(action, row, customerId),
      );
    const latest = currentRef.current!;
    update({
      ...latest,
      uncertain: latest.uncertain.filter((id) => id !== action.id),
      completed: confirmed
        ? [...new Set([...latest.completed, action.id])]
        : latest.completed,
    });
    await refresh();
    return !!confirmed;
  };
  const confirm = async (action: PendingAction) => {
    const current = currentRef.current;
    if (
      !current ||
      !canConfirm(action, current, busyRef.current) ||
      !beginBusy()
    )
      return;
    setError(undefined);
    update({
      ...current,
      uncertain: [...new Set([...current.uncertain, action.id])],
      attempts: {
        ...current.attempts,
        [action.id]: messages.data?.at(-1)?.sequence || 0,
      },
    });
    try {
      await api(
        `/chat/conversations/${current.conversation_id}/actions/${action.id}/confirm`,
        json("POST"),
        { customerToken: current.token },
      );
      const latest = currentRef.current!;
      update({
        ...latest,
        uncertain: latest.uncertain.filter((id) => id !== action.id),
        completed: [...new Set([...latest.completed, action.id])],
      });
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status > 0 && err.status < 500) {
        try {
          const found = await reconcile(action);
          if (!found) setError(err);
        } catch {
          setError(
            new Error(
              "Could not verify the result. Check the saved result before trying again.",
            ),
          );
        }
      } else
        setError(
          new Error(
            "The confirmation result is uncertain. Check the saved result before trying again.",
          ),
        );
    } finally {
      endBusy();
    }
  };
  return (
    <>
      <PageHeader
        title="Test chat"
        description="Try the customer experience, right here in your workspace."
        action={
          session && (
            <button
              onClick={() => setReset(true)}
              disabled={
                busy || !!session.pendingMessage || !!session.uncertain.length
              }
            >
              <RotateCcw size={16} /> New conversation
            </button>
          )
        }
      />
      <Notice kind="info">
        This is a real customer session. Messages, leads and confirmed
        appointments are saved to your business. AI and document searches may
        use your configured model account.
      </Notice>
      <div className="test-chat-layout">
        <section className="panel test-chat">
          <div className="panel-heading">
            <div className="inline">
              <span className="section-icon">
                <MessageCircle size={21} />
              </span>
              <div>
                <h2>Your business assistant</h2>
                <span className="quiet small">
                  {session
                    ? `Session ${session.conversation_id.slice(0, 8)}`
                    : "Start a fresh conversation"}
                </span>
              </div>
            </div>
            {session && (
              <Badge tone={session.handoff ? "amber" : "green"}>
                {session.handoff ? "AI paused" : "Ready to help"}
              </Badge>
            )}
          </div>
          {!session ? (
            <div className="chat-start">
              <span className="large-icon">
                <FlaskConical size={30} />
              </span>
              <h2>Put your assistant to the test.</h2>
              <p className="quiet">
                Ask a question, explore a service or try booking an appointment.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!beginBusy()) return;
                  const data = new FormData(e.currentTarget);
                  setError(undefined);
                  try {
                    const result = await api<{
                      conversation_id: string;
                      token: string;
                    }>(
                      "/chat/conversations",
                      json("POST", {
                        name: String(data.get("name")).trim() || null,
                        contact: String(data.get("contact")).trim() || null,
                      }),
                      "public",
                    );
                    update({
                      ...result,
                      actions: [],
                      handoff: false,
                      completed: [],
                      uncertain: [],
                    });
                    await cache.invalidateQueries();
                  } catch (err) {
                    setError(err);
                  } finally {
                    endBusy();
                  }
                }}
              >
                <Field label="Customer name (optional)">
                  <input
                    name="name"
                    maxLength={200}
                    placeholder="Demo customer"
                  />
                </Field>
                <Field label="Phone or email (optional)">
                  <input name="contact" maxLength={200} />
                </Field>
                <Submit busy={busy}>Start conversation</Submit>
              </form>
            </div>
          ) : (
            <>
              <div className="message-toolbar">
                <span className="quiet small">
                  Times shown in {labels.zone}
                </span>
                <button
                  className="icon-button"
                  aria-label="Refresh chat"
                  onClick={() => messages.refetch()}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              {session.handoff && (
                <div className="handoff-banner">
                  <strong>Waiting for staff</strong>
                  <p>
                    Your messages are saved. Resume AI from Conversations to
                    continue automated replies.
                  </p>
                </div>
              )}
              <ErrorNotice error={messages.error} />
              <div className="message-history test-history" aria-live="polite">
                {messages.isPending ? (
                  <Loading />
                ) : !messages.data?.length ? (
                  <div className="chat-welcome">
                    <MessageCircle size={26} />
                    <h3>Say hello.</h3>
                    <p>Your assistant is ready for its first question.</p>
                  </div>
                ) : (
                  messages.data
                    .filter((m) => m.content)
                    .map((m) => (
                      <article
                        className={`message ${m.role === "human" ? "human" : "assistant"}`}
                        key={m.sequence}
                      >
                        <small>
                          {m.role === "human" ? "You · customer" : "Assistant"}
                        </small>
                        <p>{m.content}</p>
                      </article>
                    ))
                )}
                {session.pendingMessage &&
                  !messages.data?.some(
                    (m) =>
                      m.role === "human" &&
                      m.content === session.pendingMessage?.message &&
                      m.sequence === messages.data.at(-1)?.sequence,
                  ) && (
                    <article className="message human pending">
                      <small>{busy ? "Sending…" : "Awaiting retry"}</small>
                      <p>{session.pendingMessage.message}</p>
                    </article>
                  )}
                <div ref={end} />
              </div>
              {session.pendingMessage && !busy && (
                <div className="retry-banner">
                  <p>
                    The last message needs a retry. Its original request
                    reference will be reused.
                  </p>
                  <button onClick={() => send(true)}>Retry message</button>
                </div>
              )}
              <form
                className="chat-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <textarea
                  aria-label="Message your assistant"
                  placeholder={
                    session.handoff
                      ? "Leave a message for staff…"
                      : "Ask your assistant something…"
                  }
                  rows={2}
                  maxLength={4000}
                  required
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={busy || !!session.pendingMessage}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim() && !busy && !session.pendingMessage)
                        void send();
                    }
                  }}
                />
                <button
                  className="primary icon-button"
                  type="submit"
                  aria-label="Send message"
                  disabled={busy || !draft.trim() || !!session.pendingMessage}
                >
                  <ArrowUp size={20} />
                </button>
              </form>
            </>
          )}
          <ErrorNotice error={error} />
        </section>
        <aside className="chat-inspector">
          <section className="panel form-section">
            <div className="inline">
              <FlaskConical size={19} />
              <h2>Things to try</h2>
            </div>
            <p className="quiet small">
              Use natural language, just as a customer would.
            </p>
            {[
              "What services do you offer?",
              "What are your opening hours?",
              "I’d like to book an appointment.",
              "Can I speak to a person?",
            ].map((text) => (
              <button
                className="suggestion"
                key={text}
                disabled={!session || busy || !!session.pendingMessage}
                onClick={() => setDraft(text)}
              >
                {text}
              </button>
            ))}
          </section>
          <section className="panel form-section">
            <h2>Review & confirm</h2>
            <p className="quiet small">
              Proposed appointment changes appear here. Only your confirmation
              applies them.
            </p>
            {!session?.actions.length ? (
              <div className="no-proposals">No pending proposals</div>
            ) : (
              session.actions.map((action) => (
                <div className="proposal" key={action.id}>
                  <Badge tone="amber">
                    {action.kind === "book"
                      ? "New appointment"
                      : action.kind === "cancel"
                        ? "Cancellation"
                        : "Reschedule"}
                  </Badge>
                  <dl>
                    {Object.entries(action.details).map(([key, value]) => (
                      <div key={key}>
                        <dt>
                          {key === "previous_starts_at"
                            ? "Current time"
                            : key === "starts_at"
                              ? "New time"
                              : key.replaceAll("_", " ")}
                        </dt>
                        <dd>
                          {key.includes("starts_at")
                            ? formatTime(value, labels.zone)
                            : key === "service_id"
                              ? refs.services.find((s) => s.id === value)
                                  ?.name || value
                              : key === "provider_id"
                                ? refs.providers.find((p) => p.id === value)
                                    ?.name || value
                                : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="quiet small">
                    Expires {formatTime(action.expires_at, labels.zone)}
                  </p>
                  {session.completed.includes(action.id) ? (
                    <Badge tone="green">Confirmed</Badge>
                  ) : session.uncertain.includes(action.id) ? (
                    <>
                      <Notice kind="info">
                        Checking the saved outcome is required.
                      </Notice>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (!beginBusy()) return;
                          setError(undefined);
                          try {
                            const confirmed = await reconcile(action);
                            if (!confirmed)
                              setError(
                                new Error(
                                  "No confirmation found in saved history. You can explicitly retry; the server prevents duplicate changes.",
                                ),
                              );
                          } catch (err) {
                            setError(err);
                          } finally {
                            endBusy();
                          }
                        }}
                      >
                        Check saved result
                      </button>
                    </>
                  ) : new Date(action.expires_at).getTime() <= now ? (
                    <Badge tone="gray">Expired · request a new proposal</Badge>
                  ) : (
                    <button
                      className="primary"
                      disabled={!canConfirm(action, session, busy, now)}
                      onClick={() => confirm(action)}
                    >
                      Confirm{" "}
                      {action.kind === "book"
                        ? "booking"
                        : action.kind === "cancel"
                          ? "cancellation"
                          : "new time"}
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
      {reset && (
        <Confirm
          title="Start a new conversation?"
          close={() => setReset(false)}
          label="Start fresh"
          action={async () => {
            update(null);
            setError(undefined);
            setDraft("");
          }}
        >
          The current conversation stays in history. A new session won’t have
          access to its customer’s earlier bookings.
        </Confirm>
      )}
    </>
  );
}
