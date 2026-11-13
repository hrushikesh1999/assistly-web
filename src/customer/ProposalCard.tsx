import { useState } from "react";
import { CalendarCheck2, CheckCircle2, Clock3 } from "lucide-react";
import { formatTime } from "../time";
import type { ActionView } from "./types";

export default function ProposalCard({
  action,
  zone,
  providerLabel,
  appointmentLabel,
  now,
  busy,
  disabled,
  uncertain,
  onConfirm,
  onCheck,
}: {
  action: ActionView;
  zone: string;
  providerLabel: string;
  appointmentLabel: string;
  now: number;
  busy: boolean;
  disabled: boolean;
  uncertain: boolean;
  onConfirm: (patientName?: string) => void;
  onCheck: () => void;
}) {
  const [patientName, setPatientName] = useState("");
  const isBooking = action.kind === "book";
  const expired =
    action.status === "expired" || Date.parse(action.expires_at) <= now;
  const confirmed = action.status === "confirmed";
  const details = confirmed && action.result ? action.result : action.details;
  const title =
    action.kind === "book"
      ? `Book ${appointmentLabel}`
      : action.kind === "reschedule"
        ? `Reschedule ${appointmentLabel}`
        : `Cancel ${appointmentLabel}`;
  const confirmation =
    action.kind === "book"
      ? "Booking confirmed"
      : action.kind === "reschedule"
        ? "New time confirmed"
        : "Cancellation confirmed";
  const minutes = Math.max(
    1,
    Math.ceil((Date.parse(action.expires_at) - now) / 60_000),
  );
  return (
    <article
      className={`customer-proposal ${confirmed ? "proposal-confirmed" : expired ? "proposal-expired" : ""}`}
      aria-label={`${title} review`}
    >
      <div className="proposal-kicker">
        {confirmed ? <CheckCircle2 size={17} /> : <CalendarCheck2 size={17} />}{" "}
        {confirmed
          ? action.result
            ? confirmation
            : "Confirmed earlier"
          : "Review request"}
      </div>
      <h3>{confirmed && !action.result ? "Earlier change" : title}</h3>
      {(!confirmed || action.result) && (
        <>
          <dl>
            <div>
              <dt>Service</dt>
              <dd>{details.service_name || "Service name unavailable"}</dd>
            </div>
            <div>
              <dt>{providerLabel}</dt>
              <dd>{details.provider_name || "Provider name unavailable"}</dd>
            </div>
            {!confirmed && action.details.previous_starts_at && (
              <div>
                <dt>Current time</dt>
                <dd>{formatTime(action.details.previous_starts_at, zone)}</dd>
              </div>
            )}
            {details.starts_at && (
              <div>
                <dt>
                  {!confirmed && action.kind === "reschedule"
                    ? "Requested time"
                    : "Date & time"}
                </dt>
                <dd>{formatTime(details.starts_at, zone)}</dd>
              </div>
            )}
            {details.ends_at && (
              <div>
                <dt>Until</dt>
                <dd>{formatTime(details.ends_at, zone)}</dd>
              </div>
            )}
            {details.price !== null && details.currency && (
              <div>
                <dt>Service fee</dt>
                <dd>
                  {details.currency} {Number(details.price).toFixed(2)}
                </dd>
              </div>
            )}
          </dl>
          <p className="proposal-zone">Times in {zone}</p>
        </>
      )}
      {confirmed && action.result && (
        <p className="proposal-zone">
          Saved confirmation record. Later changes are shown separately.
        </p>
      )}
      {uncertain ? (
        <div className="proposal-outcome">
          <p>The result needs checking before you continue.</p>
          <button disabled={busy} onClick={onCheck}>
            Check saved result
          </button>
        </div>
      ) : confirmed ? (
        <div className="proposal-outcome success-text" role="status">
          {action.result
            ? confirmation
            : "Confirmed earlier. Detailed result unavailable."}
        </div>
      ) : expired ? (
        <p className="proposal-outcome">
          This proposal expired. Ask for a new one.
        </p>
      ) : (
        <>
          <p className="proposal-expiry">
            <Clock3 size={13} /> Expires in {minutes}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </p>
          {isBooking && (
            <label className="proposal-patient-name">
              Patient name
              <input
                autoComplete="name"
                maxLength={200}
                value={patientName}
                disabled={busy}
                onChange={(event) => setPatientName(event.target.value)}
              />
            </label>
          )}
          <button
            className={action.kind === "cancel" ? "danger" : "primary"}
            disabled={disabled || busy || (isBooking && !patientName.trim())}
            onClick={() => onConfirm(isBooking ? patientName.trim() : undefined)}
          >
            {action.kind === "book"
              ? "Confirm booking"
              : action.kind === "reschedule"
                ? "Confirm new time"
                : "Confirm cancellation"}
          </button>
          <small>Only this button applies the change.</small>
        </>
      )}
    </article>
  );
}
