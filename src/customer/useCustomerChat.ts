import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../transport";
import type { Message } from "../types";
import { customerApi } from "./api";
import {
  loadCustomerSession,
  storeCustomerSession,
  type CustomerSession,
} from "./session";
import type { ActionView, ConversationSnapshot } from "./types";

function isConversationBusy(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    /^Conversation is busy(?:;|$)/.test(error.message)
  );
}

export function useCustomerChat() {
  const cache = useQueryClient();
  const [session, setSession] = useState<CustomerSession | null>(
    loadCustomerSession,
  );
  const sessionRef = useRef(session);
  const mounted = useRef(true);
  const locked = useRef(false);
  const [busy, setBusy] = useState<"message" | "confirm" | "check" | null>(
    null,
  );
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const config = useQuery({
    queryKey: ["public-chat", "config"],
    queryFn: customerApi.config,
    staleTime: 60_000,
  });
  const key = ["public-chat", "snapshot", session?.conversation_id];
  const snapshot = useQuery({
    queryKey: key,
    queryFn: () => customerApi.snapshot(session!),
    enabled: !!session && !busy,
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const historyKey = ["public-chat", "history", session?.conversation_id];
  const history = useQuery({
    queryKey: historyKey,
    queryFn: async () => {
      const previous = cache.getQueryData<Message[]>(historyKey) || [];
      const next = await customerApi.history(
        session!,
        previous.at(-1)?.sequence || 0,
      );
      return [
        ...previous,
        ...next.filter(
          (row) =>
            !previous.some((existing) => existing.sequence === row.sequence),
        ),
      ];
    },
    enabled: !!session && !busy,
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const persist = (value: CustomerSession | null) => {
    if (!mounted.current) return;
    // Persist first: if storage is unavailable, do not begin a write we cannot recover.
    storeCustomerSession(value);
    sessionRef.current = value;
    setSession(value);
  };
  const acquire = (kind: NonNullable<typeof busy>) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(kind);
    setError(undefined);
    setNotice("");
    return true;
  };
  const release = () => {
    locked.current = false;
    if (mounted.current) setBusy(null);
  };
  const refresh = async (current: CustomerSession) => {
    const saved = await customerApi.snapshot(current);
    if (mounted.current) {
      cache.setQueryData(
        ["public-chat", "snapshot", current.conversation_id],
        saved,
      );
      await cache.invalidateQueries({
        queryKey: ["public-chat", "history", current.conversation_id],
      });
    }
    return saved;
  };
  // Resolve persisted uncertainty only from a successful, authoritative snapshot.
  const reconcile = (
    current: CustomerSession,
    saved: ConversationSnapshot,
    actionId: string,
  ) => {
    const action = saved.actions.find((item) => item.id === actionId);
    if (!action)
      throw new Error(
        "This change is not in the saved session. Refresh before continuing.",
      );
    persist({
      ...current,
      uncertainActions: current.uncertainActions.filter(
        (id) => id !== actionId,
      ),
    });
    if (action.status === "confirmed")
      setNotice(
        action.result
          ? "Your change is confirmed. The saved details are below."
          : "This action was confirmed earlier. Its detailed result is unavailable; do not submit a replacement automatically.",
      );
    else if (action.status === "expired")
      setNotice("This proposal expired. Ask for a new one.");
    else
      setNotice(
        "The server has not confirmed this change. Review it below before trying again.",
      );
    return action;
  };
  const send = async (retry = false) => {
    if (!config.data || !acquire("message")) return;
    let current = sessionRef.current;
    const pending = retry
      ? current?.pendingMessage
      : { request_id: crypto.randomUUID(), message: draft.trim() };
    if (
      !pending?.message ||
      current?.uncertainActions.length ||
      (!retry && current?.pendingMessage)
    ) {
      release();
      return;
    }
    try {
      if (!current) {
        const created = await customerApi.create();
        if (!mounted.current) return;
        current = { ...created, uncertainActions: [] };
      }
      current = { ...current, pendingMessage: pending };
      persist(current);
      setDraft("");
      const activeSession = current;
      const sendMessage = () => customerApi.send(activeSession, pending);
      const response = await sendMessage().catch(async (err: unknown) => {
        if (!isConversationBusy(err)) throw err;
        // Keep the original request ID so the server can replay a completed turn.
        for (const delay of [250, 750]) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (!mounted.current) throw err;
          try {
            return await sendMessage();
          } catch (retryError) {
            if (!isConversationBusy(retryError)) throw retryError;
          }
        }
        throw err;
      });
      if (!mounted.current) return;
      const next = { ...sessionRef.current!, pendingMessage: undefined };
      persist(next);
      // Saved history is authoritative; response text never triggers confirmation.
      await refresh(next);
      if (
        !response.reply?.trim() &&
        !response.handoff_active &&
        !response.pending_actions.length
      )
        setError(
          new Error(
            "The assistant did not return an answer. Please try rephrasing your question.",
          ),
        );
    } catch (err) {
      if (mounted.current) setError(err);
    } finally {
      release();
    }
  };
  const checkAction = async (actionId: string) => {
    const current = sessionRef.current;
    if (!current || !acquire("check")) return;
    try {
      reconcile(current, await refresh(current), actionId);
    } catch (err) {
      if (mounted.current) setError(err);
    } finally {
      release();
    }
  };
  const confirm = async (action: ActionView, patientName?: string) => {
    const current = sessionRef.current;
    if (
      !current ||
      current.pendingMessage ||
      current.uncertainActions.includes(action.id) ||
      snapshot.error ||
      snapshot.data?.handoff_active ||
      action.status !== "pending" ||
      Date.parse(action.expires_at) <= Date.now() ||
      !acquire("confirm")
    )
      return;
    try {
      // A fresh snapshot holds the same conversation lock as backend writes.
      const saved = await refresh(current);
      const latest = saved.actions.find((item) => item.id === action.id);
      if (saved.handoff_active)
        throw new Error(
          "AI replies and appointment changes are paused while staff handle this conversation.",
        );
      if (!latest || latest.status !== "pending") {
        if (latest) reconcile(current, saved, action.id);
        else
          throw new Error(
            "This proposal is no longer available. Ask for a new one.",
          );
        return;
      }
      const uncertain = {
        ...current,
        uncertainActions: [
          ...new Set([...current.uncertainActions, action.id]),
        ],
      };
      persist(uncertain);
      await customerApi.confirm(uncertain, action.id, patientName);
      if (!mounted.current) return;
      reconcile(uncertain, await refresh(uncertain), action.id);
    } catch (err) {
      if (!mounted.current) return;
      // Even a lost response is recoverable by explicit snapshot checking. A 409
      // while the server holds its lock never proves failure or enables a retry.
      setError(err);
    } finally {
      release();
    }
  };
  const reset = () => {
    if (locked.current) return;
    try {
      persist(null);
      cache.removeQueries({ queryKey: ["public-chat", "snapshot"] });
      cache.removeQueries({ queryKey: ["public-chat", "history"] });
      setDraft("");
      setError(undefined);
      setNotice("");
    } catch (err) {
      setError(err);
    }
  };
  const failure =
    error || (!isConversationBusy(snapshot.error) && snapshot.error) || history.error;
  const publicFailure =
    failure instanceof ApiError && failure.status >= 500
      ? new Error(
          "We couldn’t complete that request right now. Please try again shortly.",
        )
      : failure;
  const invalidSession = [error, snapshot.error, history.error].some(
    (err) =>
      err instanceof ApiError && (err.status === 401 || err.status === 404),
  );
  return {
    session,
    config,
    snapshot,
    history,
    busy,
    error: publicFailure,
    invalidSession,
    notice,
    draft,
    setDraft,
    send,
    confirm,
    checkAction,
    reset,
    refresh: async () => {
      const current = sessionRef.current;
      if (!current || !acquire("check")) return;
      try {
        await refresh(current);
      } catch (err) {
        setError(err);
      } finally {
        release();
      }
    },
  };
}
