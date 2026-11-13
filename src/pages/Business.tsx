import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DateTime } from "luxon";
import { Plus, Trash2 } from "lucide-react";
import { api, json } from "../api";
import { useBusiness } from "../data";
import type { Business, Capability } from "../types";
import { ErrorNotice, Field, Loading, Notice, PageHeader, Submit } from "../ui";
const schema = z.object({
  name: z.string().trim().min(1).max(200),
  timezone: z
    .string()
    .refine(
      (v) => DateTime.now().setZone(v).isValid,
      "Enter a valid IANA timezone, such as Asia/Kolkata.",
    ),
  instructions: z.string().max(12000),
  provider: z.string().trim().min(1),
  customer: z.string().trim().min(1),
});
export default function BusinessPage() {
  const query = useBusiness();
  return (
    <>
      <PageHeader
        title="Business settings"
        description="Manage business details, preferences and assistant instructions."
      />
      {query.isPending ? (
        <Loading />
      ) : query.data ? (
        <BusinessForm business={query.data} />
      ) : (
        <ErrorNotice error={query.error} />
      )}
    </>
  );
}
function BusinessForm({ business }: { business: Business }) {
  const cache = useQueryClient();
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [caps, setCaps] = useState<Capability[]>(business.enabled_capabilities);
  const [details, setDetails] = useState(
    Object.entries(business.details).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
      original: value,
      edited: false,
    })),
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...business,
      provider: String(business.terminology.provider || "provider"),
      customer: String(business.terminology.customer || "customer"),
    },
  });
  return (
    <form
      className="settings-form"
      onSubmit={handleSubmit(async (values) => {
        setError(undefined);
        setSaved(false);
        try {
          const keys = details.map((d) => d.key.trim());
          if (keys.some((k) => !k) || new Set(keys).size !== keys.length)
            throw new Error(
              "Business detail names must be unique and non-empty.",
            );
          const next = {
            name: values.name,
            timezone: values.timezone,
            instructions: values.instructions,
            terminology: {
              ...business.terminology,
              provider: values.provider,
              customer: values.customer,
            },
            details: Object.fromEntries(
              details.map((d) => [
                d.key.trim(),
                d.edited ? d.value : d.original,
              ]),
            ),
            enabled_capabilities: caps,
          };
          await api("/business", json("PUT", next));
          await cache.invalidateQueries({ queryKey: ["business"] });
          setSaved(true);
        } catch (e) {
          setError(e);
        }
      })}
    >
      <section className="panel form-section">
        <div className="section-heading">
          <h2>Business profile</h2>
          <p>The essentials your customers ask about.</p>
        </div>
        <div className="form-grid">
          <Field label="Business name">
            <input {...register("name")} />
            <small className="field-error">{errors.name?.message}</small>
          </Field>
          <Field
            label="Timezone"
            hint="All schedules and appointments use this timezone."
          >
            <input {...register("timezone")} placeholder="Asia/Kolkata" />
            <small className="field-error">{errors.timezone?.message}</small>
          </Field>
        </div>
        <h3>Business details</h3>
        <p className="quiet small">
          Add your address, contact information, opening hours or other useful
          facts.
        </p>
        {details.map((entry, i) => (
          <div className="detail-row" key={i}>
            <Field label="Detail name">
              <input
                value={entry.key}
                onChange={(e) =>
                  setDetails((rows) =>
                    rows.map((r, n) =>
                      n === i ? { ...r, key: e.target.value } : r,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Value">
              <textarea
                rows={2}
                value={entry.value}
                onChange={(e) =>
                  setDetails((rows) =>
                    rows.map((r, n) =>
                      n === i
                        ? { ...r, value: e.target.value, edited: true }
                        : r,
                    ),
                  )
                }
              />
            </Field>
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove ${entry.key || "detail"}`}
              onClick={() =>
                setDetails((rows) => rows.filter((_, n) => n !== i))
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDetails((rows) => [
              ...rows,
              { key: "", value: "", original: "", edited: true },
            ])
          }
        >
          <Plus size={16} /> Add detail
        </button>
      </section>
      <section className="panel form-section">
        <div className="section-heading">
          <h2>Your terminology</h2>
          <p>
            Use the words that feel natural for your business. Enter singular
            labels.
          </p>
        </div>
        <div className="form-grid">
          <Field label="Provider label">
            <input {...register("provider")} />
            <small className="field-error">{errors.provider?.message}</small>
          </Field>
          <Field label="Customer label">
            <input {...register("customer")} />
            <small className="field-error">{errors.customer?.message}</small>
          </Field>
        </div>
      </section>
      <section className="panel form-section">
        <div className="section-heading">
          <h2>Assistant behavior</h2>
          <p>
            Choose what your assistant can help with and how it should respond.
          </p>
        </div>
        <div className="capability-grid">
          {(["support", "sales", "appointments"] as const).map((cap) => (
            <label key={cap} className="capability">
              <input
                type="checkbox"
                checked={caps.includes(cap)}
                onChange={(e) =>
                  setCaps((v) =>
                    e.target.checked ? [...v, cap] : v.filter((c) => c !== cap),
                  )
                }
              />
              <span>
                <strong>{cap}</strong>
                <small>
                  {cap === "support"
                    ? "Answer questions using your knowledge."
                    : cap === "sales"
                      ? "Recommend services and capture leads."
                      : "Find availability and propose bookings."}
                </small>
              </span>
            </label>
          ))}
        </div>
        <Field label="Assistant instructions">
          <textarea
            rows={6}
            {...register("instructions")}
            placeholder="Describe your tone, helpful context and boundaries…"
          />
          <small className="field-error">{errors.instructions?.message}</small>
        </Field>
      </section>
      <ErrorNotice error={error} />
      {saved && <Notice kind="success">Business settings saved.</Notice>}
      <div className="form-actions">
        <Submit busy={isSubmitting} />
      </div>
    </form>
  );
}
