import assert from "node:assert/strict";
import { DateTime } from "luxon";

// Public APIs only. This check creates fictional sessions and uses the configured
// AI account. --appointments additionally confirms and cancels a demo booking.
const base = process.env.ASSISTLY_API_URL || "http://127.0.0.1:8000";
async function call(path, method = "GET", body, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof value.detail === "string"
          ? value.detail
          : `HTTP ${response.status}`,
      ),
      { status: response.status },
    );
  return value;
}
const open = () =>
  call("/chat/conversations", "POST", {
    name: "Public chatbot verification",
    contact: null,
  });
const send = (session, message, requestId = crypto.randomUUID()) =>
  call(
    "/chat/messages",
    "POST",
    {
      conversation_id: session.conversation_id,
      request_id: requestId,
      message,
    },
    session.token,
  );
const snapshot = (session) =>
  call(
    `/chat/conversations/${session.conversation_id}`,
    "GET",
    undefined,
    session.token,
  );
const confirm = (session, action) =>
  call(
    `/chat/conversations/${session.conversation_id}/actions/${action.id}/confirm`,
    "POST",
    undefined,
    session.token,
  );
const config = await call("/chat/config");
assert.deepEqual(Object.keys(config).sort(), [
  "enabled_capabilities",
  "name",
  "terminology",
  "timezone",
]);
console.log("Public configuration contains only the agreed safe fields.");

for (const question of process.argv.includes("--appointments-only")
  ? []
  : ["Can I pay by UPI?", "Where is payment collected?"]) {
  const session = await open();
  const answer = await send(session, question);
  assert.match(answer.reply, /reception/i);
  if (question.includes("UPI")) assert.match(answer.reply, /UPI/i);
  else assert.match(answer.reply, /check.in/i);
  assert.equal(answer.pending_actions.length, 0);
  console.log(
    JSON.stringify({
      question,
      reply: answer.reply,
      conversation_id: session.conversation_id,
    }),
  );
  const other = await open();
  await assert.rejects(
    call(
      `/chat/conversations/${session.conversation_id}`,
      "GET",
      undefined,
      other.token,
    ),
    (error) => error.status === 404,
  );
}
if (!process.argv.includes("--appointments-only"))
  console.log(
    "Independent document answers and customer-session isolation passed.",
  );

if (
  process.argv.includes("--appointments") ||
  process.argv.includes("--appointments-only")
) {
  const session = await open();
  let day = DateTime.now().setZone(config.timezone).plus({ days: 2 });
  while (day.weekday === 7) day = day.plus({ days: 1 });
  const date = day.toISODate();
  const service = process.env.ASSISTLY_DEMO_SERVICE || "General consultation";
  const provider = process.env.ASSISTLY_DEMO_PROVIDER || "Dr. Demo";
  const text = `Please propose ${service} with ${provider} on ${date} at 09:00 in ${config.timezone}. I will review and confirm using the button.`;
  const requestId = crypto.randomUUID();
  const proposal = await send(session, text, requestId);
  const retry = await send(session, text, requestId);
  assert.deepEqual(retry, proposal);
  const action = proposal.pending_actions.find((row) => row.kind === "book");
  if (!action)
    console.error(
      JSON.stringify({
        step: "missing booking proposal",
        conversation_id: session.conversation_id,
        reply: proposal.reply,
      }),
    );
  assert.ok(action, "Expected a first-message booking proposal");
  assert.equal(action.details.service_name, service);
  assert.equal(action.details.provider_name, provider);
  assert.equal(
    DateTime.fromISO(action.details.starts_at)
      .setZone(config.timezone)
      .toFormat("yyyy-MM-dd HH:mm"),
    `${date} 09:00`,
    "The proposal must preserve the requested business-local date and time",
  );
  assert.equal(action.status, "pending");
  assert.equal(
    (await snapshot(session)).actions.find((row) => row.id === action.id)
      .result,
    null,
  );
  const booked = await confirm(session, action);
  console.log(
    JSON.stringify({
      step: "booking",
      appointment_id: booked.id,
      status: booked.status,
    }),
  );
  let scenarioError;
  try {
    const committed = (await snapshot(session)).actions.find(
      (row) => row.id === action.id,
    );
    assert.equal(committed.status, "confirmed");
    assert.equal(committed.result.id, booked.id);
    await assert.rejects(
      confirm(session, action),
      (error) => error.status === 409,
    );
    let moveDay = day.plus({ days: 1 });
    while (moveDay.weekday === 7) moveDay = moveDay.plus({ days: 1 });
    const move = await send(
      session,
      `Please propose moving appointment ${booked.id} to ${moveDay.toISODate()} at 09:00 in ${config.timezone} with the same service and provider.`,
    );
    const moveAction = move.pending_actions.find(
      (row) => row.kind === "reschedule",
    );
    assert.ok(moveAction, "Expected a reschedule proposal");
    assert.equal(
      DateTime.fromISO(moveAction.details.starts_at)
        .setZone(config.timezone)
        .toFormat("yyyy-MM-dd HH:mm"),
      `${moveDay.toISODate()} 09:00`,
      "Rescheduling must preserve the requested business-local time",
    );
    const moved = await confirm(session, moveAction);
    assert.notEqual(moved.starts_at, booked.starts_at);
    console.log(
      JSON.stringify({
        step: "reschedule",
        appointment_id: moved.id,
        status: moved.status,
      }),
    );
    assert.equal(
      (await snapshot(session)).actions.find((row) => row.id === action.id)
        .result.starts_at,
      committed.result.starts_at,
    );
    console.log(
      "Reload recovery, duplicate protection and immutable action results passed.",
    );
  } catch (error) {
    scenarioError = error;
  }
  async function cancelVerificationBooking() {
    const cancellation = await send(
      session,
      `Please propose cancelling my fictional verification appointment ${booked.id}.`,
    );
    const cancelAction = cancellation.pending_actions.find(
      (row) => row.kind === "cancel",
    );
    if (!cancelAction)
      throw new Error(
        `No cancellation proposal. Cancel demo appointment ${booked.id} through the dashboard.`,
      );
    const cancelled = await confirm(session, cancelAction);
    assert.equal(cancelled.status, "cancelled");
    const final = await snapshot(session);
    assert.equal(
      final.actions.find((row) => row.id === cancelAction.id).result.status,
      "cancelled",
    );
    console.log(
      JSON.stringify({
        step: "cancellation",
        appointment_id: cancelled.id,
        status: cancelled.status,
      }),
    );
  }
  await cancelVerificationBooking();
  if (scenarioError) throw scenarioError;
  const handoff = await send(
    session,
    "Please hand this conversation over to a person.",
  );
  assert.equal(handoff.handoff_active, true);
  const paused = await send(
    session,
    "This fictional message is for staff while AI is paused.",
  );
  assert.equal(paused.reply, null);
  assert.equal((await snapshot(session)).handoff_active, true);
  console.log("Customer handoff status and message persistence passed.");
}
