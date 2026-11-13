// Explicit integration check against a running local demo backend.
// Supply {username,password} on stdin; never put credentials in files or arguments.
import { createInterface } from "node:readline/promises";
import assert from "node:assert/strict";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = createInterface({
  input: process.stdin,
  output: undefined,
  terminal: false,
});
console.log(
  "Ready for administrator credentials JSON on stdin (input is not logged).",
);
const credentials = JSON.parse(await input.question(""));
input.close();
if (process.stdin.isTTY) process.stdin.setRawMode(false);
const base = process.env.ASSISTLY_API_URL || "http://127.0.0.1:8000";
let token;
async function request(path, method = "GET", body, auth = token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof result.detail === "string"
          ? result.detail
          : `HTTP ${response.status}`,
      ),
      { status: response.status },
    );
  return result;
}
const completed = [];
const cleanups = [];
try {
  token = (await request("/auth/login", "POST", credentials, null))
    .access_token;
  credentials.password = undefined;
  const business = await request("/business");
  assert.ok(business.timezone);
  completed.push("Admin login and business read");
  const serviceBody = {
    name: "Dashboard verification service",
    description: "Fictional integration check",
    duration_minutes: 30,
    price: "1.00",
    currency: "INR",
    active: true,
  };
  const service = await request("/services", "POST", serviceBody);
  cleanups.push(() =>
    request(`/services/${service.id}`, "PUT", {
      ...serviceBody,
      active: false,
    }),
  );
  const providerBody = {
    name: "Dashboard verification provider",
    service_ids: [service.id],
    active: true,
  };
  const provider = await request("/providers", "POST", providerBody);
  cleanups.push(() =>
    request(`/providers/${provider.id}`, "PUT", {
      ...providerBody,
      active: false,
    }),
  );
  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    starts_at: "09:00",
    ends_at: "12:00",
  }));
  await request(`/providers/${provider.id}/hours`, "PUT", hours);
  assert.equal((await request(`/providers/${provider.id}/hours`)).length, 7);
  const customer = await request("/customers", "POST", {
    name: "Dashboard API verification",
    contact: null,
  });
  const lead = await request("/leads", "POST", {
    customer_id: customer.id,
    interest: "Fictional demo service",
  });
  await request(`/leads/${lead.id}`, "PATCH", { status: "closed" });
  completed.push(
    "Services, providers, assignments, weekly hours, customers and leads",
  );
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const available = await request(
    `/availability?${new URLSearchParams({ service_id: service.id, provider_id: provider.id, day })}`,
  );
  assert.ok(available.length > 1);
  const booking = {
    customer_id: customer.id,
    service_id: service.id,
    provider_id: provider.id,
    starts_at: available[0].starts_at,
  };
  const appointment = await request("/appointments", "POST", booking);
  cleanups.push(() =>
    request(`/appointments/${appointment.id}/cancel`, "POST"),
  );
  await assert.rejects(
    request("/appointments", "POST", booking),
    (error) => error.status === 409,
  );
  await assert.rejects(
    request(`/providers/${provider.id}/hours`, "PUT", []),
    (error) => error.status === 409,
  );
  const moved = await request(`/appointments/${appointment.id}`, "PATCH", {
    starts_at: available[1].starts_at,
  });
  assert.notEqual(moved.starts_at, appointment.starts_at);
  assert.equal(
    (await request(`/appointments/${appointment.id}/cancel`, "POST")).status,
    "cancelled",
  );
  completed.push(
    "Booking, duplicate conflict, schedule conflict, reschedule and cancellation",
  );
  const exception = await request(
    `/providers/${provider.id}/exceptions`,
    "POST",
    {
      starts_at: available[0].starts_at,
      ends_at: available[0].ends_at,
      available: false,
    },
  );
  await request(
    `/providers/${provider.id}/exceptions/${exception.id}`,
    "DELETE",
  );
  completed.push("Dated schedule exception create/delete");
  const faq = await request("/knowledge/faqs", "POST", {
    question: "Dashboard QA code?",
    answer: "The fictional verification code is mint-check-42.",
  });
  cleanups.push(() =>
    request(`/knowledge/faqs/${faq.id}`, "DELETE").catch((error) => {
      if (error.status !== 404) throw error;
    }),
  );
  await request(`/knowledge/faqs/${faq.id}`, "PUT", {
    question: "Dashboard QA code?",
    answer: "The fictional verification code is mint-check-43.",
  });
  const form = new FormData();
  form.set(
    "file",
    new Blob(
      [
        "Assistly fictional demo verification. The special preparation instruction is to bring a purple notebook. This is test knowledge, not real advice.",
      ],
      { type: "text/plain" },
    ),
    "dashboard-verification.txt",
  );
  const document = await request("/knowledge/documents", "POST", form);
  cleanups.push(() =>
    request(`/knowledge/documents/${document.id}`, "DELETE").catch((error) => {
      if (error.status !== 404) throw error;
    }),
  );
  assert.equal(document.status, "ready");
  const results = await request(
    "/knowledge/search?query=" +
      encodeURIComponent(
        "What special preparation instruction mentions a purple notebook?",
      ),
  );
  assert.ok(
    results.some(
      (row) =>
        row.source === document.name && row.content.includes("purple notebook"),
    ),
  );
  completed.push("FAQ create/update and real document embedding/search");
  const conversation = await request(
    "/chat/conversations",
    "POST",
    { name: "Dashboard handoff verification", contact: null },
    null,
  );
  await request(
    `/conversations/${conversation.conversation_id}/handoff`,
    "PUT",
    { active: true, reason: "Fictional integration check" },
  );
  const message = {
    conversation_id: conversation.conversation_id,
    request_id: crypto.randomUUID(),
    message: "A demo message while staff handle the conversation.",
  };
  const paused = await request(
    "/chat/messages",
    "POST",
    message,
    conversation.token,
  );
  assert.equal(paused.handoff_active, true);
  assert.equal(paused.reply, null);
  const history = await request(
    `/conversations/${conversation.conversation_id}/messages?after=0`,
  );
  assert.ok(history.some((row) => row.content === message.message));
  await request(
    `/conversations/${conversation.conversation_id}/handoff`,
    "PUT",
    { active: false, reason: null },
  );
  completed.push(
    "Conversation history, handoff message persistence and AI resume",
  );
} catch (error) {
  console.error("Verification failure:", error.message);
  process.exitCode = 1;
} finally {
  for (const cleanup of cleanups.reverse()) {
    try {
      await cleanup();
    } catch (error) {
      console.error("Demo cleanup:", error.message);
      process.exitCode = 1;
    }
  }
  console.log(
    JSON.stringify(
      {
        completed,
        cleanup:
          "Test appointments cancelled; test services/providers deactivated; FAQ/document removed. Demo contact and closed lead remain as history.",
      },
      null,
      2,
    ),
  );
}
