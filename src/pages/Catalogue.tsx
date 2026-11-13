import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Clock3, Pencil } from "lucide-react";
import { api, json } from "../api";
import { useLabels, useReferences } from "../data";
import { formatTime, localISO } from "../time";
import type { Exception, Hours, Provider, Service } from "../types";
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
export default function Catalogue() {
  const [tab, setTab] = useState("services");
  const [edit, setEdit] = useState<Service | Provider | "new" | null>(null);
  const [schedule, setSchedule] = useState<Provider | null>(null);
  const labels = useLabels();
  const query = usePage<Service | Provider>(
    tab === "services" ? "/services" : "/providers",
  );
  return (
    <>
      <PageHeader
        title="Services & team"
        description="What you offer, who delivers it and when they’re available."
        action={
          <AddButton onClick={() => setEdit("new")}>
            Add {tab === "services" ? "service" : labels.provider}
          </AddButton>
        }
      />
      <div className="tabs">
        <button
          className={tab === "services" ? "active" : ""}
          onClick={() => setTab("services")}
        >
          Services
        </button>
        <button
          className={tab === "providers" ? "active" : ""}
          onClick={() => setTab("providers")}
        >
          {labels.provider}s
        </button>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {tab === "services" ? "Your services" : `Your ${labels.provider}s`}
          </h2>
          <span className="quiet small">Manage your catalogue</span>
        </div>
        <ErrorNotice error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : !query.data?.length ? (
          <Empty>
            Add your first {tab === "services" ? "service" : labels.provider} to
            get started.
          </Empty>
        ) : (
          <Table
            headings={
              tab === "services"
                ? ["Service", "Duration", "Price", "Status", "Actions"]
                : ["Name", "Status", "Actions"]
            }
          >
            {query.data.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                  {"description" in row && (
                    <small className="cell-description">
                      {row.description}
                    </small>
                  )}
                </td>
                {"duration_minutes" in row && (
                  <>
                    <td>{row.duration_minutes} min</td>
                    <td>
                      {row.currency} {Number(row.price).toFixed(2)}
                    </td>
                  </>
                )}
                <td>
                  <Badge tone={row.active ? "green" : "gray"}>
                    {row.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>
                  <RowActions>
                    {"service_ids" in row && (
                      <button onClick={() => setSchedule(row)}>
                        <Clock3 size={15} /> Schedule
                      </button>
                    )}
                    <button onClick={() => setEdit(row)}>
                      <Pencil size={14} /> Edit
                    </button>
                  </RowActions>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {query.pagination}
      </section>
      {edit && (
        <CatalogueForm
          key={tab + (edit === "new" ? "new" : edit.id)}
          kind={tab}
          record={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
        />
      )}{" "}
      {schedule && (
        <Schedule provider={schedule} close={() => setSchedule(null)} />
      )}
    </>
  );
}
function CatalogueForm({
  kind,
  record,
  close,
}: {
  kind: string;
  record?: Service | Provider;
  close: () => void;
}) {
  const cache = useQueryClient();
  const refs = useReferences();
  const labels = useLabels();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${kind === "services" ? "service" : labels.provider}`}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError(undefined);
          try {
            const base = {
              name: String(form.get("name")).trim(),
              active: form.get("active") === "on",
            };
            const body =
              kind === "services"
                ? {
                    ...base,
                    description: form.get("description"),
                    duration_minutes: Number(form.get("duration")),
                    price: String(form.get("price")),
                    currency: String(form.get("currency")).toUpperCase(),
                  }
                : { ...base, service_ids: form.getAll("service_ids") };
            await api(
              `/${kind}${record ? `/${record.id}` : ""}`,
              json(record ? "PUT" : "POST", body),
            );
            await cache.invalidateQueries();
            close();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={record?.name}
          />
        </Field>
        {kind === "services" ? (
          <>
            <Field label="Description">
              <textarea
                name="description"
                maxLength={5000}
                defaultValue={(record as Service)?.description}
              />
            </Field>
            <div className="form-grid">
              <Field label="Duration (minutes)">
                <input
                  name="duration"
                  type="number"
                  required
                  min={5}
                  max={480}
                  defaultValue={(record as Service)?.duration_minutes || 30}
                />
              </Field>
              <Field label="Price">
                <input
                  name="price"
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  max="9999999999.99"
                  defaultValue={(record as Service)?.price || 0}
                />
              </Field>
              <Field label="Currency">
                <input
                  name="currency"
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  required
                  defaultValue={(record as Service)?.currency || "INR"}
                />
              </Field>
            </div>
          </>
        ) : (
          <fieldset>
            <legend>Assigned services</legend>
            <ErrorNotice error={refs.error} />
            {refs.loading ? (
              <Loading />
            ) : (
              refs.services.map((s) => (
                <label className="check-row" key={s.id}>
                  <input
                    name="service_ids"
                    type="checkbox"
                    value={s.id}
                    defaultChecked={(record as Provider)?.service_ids.includes(
                      s.id,
                    )}
                  />
                  {s.name}
                  {!s.active && " (inactive)"}
                </label>
              ))
            )}
          </fieldset>
        )}
        <label className="check-row">
          <input
            name="active"
            type="checkbox"
            defaultChecked={record?.active ?? true}
          />{" "}
          Active
        </label>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <Submit busy={busy} disabled={kind !== "services" && refs.loading} />
        </div>
      </form>
    </Modal>
  );
}
function Schedule({
  provider,
  close,
}: {
  provider: Provider;
  close: () => void;
}) {
  const hours = useQuery({
    queryKey: ["hours", provider.id],
    queryFn: () => api<Hours[]>(`/providers/${provider.id}/hours`),
  });
  const exceptions = useQuery({
    queryKey: ["exceptions", provider.id],
    queryFn: () => api<Exception[]>(`/providers/${provider.id}/exceptions`),
  });
  return (
    <Modal title={`${provider.name} · Schedule`} close={close}>
      <p className="quiet small">
        Weekly hours and dated changes use your business timezone.
      </p>
      <ErrorNotice error={hours.error || exceptions.error} />
      {hours.isPending ? (
        <Loading />
      ) : (
        hours.data && <HoursForm provider={provider} initial={hours.data} />
      )}
      <hr />
      <Exceptions
        provider={provider}
        rows={exceptions.data || []}
        loading={exceptions.isPending}
      />
    </Modal>
  );
}
function HoursForm({
  provider,
  initial,
}: {
  provider: Provider;
  initial: Hours[];
}) {
  const cache = useQueryClient();
  const [rows, setRows] = useState<Hours[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        setSaved(false);
        try {
          await api(
            `/providers/${provider.id}/hours`,
            json(
              "PUT",
              rows.map(({ weekday, starts_at, ends_at }) => ({
                weekday,
                starts_at,
                ends_at,
              })),
            ),
          );
          await cache.invalidateQueries();
          setSaved(true);
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Weekly hours</h3>
      <p className="quiet small">
        Add separate windows for breaks. Split overnight hours across two days.
      </p>
      {rows.map((row, i) => (
        <div className="hours-row" key={i}>
          <Field label="Day">
            <select
              value={row.weekday}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((r, n) =>
                    n === i ? { ...r, weekday: Number(e.target.value) } : r,
                  ),
                )
              }
            >
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((d, n) => (
                <option value={n} key={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input
              type="time"
              required
              value={row.starts_at.slice(0, 5)}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((r, n) =>
                    n === i ? { ...r, starts_at: e.target.value } : r,
                  ),
                )
              }
            />
          </Field>
          <Field label="Until">
            <input
              type="time"
              required
              min={row.starts_at.slice(0, 5)}
              value={row.ends_at.slice(0, 5)}
              onChange={(e) =>
                setRows((rs) =>
                  rs.map((r, n) =>
                    n === i ? { ...r, ends_at: e.target.value } : r,
                  ),
                )
              }
            />
          </Field>
          <button
            type="button"
            className="icon-button"
            aria-label="Remove time window"
            onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={rows.length >= 50}
        onClick={() =>
          setRows((rs) => [
            ...rs,
            { weekday: 0, starts_at: "09:00", ends_at: "17:00" },
          ])
        }
      >
        <Plus size={16} /> Add window
      </button>
      <ErrorNotice error={error} />
      {saved && (
        <p role="status" className="success-text">
          Weekly hours saved.
        </p>
      )}
      <div className="form-actions">
        <Submit busy={busy}>Save weekly hours</Submit>
      </div>
    </form>
  );
}
function Exceptions({
  provider,
  rows,
  loading,
}: {
  provider: Provider;
  rows: Exception[];
  loading: boolean;
}) {
  const { zone } = useLabels();
  const cache = useQueryClient();
  const [remove, setRemove] = useState<Exception | null>(null);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <h3>Time off & extra availability</h3>
      <p className="quiet small">
        Times in {zone}. Blocked time takes priority over extra hours.
      </p>
      {loading ? (
        <Loading />
      ) : (
        rows.map((r) => (
          <div className="exception-row" key={r.id}>
            <div>
              <Badge tone={r.available ? "green" : "amber"}>
                {r.available ? "Extra availability" : "Blocked"}
              </Badge>
              <p>
                {formatTime(r.starts_at, zone)} → {formatTime(r.ends_at, zone)}
              </p>
            </div>
            <button
              aria-label="Delete schedule exception"
              onClick={() => setRemove(r)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
      {rows.length === 200 && (
        <p className="quiet">
          Showing the first 200 exceptions (backend limit).
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          setError(undefined);
          try {
            await api(
              `/providers/${provider.id}/exceptions`,
              json("POST", {
                starts_at: localISO(String(data.get("start")), zone),
                ends_at: localISO(String(data.get("end")), zone),
                available: data.get("type") === "extra",
              }),
            );
            await cache.invalidateQueries();
            form.reset();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field label="From">
            <input name="start" type="datetime-local" required />
          </Field>
          <Field label="Until">
            <input name="end" type="datetime-local" required />
          </Field>
        </div>
        <Field label="Type">
          <select name="type">
            <option value="blocked">Blocked time</option>
            <option value="extra">Extra availability</option>
          </select>
        </Field>
        <ErrorNotice error={error} />
        <Submit busy={busy}>Add dated change</Submit>
      </form>
      {remove && (
        <Confirm
          title="Delete dated change?"
          close={() => setRemove(null)}
          action={async () => {
            await api(
              `/providers/${provider.id}/exceptions/${remove.id}`,
              json("DELETE"),
            );
            await cache.invalidateQueries();
          }}
          label="Delete change"
          danger
        >
          This will recalculate availability. Existing bookings must still fit
          the schedule.
        </Confirm>
      )}
    </>
  );
}
