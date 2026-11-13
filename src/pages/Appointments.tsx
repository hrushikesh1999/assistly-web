import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ArrowUpRight, RefreshCw, CalendarClock } from "lucide-react";
import { DateTime } from "luxon";
import { api, json } from "../api";
import { useLabels, useReferences } from "../data";
import { formatClock, formatTime, today } from "../time";
import type { Appointment, Customer, Slot } from "../types";
import {
  AddButton,
  Badge,
  Confirm,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeader,
  RowActions,
  Submit,
  Table,
  usePage,
} from "../ui";
export default function Appointments() {
  const labels = useLabels();
  const refs = useReferences();
  const query = usePage<Appointment>("/appointments");
  const cache = useQueryClient();
  const [edit, setEdit] = useState<Appointment | "new" | null>(null);
  const [cancel, setCancel] = useState<Appointment | null>(null);
  return (
    <>
      <PageHeader
        title="Appointments"
        description="Create bookings and manage appointment changes."
        action={
          <AddButton onClick={() => setEdit("new")}>New appointment</AddButton>
        }
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Appointment book</h2>
            <p className="quiet small">Most recently created first</p>
            <p className="timezone-note">
              <Clock3 size={14} /> Times in {labels.zone}
            </p>
          </div>
          <button onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <ErrorNotice error={query.error || refs.error} />
        {query.isPending || refs.loading ? (
          <Loading />
        ) : !query.data?.length ? (
          <Empty>
            <strong>No appointments yet.</strong>
            <br />
            Create an appointment, or let your assistant propose one in test
            chat.
          </Empty>
        ) : (
          <Table
            headings={[
              labels.customer,
              "Service",
              labels.provider,
              "Date & time",
              "Status",
              "Actions",
            ]}
          >
            {query.data.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>
                    {refs.customers.find((c) => c.id === a.customer_id)?.name ||
                      "Unnamed contact"}
                  </strong>
                  <small className="cell-description">
                    {
                      refs.customers.find((c) => c.id === a.customer_id)
                        ?.contact
                    }
                  </small>
                </td>
                <td>
                  {refs.services.find((s) => s.id === a.service_id)?.name ||
                    a.service_id}
                </td>
                <td>
                  {refs.providers.find((p) => p.id === a.provider_id)?.name ||
                    a.provider_id}
                </td>
                <td className="nowrap">
                  {formatTime(a.starts_at, labels.zone)}
                  <small className="cell-description">
                    until {formatClock(a.ends_at, labels.zone)}
                  </small>
                </td>
                <td>
                  <Badge tone={a.status === "booked" ? "green" : "gray"}>
                    {a.status}
                  </Badge>
                </td>
                <td>
                  <RowActions>
                    {a.status === "booked" && (
                      <>
                        <button onClick={() => setEdit(a)}>
                          <CalendarClock size={15} /> Move
                        </button>
                        <button
                          className="text-danger"
                          onClick={() => setCancel(a)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </RowActions>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {query.pagination}
      </section>
      <div className="page-tip">
        <ArrowUpRight size={17} />
        <span>
          Booking availability follows each {labels.provider}’s service
          assignments, weekly hours and dated changes.
        </span>
      </div>
      {edit && (
        <AppointmentForm
          record={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
        />
      )}{" "}
      {cancel && (
        <Confirm
          title="Cancel this appointment?"
          close={() => setCancel(null)}
          action={async () => {
            await api(`/appointments/${cancel.id}/cancel`, json("POST"));
            await cache.invalidateQueries();
          }}
          label="Cancel appointment"
          danger
        >
          {formatTime(cancel.starts_at, labels.zone)}. This frees the time for
          another booking.
        </Confirm>
      )}
    </>
  );
}
function AppointmentForm({
  record,
  close,
}: {
  record?: Appointment;
  close: () => void;
}) {
  const refs = useReferences();
  const labels = useLabels();
  const cache = useQueryClient();
  const [service, setService] = useState(record?.service_id || "");
  const [provider, setProvider] = useState(record?.provider_id || "");
  const [day, setDay] = useState(
    record
      ? DateTime.fromISO(record.starts_at).setZone(labels.zone).toISODate()!
      : today(labels.zone),
  );
  const [slot, setSlot] = useState("");
  const [customer, setCustomer] = useState(record?.customer_id || "");
  const [newCustomer, setNewCustomer] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const slots = useQuery({
    queryKey: ["availability", service, provider, day],
    queryFn: () =>
      api<Slot[]>(
        `/availability?${new URLSearchParams({ service_id: service, provider_id: provider, day })}`,
      ),
    enabled: !!service && !!provider && !!day,
    staleTime: 0,
  });
  const customerOptions = [...refs.customers];
  if (customer && !customerOptions.some((c) => c.id === customer))
    customerOptions.push({
      id: customer,
      name: "New contact",
      contact: null,
      created_at: "",
    });
  return (
    <Modal
      title={record ? "Reschedule appointment" : "New appointment"}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!slot) return;
          setBusy(true);
          setError(undefined);
          try {
            await api(
              record ? `/appointments/${record.id}` : "/appointments",
              json(
                record ? "PATCH" : "POST",
                record
                  ? { starts_at: slot }
                  : {
                      customer_id: customer,
                      service_id: service,
                      provider_id: provider,
                      starts_at: slot,
                    },
              ),
            );
            await cache.invalidateQueries();
            close();
          } catch (err) {
            setError(err);
            setSlot("");
            await slots.refetch();
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorNotice error={refs.error} />
        {!record && (
          <>
            <Field label={labels.customer}>
              <select
                required
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              >
                <option value="">Choose a {labels.customer}</option>
                {customerOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Unnamed"} {c.contact ? `· ${c.contact}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" onClick={() => setNewCustomer(true)}>
              + Add {labels.customer}
            </button>
          </>
        )}
        <div className="form-grid">
          <Field label="Service">
            <select
              required
              disabled={!!record}
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setProvider("");
                setSlot("");
              }}
            >
              <option value="">Choose a service</option>
              {refs.services
                .filter((s) => s.active || s.id === record?.service_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={labels.provider}>
            <select
              required
              disabled={!!record || !service}
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setSlot("");
              }}
            >
              <option value="">Choose a {labels.provider}</option>
              {refs.providers
                .filter(
                  (p) =>
                    (p.active && p.service_ids.includes(service)) ||
                    p.id === record?.provider_id,
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <Field label={`Date · ${labels.zone}`}>
          <input
            required
            type="date"
            min={today(labels.zone)}
            max={
              DateTime.now()
                .setZone(labels.zone)
                .plus({ days: 90 })
                .toISODate()!
            }
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setSlot("");
            }}
          />
        </Field>
        <fieldset>
          <legend>Available times</legend>
          {!service || !provider ? (
            <p className="quiet">
              Select a service and {labels.provider} first.
            </p>
          ) : slots.isPending ? (
            <Loading />
          ) : slots.error ? (
            <ErrorNotice error={slots.error} />
          ) : !slots.data?.length ? (
            <p className="quiet">No available times. Try another date.</p>
          ) : (
            <div className="slot-grid">
              {slots.data.map((s) => (
                <label
                  className={`slot ${slot === s.starts_at ? "selected" : ""}`}
                  key={s.starts_at}
                >
                  <input
                    type="radio"
                    required
                    name="slot"
                    value={s.starts_at}
                    checked={slot === s.starts_at}
                    onChange={() => setSlot(s.starts_at)}
                  />
                  {formatClock(s.starts_at, labels.zone)}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {record && (
          <p className="quiet small">
            Current booking: {formatTime(record.starts_at, labels.zone)}. Your
            existing slot stays reserved until the move succeeds.
          </p>
        )}
        <ErrorNotice error={error} />
        <div className="form-actions">
          <Submit
            busy={busy}
            disabled={!slot || (!record && !customer) || refs.loading}
          >
            {record ? "Confirm new time" : "Book appointment"}
          </Submit>
        </div>
      </form>
      {newCustomer && (
        <CustomerForm
          close={() => setNewCustomer(false)}
          onCreated={(c) => {
            setCustomer(c.id);
            setNewCustomer(false);
          }}
        />
      )}
    </Modal>
  );
}
export function CustomerForm({
  close,
  onCreated,
}: {
  close: () => void;
  onCreated?: (c: Customer) => void;
}) {
  const cache = useQueryClient();
  const labels = useLabels();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <Modal
      title={`Add ${labels.customer}`}
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
            const customer = await api<Customer>(
              "/customers",
              json("POST", {
                name: String(data.get("name")).trim() || null,
                contact: String(data.get("contact")).trim() || null,
              }),
            );
            await cache.invalidateQueries();
            if (onCreated) onCreated(customer);
            else close();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <input name="name" maxLength={200} required />
        </Field>
        <Field label="Phone or email">
          <input name="contact" maxLength={200} />
        </Field>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <Submit busy={busy}>Add {labels.customer}</Submit>
        </div>
      </form>
    </Modal>
  );
}
