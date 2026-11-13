import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
export function Notice({
  children,
  kind = "error",
}: {
  children: ReactNode;
  kind?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <div>{children}</div>
    </div>
  );
}
export const ErrorNotice = ({ error }: { error: unknown }) =>
  error ? (
    <Notice>{error instanceof Error ? error.message : String(error)}</Notice>
  ) : null;
export const Loading = () => (
  <div className="loading" role="status">
    <LoaderCircle className="spin" size={20} /> Loading…
  </div>
);
export const Empty = ({
  children = "No records yet.",
}: {
  children?: ReactNode;
}) => (
  <div className="empty">
    <span className="empty-mark">＋</span>
    <p>{children}</p>
  </div>
);
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export const AddButton = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) => (
  <button className="primary" onClick={onClick}>
    <Plus size={17} />
    {children}
  </button>
);
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Submit({
  busy,
  disabled,
  children = "Save changes",
}: {
  busy?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="primary" type="submit" disabled={busy || disabled}>
      {busy && <LoaderCircle className="spin" size={16} />}{" "}
      {busy ? "Working…" : children}
    </button>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Confirm({
  title,
  children,
  action,
  close,
  label = "Confirm",
  danger = false,
}: {
  title: string;
  children: ReactNode;
  action: () => Promise<unknown>;
  close: () => void;
  label?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <Modal
      title={title}
      close={() => {
        if (!busy) close();
      }}
    >
      <p>{children}</p>
      <ErrorNotice error={error} />
      <div className="form-actions">
        <button disabled={busy} onClick={close}>
          Keep record
        </button>
        <button
          className={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await action();
              close();
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : label}
        </button>
      </div>
    </Modal>
  );
}
export function usePage<T>(path: string) {
  const [page, setPage] = useState({ path, offset: 0 });
  const offset = page.path === path ? page.offset : 0;
  const setOffset = (fn: (previous: number) => number) =>
    setPage({ path, offset: fn(offset) });
  const query = useQuery({
    queryKey: ["list", path, offset],
    queryFn: () => api<T[]>(`${path}?limit=25&offset=${offset}`),
  });
  const pagination = (
    <div className="pagination">
      <span>Page {offset / 25 + 1}</span>
      <div>
        <button
          aria-label="Previous page"
          disabled={offset === 0 || query.isFetching}
          onClick={() => setOffset((n) => n - 25)}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          aria-label="Next page"
          disabled={(query.data?.length || 0) < 25 || query.isFetching}
          onClick={() => setOffset((n) => n + 25)}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
  return { ...query, pagination };
}
export function Table({
  headings,
  children,
}: {
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Records"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const RowActions = ({ children }: { children: ReactNode }) => (
  <div className="row-actions">{children}</div>
);
