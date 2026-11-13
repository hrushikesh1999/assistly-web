import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, json } from "../api";
import { useLabels, useReferences } from "../data";
import { formatTime } from "../time";
import type { Customer, Lead } from "../types";
import {
  AddButton,
  Badge,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeader,
  Submit,
  Table,
  usePage,
} from "../ui";
import { CustomerForm } from "./Appointments";
export default function Contacts() {
  const labels = useLabels();
  const refs = useReferences();
  const [tab, setTab] = useState("customers");
  const [add, setAdd] = useState(false);
  const [error, setError] = useState<unknown>();
  const [updating, setUpdating] = useState<string | null>(null);
  const cache = useQueryClient();
  const query = usePage<Customer | Lead>(`/${tab}`);
  return (
    <>
      <PageHeader
        title={`${labels.customer}s & leads`}
        description="Manage contact details and follow up on leads."
        action={
          <AddButton onClick={() => setAdd(true)}>
            Add {tab === "customers" ? labels.customer : "lead"}
          </AddButton>
        }
      />
      <div className="tabs">
        <button
          className={tab === "customers" ? "active" : ""}
          onClick={() => setTab("customers")}
        >
          {labels.customer}s
        </button>
        <button
          className={tab === "leads" ? "active" : ""}
          onClick={() => setTab("leads")}
        >
          Leads
        </button>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {tab === "customers"
              ? `Your ${labels.customer}s`
              : "Interested in what you offer"}
          </h2>
          <Badge>
            {tab === "customers" ? "Contacts" : "Follow-up pipeline"}
          </Badge>
        </div>
        <ErrorNotice error={query.error || refs.error || error} />
        {query.isPending || refs.loading ? (
          <Loading />
        ) : !query.data?.length ? (
          <Empty>
            No {tab === "customers" ? `${labels.customer}s` : "leads"} yet.
          </Empty>
        ) : (
          <Table
            headings={
              tab === "customers"
                ? ["Name", "Contact", "Added"]
                : [labels.customer, "Interest", "Status", "Update status"]
            }
          >
            {query.data.map((row) =>
              "interest" in row ? (
                <tr key={row.id}>
                  <td>
                    <strong>
                      {refs.customers.find((c) => c.id === row.customer_id)
                        ?.name || "Unnamed"}
                    </strong>
                    <small className="cell-description">
                      {
                        refs.customers.find((c) => c.id === row.customer_id)
                          ?.contact
                      }
                    </small>
                  </td>
                  <td className="wrap-cell">{row.interest}</td>
                  <td>
                    <Badge tone={row.status === "qualified" ? "green" : "gray"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td>
                    <select
                      aria-label="Lead status"
                      value={row.status}
                      disabled={updating === row.id}
                      onChange={async (e) => {
                        const status = e.target.value;
                        setUpdating(row.id);
                        setError(undefined);
                        try {
                          await api(
                            `/leads/${row.id}`,
                            json("PATCH", { status }),
                          );
                          await cache.invalidateQueries();
                        } catch (err) {
                          setError(err);
                        } finally {
                          setUpdating(null);
                        }
                      }}
                    >
                      {["new", "contacted", "qualified", "closed"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ) : (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name || "Unnamed"}</strong>
                  </td>
                  <td>{row.contact || "—"}</td>
                  <td>{formatTime(row.created_at, labels.zone)}</td>
                </tr>
              ),
            )}
          </Table>
        )}
        {query.pagination}
      </section>
      {add &&
        (tab === "customers" ? (
          <CustomerForm close={() => setAdd(false)} />
        ) : (
          <LeadForm close={() => setAdd(false)} />
        ))}
    </>
  );
}
function LeadForm({ close }: { close: () => void }) {
  const refs = useReferences();
  const labels = useLabels();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <Modal
      title="Add lead"
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
              "/leads",
              json("POST", {
                customer_id: data.get("customer_id"),
                interest: data.get("interest"),
              }),
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
        <ErrorNotice error={refs.error} />
        <Field label={labels.customer}>
          <select name="customer_id" required>
            <option value="">Choose a {labels.customer}</option>
            {refs.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.contact || "Unnamed"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Interested in">
          <textarea required name="interest" maxLength={4000} rows={4} />
        </Field>
        <ErrorNotice error={error} />
        <Submit busy={busy} disabled={refs.loading}>
          Add lead
        </Submit>
      </form>
    </Modal>
  );
}
