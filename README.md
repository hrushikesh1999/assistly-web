# Assistly web

Business administration and public customer chat for one Assistly deployment. React, TypeScript and Vite,
connected to the FastAPI backend in `../server`. All application data comes from
the backend; mocked responses are confined to automated tests.

## Run locally

Use Node 20.11 or later and npm. Start the database/backend using the server README,
then run:

```powershell
npm ci
npm run dev
```

Open [the dashboard](http://localhost:5173). Sign in using the configured backend
admin credentials. [Customer chat](http://localhost:5173/chat) is public and needs
no admin login. Credentials are never bundled in the frontend. An optional `.env.local`
can set `VITE_API_URL`; `.env.example` documents the default
`http://127.0.0.1:8000`. Never add an OpenAI key or admin password to a Vite variable.

The dev server stays on port 5173 because the backend's CORS configuration permits
`http://localhost:5173`. Other origins need an explicit backend CORS change.

## Features

- Admin login, logout and session-expiry handling.
- Business details, timezone, terminology, instructions and capabilities.
- Services, providers, assignments, weekly hours, breaks and dated changes.
- Paginated appointments, customers and leads; booking, rescheduling and cancellation.
- FAQ management, document upload/delete and knowledge search.
- Conversation history with incremental refresh and handoff/resume controls.
- Customer test chat, durable request IDs, proposal review, explicit confirmation
  and reconciliation after an uncertain confirmation result.

The appointment list is ordered by creation, following the current API. Previous/Next
controls paginate 25 records. Reference names are resolved by loading all reference
pages, 200 records at a time. No business-wide totals or unimplemented filters are
displayed. Provider exceptions show at most 200 records, the backend's current limit.

Schedules use the business timezone. Date/time changes send timezone offsets;
nonexistent or ambiguous daylight-saving local times require a different selection.
Backend conflicts leave form values intact. Services and providers are deactivated
instead of deleted.

Admin, admin test-chat and public customer tokens use separate session-storage
entries. Admin logout/expiry clears admin and test-chat state, preserving the public
customer session. Public sessions survive reloads in the same tab. Closing the tab
ends local access; it does not delete server history or undo bookings. New chats
are separate customer identities and cannot recover earlier sessions by name/phone.

## Public customer chat

`/chat` and `/chat/` load separately from the admin workspace. The first message
opens a customer session; customers can provide name/contact conversationally when
needed. Suggestions follow the business's enabled capabilities. Lead capture uses
the backend's consent-aware chat tools.

- Public profile and customer-only APIs provide branding, terminology and timezone.
- Message UUID/text survive retries and reloads. A retry reuses the original request.
- Human-readable proposals show service, provider, fee, local time and expiry.
  Only a button click calls confirmation. Historical confirmation cards are saved
  records, not claims about the appointment after later changes.
- Session snapshot and paginated history refresh every five seconds while visible
  and on window focus. Handoff pauses AI replies while messages remain saveable.
- Uncertain confirmations require a fresh authoritative snapshot before retry.
  A busy snapshot (409) leaves uncertainty unresolved. Confirmed action results
  are immutable and survive reloads; old confirmations without saved results
  display an explicit unavailable-details state.
- New chat requires confirmation. Invalid customer credentials offer an explicit
  new-session action rather than silently creating a different identity.

Customer access uses `assistly.customerChat.v1` in session storage. The dedicated
customer API wrapper never reads admin credentials and makes no admin API calls.
Transport, message pagination, notices and dialogs are shared; public conversation
state is managed by `src/customer/useCustomerChat.ts`. Its components are reusable
for a future widget, but embedding is not implemented in this phase.

The server chat owns the companion endpoints and migration `0002`:

- `GET /chat/config`: safe business name, timezone, terminology and capabilities.
- Customer-bearer `GET /chat/conversations/{id}`: handoff, pending proposals and
  action outcomes/results. It uses the conversation write lock and `no-store`.
- Existing message/confirmation routes include readable proposal/result metadata.

Private business instructions, admin credentials and retrieval payloads never form
part of these public responses. See the server README/OpenAPI for exact types.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover token separation, auth expiry, backend errors, full reference pagination,
timezone conversion, proposal expiry, confirmation guards, uncertain-result state,
stable message retries, duplicate clicks and handoff.
Public tests also cover login-free routing with an existing admin token, reset
isolation, lost confirmation responses, busy snapshots, legacy outcomes and history.

`npm run verify:live` is an **explicit, mutating** integration check for a local demo
backend. It accepts a single JSON object containing `username` and `password` on
stdin without echoing or saving credentials. It creates fictional services,
providers, contacts, leads, bookings, knowledge and conversations. It verifies real
document embeddings/search and therefore can incur configured OpenAI usage.
Cleanup cancels its appointments, deactivates its catalogue records, and removes
its FAQ/document. Demo contacts, a closed lead and conversation history remain.
Use `ASSISTLY_API_URL` to override the local backend URL for this script.

`npm run verify:customer` checks safe configuration, session isolation and the two
document questions as first messages in separate fresh conversations. It uses only
public/customer APIs, creates fictional sessions and incurs configured AI usage.
For the clinic demo, `npm run verify:customer -- --appointments` additionally checks
first-message booking, explicit confirmation, duplicate protection, rescheduling,
immutable recovery records, cancellation and handoff. The demo booking is cancelled
in cleanup. `ASSISTLY_DEMO_SERVICE` and `ASSISTLY_DEMO_PROVIDER` override the sample
names. Use this only with a designated demo backend.
`--appointments-only` skips the already-tested document questions for a targeted
booking rerun. Proposal and reschedule checks assert the requested business-local
date/time before confirming anything. Live model wording is variable; document
checks validate UPI/reception and payment-location/check-in facts respectively.

The production output is `dist/`. A future static host must serve `index.html` for
client routes and configure a browser-reachable backend with the correct CORS
origin. Public deployment is not configured in this phase.

## Integration notes

- Real AI service/price lookup and identical request-ID retry were verified.
- Real admin CRUD, schedule/booking conflicts, rescheduling, cancellation, FAQ edits,
  document embedding/search, message persistence and handoff/resume were verified.
- An initial AI booking request returned an empty reply. The server chat fixed
  empty-answer handling and proposal generation. The stepped live flow now passes:
  service discovery, availability, booking proposal, explicit confirmation,
  rescheduling and cancellation. All verification bookings were cancelled.
- First-message direct booking now passes after the server chat added catalogue
  discovery to each AI turn. The public-only lifecycle check passed and its demo
  booking was cancelled.
- Browser checks passed for admin booking/move/cancel, real AI services and
  availability replies, and mobile content width. Browser access was interrupted
  after the session limit reset, so the final AI proposal/confirmation check ran
  through the real HTTP APIs instead of the browser.
- The admin test screen continues to save proposals locally. Public chat uses the
  new customer snapshot endpoint to recover proposals and confirmed results.
- In the admin test screen, an uncertain confirmation checks saved history and verifies the referenced
  appointment and customer ownership through the admin APIs before
  offering an explicit retry. The backend's atomic, single-use action handling
  prevents duplicate changes if the first request is still completing.
- New public endpoints have typed OpenAPI responses. Older admin response types
  follow the inspected serialized models and service code.
- The UPI and payment-location questions passed independently as first messages.
  The server chat verified saved retrieval evidence from sample-clinic-guide.txt
  for both conversations, rather than relying on prior chat context.
- A browser review caught an AI UTC-offset mistake before confirmation. The server
  chat fixed business-local tool output and rejects mismatched booking/reschedule
  offsets. The same browser request now renders the requested 10:30 correctly.
- The model can still choose a new-booking proposal for a loosely worded move
  request. The card labels the proposed operation explicitly; that incorrect
  proposal was not confirmed. Providing the existing booking reference is used
  in lifecycle verification. Keep reviewing both operation and time before confirming.
- Staff replies, WhatsApp, billing, tenancy, voice and orders are deferred.

This frontend does not edit backend files or migrations; the server chat owns them.
