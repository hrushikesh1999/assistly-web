import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CircleHelp,
  HeartHandshake,
  Info,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Layers3,
} from "lucide-react";
import { ErrorNotice, Loading, Modal, Notice } from "../ui";
import { useCustomerChat } from "./useCustomerChat";
import MessageList from "./MessageList";
import ProposalCard from "./ProposalCard";
import "./customer.css";

export default function CustomerChat() {
  const chat = useCustomerChat();
  const [resetOpen, setResetOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const config = chat.config.data;
  useEffect(() => {
    const previous = document.title;
    document.title = config ? `${config.name} · Chat` : "Assistly · Chat";
    return () => {
      document.title = previous;
    };
  }, [config]);
  const label = (key: string, fallback: string) =>
    config?.terminology[key]?.trim() || fallback;
  const provider = label("provider", "provider");
  const appointment = label("appointment", "appointment");
  const messages = chat.history.data || [];
  const actions = chat.snapshot.data?.actions || [];
  const hasMessages = !!messages.length || !!chat.session?.pendingMessage;
  const handoff = chat.snapshot.data?.handoff_active || false;
  const uncertain = chat.session?.uncertainActions || [];
  const blocked =
    !!chat.busy ||
    !!chat.session?.pendingMessage ||
    !!uncertain.length ||
    chat.invalidSession ||
    !config;
  const suggestions = [
    ...(config?.enabled_capabilities.includes("support")
      ? [
          {
            title: "Ask a question",
            description: "Hours, location and more",
            message: "What are your opening hours?",
            icon: CircleHelp,
          },
        ]
      : []),
    ...(config?.enabled_capabilities.some(
      (c) => c === "sales" || c === "appointments",
    )
      ? [
          {
            title: "Explore services",
            description: "Services and information",
            message: "What services do you offer?",
            icon: Layers3,
          },
        ]
      : []),
    ...(config?.enabled_capabilities.includes("appointments")
      ? [
          {
            title: `Book an ${appointment}`,
            description: "Find an available time",
            message: `I would like to book an ${appointment}.`,
            icon: CalendarDays,
          },
        ]
      : []),
    {
      title: "Speak to a person",
      description: "Ask for staff assistance",
      message: "I would like to speak to a person.",
      icon: HeartHandshake,
    },
  ];
  const choose = (text: string) => {
    chat.setDraft(text);
    input.current?.focus();
  };
  return (
    <div className="customer-page">
      <a className="skip-link" href="#customer-main">
        Skip to chat
      </a>
      <header className="customer-header">
        <a
          className="customer-business"
          href="/chat"
          aria-label={config?.name || "Business chat"}
        >
          <span className="customer-business-logo">
            {config?.name.slice(0, 1) || "A"}
          </span>
          <span>
            <strong>{config?.name || "Welcome"}</strong>
            <small>Customer assistance</small>
          </span>
        </a>
        <div className="customer-header-actions">
          <span className="customer-private">
            <ShieldCheck size={14} /> A private conversation
          </span>
          {chat.session && (
            <button
              className="customer-reset"
              disabled={!!chat.busy}
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={14} />
              <span>New chat</span>
            </button>
          )}
        </div>
      </header>
      <main
        className={`customer-main ${actions.length ? "with-proposals" : ""}`}
        id="customer-main"
      >
        <section className="customer-chat-panel" aria-label="Customer chat">
          <div className="customer-chat-topline">
            <span>
              <span
                className={`customer-state-dot ${handoff ? "paused" : ""}`}
              />
              {handoff ? "AI replies paused" : "Here to help"}
            </span>
            <span className="customer-ai-label">AI assistant</span>
          </div>
          {chat.config.isPending ? (
            <Loading />
          ) : chat.config.error ? (
            <div className="customer-unavailable">
              <Info size={28} />
              <h1>We couldn’t connect just yet.</h1>
              <p>Please try again in a moment.</p>
              <ErrorNotice error={chat.config.error} />
              <button onClick={() => chat.config.refetch()}>
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          ) : !hasMessages && !chat.session ? (
            <div className="customer-welcome">
              <h1>
                How can we help
                <br />
                you today?
              </h1>
              <p>Ask a question or choose an option to get started.</p>
              <div className="customer-suggestions">
                {suggestions.map(
                  ({ title, description, message, icon: Icon }) => (
                    <button
                      key={title}
                      onClick={() => choose(message)}
                      disabled={blocked}
                    >
                      <span className="suggestion-icon">
                        <Icon size={19} />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  ),
                )}
              </div>
              <span className="customer-no-signup">
                <Check size={12} /> No account needed. Just ask.
              </span>
            </div>
          ) : (
            <>
              {chat.history.isPending && <Loading />}
              <MessageList
                messages={messages}
                pending={chat.session?.pendingMessage?.message}
                sending={chat.busy === "message"}
              />
            </>
          )}
          {handoff && (
            <div className="customer-handoff" role="status">
              <HeartHandshake size={20} />
              <div>
                <strong>Your conversation has been handed over.</strong>
                <p>
                  AI replies are paused. You can leave a message, which will be
                  saved for staff. Staff replies aren’t available in this chat
                  yet.
                </p>
              </div>
            </div>
          )}
          {chat.invalidSession ? (
            <div className="customer-session-error">
              <Notice>
                This session is no longer accessible. Start a new chat to
                continue. Earlier bookings won’t be available in the new
                session.
              </Notice>
              <button onClick={() => setResetOpen(true)}>Start new chat</button>
            </div>
          ) : (
            <ErrorNotice error={chat.error} />
          )}
          {chat.notice && <Notice kind="info">{chat.notice}</Notice>}
          {!!uncertain.length && !chat.invalidSession && (
            <div className="customer-recovery">
              <Info size={16} />
              <div>
                <strong>Let’s check your last change.</strong>
                <p>
                  We’ll check the saved result before offering another attempt.
                </p>
                {uncertain.map((id) => (
                  <button
                    key={id}
                    disabled={!!chat.busy}
                    onClick={() => chat.checkAction(id)}
                  >
                    Check saved result
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.session?.pendingMessage &&
            !chat.busy &&
            !chat.invalidSession && (
              <div className="customer-recovery">
                <RefreshCw size={16} />
                <div>
                  <strong>Your message needs a retry.</strong>
                  <p>Retry to send the same message safely.</p>
                  <button onClick={() => chat.send(true)}>Retry message</button>
                </div>
              </div>
            )}
          <form
            className="customer-composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (chat.draft.trim() && !blocked) void chat.send();
            }}
          >
            <div className="customer-input-wrap">
              <textarea
                ref={input}
                aria-label="Your message"
                placeholder={
                  handoff ? "Leave a message for staff…" : "Ask us anything…"
                }
                value={chat.draft}
                onChange={(e) => chat.setDraft(e.target.value)}
                rows={2}
                maxLength={4000}
                required
                disabled={blocked}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (chat.draft.trim() && !blocked) void chat.send();
                  }
                }}
              />
              <button
                type="submit"
                className="primary"
                aria-label="Send message"
                disabled={blocked || !chat.draft.trim()}
              >
                {chat.busy === "message" ? (
                  <LoaderCircle size={19} className="spin" />
                ) : (
                  <ArrowUp size={20} />
                )}
              </button>
            </div>
            <div className="customer-composer-note">
              <span>
                AI can make mistakes. Review details before confirming.
              </span>
              {chat.session && (
                <button
                  type="button"
                  className="customer-refresh"
                  aria-label="Refresh conversation"
                  disabled={!!chat.busy}
                  onClick={() => chat.refresh()}
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </div>
          </form>
        </section>
        {!!actions.length && (
          <aside
            className="customer-review-panel"
            aria-label="Appointment reviews"
          >
            <div className="customer-review-title">
              <CalendarDays size={18} />
              <h2>Review & confirm</h2>
            </div>
            <p>Check the details before confirming a change.</p>
            {[...actions].reverse().map((action) => (
              <ProposalCard
                key={action.id}
                action={action}
                zone={config?.timezone || "UTC"}
                providerLabel={provider}
                appointmentLabel={appointment}
                now={now}
                busy={!!chat.busy}
                disabled={
                  handoff ||
                  !!chat.session?.pendingMessage ||
                  !!chat.snapshot.error ||
                  !!uncertain.length ||
                  chat.invalidSession
                }
                uncertain={uncertain.includes(action.id)}
                onConfirm={(patientName) => chat.confirm(action, patientName)}
                onCheck={() => chat.checkAction(action.id)}
              />
            ))}
          </aside>
        )}
      </main>
      <div className="customer-bottom">
        <span>
          <ShieldCheck size={12} /> This tab keeps your access. Closing it won’t
          delete saved messages.
        </span>
        <span className="customer-powered">
          Powered by{" "}
          <strong>
            assistly<span>.</span>
          </strong>
        </span>
      </div>
      {resetOpen && (
        <Modal title="Start a new chat?" close={() => setResetOpen(false)}>
          <div className="customer-reset-content">
            <p>
              Your current conversation stays in the business’s history. The new
              chat won’t have access to your earlier bookings, even if you use
              the same name or phone number.
            </p>
            {(!!uncertain.length || !!chat.session?.pendingMessage) && (
              <Notice kind="info">
                A request still needs checking. Starting over won’t undo any
                booking that may have been saved.
              </Notice>
            )}
            <div className="form-actions">
              <button onClick={() => setResetOpen(false)}>Keep chatting</button>
              <button
                className="primary"
                onClick={() => {
                  chat.reset();
                  setResetOpen(false);
                  input.current?.focus();
                }}
              >
                Start new chat
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
