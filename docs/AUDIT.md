# AI Operations Copilot Audit

Date: 2026-09-24

## Current Scope

The existing app is a React/Vite/TypeScript client with Firebase Auth, Firestore, Storage, and 2nd-gen Functions. Copilot is preserved and now calls the authenticated `startInvestigation` Function, which sends scoped evidence to Gemini and persists a validated result on the investigation document.

## Route Audit

| Route | Exists | Current behavior | Real data | Remaining work |
| --- | --- | --- | --- | --- |
| `/app/dashboard` | Yes | KPI, risk, action, chart, quick ask | Risks/actions use realtime Firestore listeners; KPI/chart remain seeded | Connect metrics aggregation and live outcome loop |
| `/app/copilot` | Yes | Question input, prompt chips, investigation list | Submission calls Gemini-backed Function | Add richer history query and shared evidence drawer |
| `/app/copilot/:id`, `/app/investigations/:id` | Yes | Live investigation detail | Realtime investigation document | Add evidence chunk retrieval and linked record navigation |
| `/app/risks`, `/app/risks/:id` | Yes | List/detail UI | List currently seeded; detail is static | Realtime list, filters, status Functions, evidence drawer |
| `/app/opportunities`, `/app/opportunities/:id` | Yes | List/detail UI | Seeded constants | Firestore listeners, filters, action creation |
| `/app/analytics` | Yes | Recharts and query controls | Seeded chart data | Metrics query Function and validated natural-language analytics |
| `/app/actions`, `/app/actions/:id/review`, `/app/actions/:id` | Yes | Center/detail/review surfaces | Seeded constants | Approve/reject/execute Functions, tickets, audit, notifications |
| `/app/documents`, `/app/documents/upload`, `/app/documents/:id` | Yes | List/upload/detail UI | List/detail now subscribe to Firestore when available | Storage upload pipeline, chunks, processing status, delete/reindex |
| `/app/data-sources`, `/app/data-sources/new`, `/app/data-sources/:id` | Yes | List/wizard/detail UI | Static | Connector validation, CSV/XLSX import, status persistence |
| `/app/notifications` | Yes | Notification list | Seeded constants | Realtime listener, mark read/all, unread count |
| `/app/audit-logs` | Yes | Read-only table | Seeded constants | Realtime/server pagination and role gating |
| `/app/settings/*` | Yes | Settings UI | Static | Persist organization, AI, notification, integration settings |
| `/app/profile` | Yes | Profile form UI | Firebase identity is shown in shell | Persist profile/preferences and avatar upload |
| `/unauthorized`, `*` | Yes | Error states | N/A | Add consistent retry/navigation affordances |

## Data Model Findings

- Existing Copilot collections: `investigations`, `risks`, `actions`, `documents`, `notifications`, `auditLogs`, `users`, `organizations`.
- Existing seed uses `orgId: demo-manufacturing`; onboarding now uses the same value and synchronizes custom claims.
- `opportunities`, `tickets`, `metrics`, and `entities` are not yet seeded as complete target-model collections.
- Existing document records have metadata but no client chunk preview or Storage processing pipeline.
- Existing audit logs are intended to be server-written; client reads need role-scoped queries and indexes.

## Functions Findings

Implemented or present: `startInvestigation`, `runNaturalLanguageAnalytics`, `createAction`, `writeAudit`, `onUserWrite`, `detectAnomalies`, `sendWelcomeEmail`, and basic API/ping endpoints.

The investigation Function now:

1. Verifies authentication and organization claim.
2. Reads organization-scoped risks, actions, and document metadata.
3. Calls Gemini using server-only `GEMINI_API_KEY`.
4. Validates JSON output with Zod.
5. Writes completed or failed status to Firestore for realtime UI updates.

Still needed for the full target workflow: action lifecycle Functions, document processing/import Functions, role management, settings persistence, outcome measurement, and scheduled anomaly detection.

## Rules and Indexes

- Firestore rules include organization isolation and role helpers.
- Client writes to `auditLogs` are denied.
- Action status transition rules exist but should be expanded for every target transition and Function-only execution fields.
- Compound indexes should be added as realtime filtered queries are introduced.
- Emulator rules tests are not yet present.

## Shared UI Findings

- Shared `Headline`, logo, token, and app shell components exist.
- Authenticated routing now uses Firebase session state and persisted onboarding state.
- Realtime subscription helpers are centralized in `apps/web/src/lib/firebase.ts`.
- Remaining work should reuse these helpers and the existing headline/card conventions rather than creating page-specific data clients.

## Verification

- `npm run build` passes.
- `npm --prefix functions run build` passes.
- `npm run lint` passes.
- Live Gemini execution requires `GEMINI_API_KEY` to be configured in Firebase Functions and the authenticated user to have an organization claim.
