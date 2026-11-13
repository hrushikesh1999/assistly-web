import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Upload, Trash2, Pencil } from "lucide-react";
import { api, json } from "../api";
import type { FAQ, KnowledgeDocument, SearchResult } from "../types";
import {
  AddButton,
  Badge,
  Confirm,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Notice,
  PageHeader,
  RowActions,
  Submit,
  Table,
  usePage,
} from "../ui";
export default function Knowledge() {
  const [tab, setTab] = useState("faqs");
  const [edit, setEdit] = useState<FAQ | "new" | null>(null);
  const [remove, setRemove] = useState<FAQ | KnowledgeDocument | null>(null);
  const query = usePage<FAQ | KnowledgeDocument>(
    `/knowledge/${tab === "faqs" ? "faqs" : "documents"}`,
  );
  const cache = useQueryClient();
  return (
    <>
      <PageHeader
        title="Knowledge"
        description="Manage FAQs, documents and the answers your assistant uses."
        action={
          tab === "faqs" ? (
            <AddButton onClick={() => setEdit("new")}>Add FAQ</AddButton>
          ) : undefined
        }
      />
      <div className="tabs">
        <button
          className={tab === "faqs" ? "active" : ""}
          onClick={() => setTab("faqs")}
        >
          FAQs
        </button>
        <button
          className={tab === "documents" ? "active" : ""}
          onClick={() => setTab("documents")}
        >
          Documents
        </button>
        <button
          className={tab === "search" ? "active" : ""}
          onClick={() => setTab("search")}
        >
          <Search size={15} /> Test search
        </button>
      </div>
      {tab === "search" ? (
        <SearchKnowledge />
      ) : (
        <>
          {tab === "documents" && <UploadDocument />}
          <section className="panel">
            <div className="panel-heading">
              <h2>
                {tab === "faqs"
                  ? "Frequently asked questions"
                  : "Your documents"}
              </h2>
              <span className="quiet small">
                {tab === "faqs"
                  ? "Changes are available immediately"
                  : "Replace a document by deleting and uploading again"}
              </span>
            </div>
            <ErrorNotice error={query.error} />
            {query.isPending ? (
              <Loading />
            ) : !query.data?.length ? (
              <Empty>
                Add {tab === "faqs" ? "an FAQ" : "a document"} to help your
                assistant answer questions.
              </Empty>
            ) : (
              <Table
                headings={
                  tab === "faqs"
                    ? ["Question & answer", "Actions"]
                    : ["Document", "Status", "Actions"]
                }
              >
                {query.data.map((row) => (
                  <tr key={row.id}>
                    {"question" in row ? (
                      <td className="faq-cell">
                        <strong>{row.question}</strong>
                        <p>{row.answer}</p>
                      </td>
                    ) : (
                      <>
                        <td>
                          <div className="inline">
                            <FileText size={18} />
                            <strong>{row.name}</strong>
                          </div>
                        </td>
                        <td>
                          <Badge tone="green">{row.status}</Badge>
                        </td>
                      </>
                    )}
                    <td>
                      <RowActions>
                        {"question" in row && (
                          <button onClick={() => setEdit(row)}>
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        <button
                          className="text-danger"
                          onClick={() => setRemove(row)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {query.pagination}
          </section>
        </>
      )}
      {edit && (
        <FAQForm
          record={edit === "new" ? undefined : edit}
          close={() => setEdit(null)}
        />
      )}{" "}
      {remove && (
        <Confirm
          title={`Delete ${"question" in remove ? "FAQ" : "document"}?`}
          close={() => setRemove(null)}
          danger
          label="Delete"
          action={async () => {
            await api(
              `/knowledge/${"question" in remove ? "faqs" : "documents"}/${remove.id}`,
              json("DELETE"),
            );
            await cache.invalidateQueries();
          }}
        >
          This content will no longer be available to your assistant.
        </Confirm>
      )}
    </>
  );
}
function FAQForm({ record, close }: { record?: FAQ; close: () => void }) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <Modal
      title={record ? "Edit FAQ" : "Add FAQ"}
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
              `/knowledge/faqs${record ? `/${record.id}` : ""}`,
              json(record ? "PUT" : "POST", {
                question: data.get("question"),
                answer: data.get("answer"),
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
        <Field label="Question">
          <textarea
            name="question"
            required
            maxLength={2000}
            rows={2}
            defaultValue={record?.question}
          />
        </Field>
        <Field label="Answer">
          <textarea
            name="answer"
            required
            maxLength={10000}
            rows={6}
            defaultValue={record?.answer}
          />
        </Field>
        <ErrorNotice error={error} />
        <Submit busy={busy} />
      </form>
    </Modal>
  );
}
function UploadDocument() {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  return (
    <section className="panel upload-panel">
      <span className="section-icon">
        <Upload size={24} />
      </span>
      <div>
        <h2>Add business knowledge</h2>
        <p className="quiet small">
          UTF-8 TXT, Markdown or text PDFs · up to 5 MB, 100 pages and 200,000
          characters. Scanned PDFs need OCR.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const data = new FormData(form);
            const file = data.get("file") as File;
            setError(undefined);
            setSaved(false);
            if (!file?.size) {
              setError(new Error("Choose a non-empty file."));
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              setError(new Error("Choose a file smaller than 5 MB."));
              return;
            }
            setBusy(true);
            try {
              await api("/knowledge/documents", { method: "POST", body: data });
              await cache.invalidateQueries();
              setSaved(true);
              form.reset();
            } catch (err) {
              setError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="inline wrap">
            <input
              aria-label="Document file"
              name="file"
              type="file"
              accept=".txt,.md,.pdf"
              required
              disabled={busy}
            />
            <Submit busy={busy}>Upload document</Submit>
          </div>
        </form>
        {busy && (
          <Notice kind="info">
            Processing and indexing your document. It will appear when complete.
            If the connection is lost, refresh the list before uploading again.
          </Notice>
        )}
        <ErrorNotice error={error} />
        {saved && (
          <Notice kind="success">Document ready for your assistant.</Notice>
        )}
      </div>
    </section>
  );
}
function SearchKnowledge() {
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <section className="panel form-section">
      <h2>See what your assistant can find</h2>
      <p className="quiet">
        Search FAQ text and related passages from your documents.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError(undefined);
          setResults(null);
          try {
            setResults(
              await api<SearchResult[]>(
                `/knowledge/search?query=${encodeURIComponent(String(data.get("query")))}`,
              ),
            );
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Search question">
          <input
            name="query"
            required
            maxLength={2000}
            placeholder="What should a customer know before their visit?"
          />
        </Field>
        <Submit busy={busy}>Search knowledge</Submit>
      </form>
      <ErrorNotice error={error} />
      {results?.length === 0 && (
        <Empty>
          No matching knowledge found. Try different wording or add relevant
          content.
        </Empty>
      )}
      {results?.map((r, i) => (
        <article className="search-result" key={r.chunk_id || r.id || i}>
          <Badge>{r.source}</Badge>
          <p>{r.content}</p>
        </article>
      ))}
    </section>
  );
}
