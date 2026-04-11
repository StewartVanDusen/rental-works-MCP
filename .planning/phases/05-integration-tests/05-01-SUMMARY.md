---
phase: 05-integration-tests
plan: "01"
subsystem: testing
tags: [integration-tests, live-api, vitest, jwt, read-only]
dependency_graph:
  requires: [src/utils/api-client.ts, src/types/api.ts]
  provides: [src/__tests__/integration/live-api.test.ts]
  affects: [vitest.config.ts]
tech_stack:
  added: []
  patterns: [describe.skipIf credential guard, browse+getById read-only pattern, graceful no-data skip]
key_files:
  created:
    - src/__tests__/integration/live-api.test.ts
  modified:
    - vitest.config.ts
decisions:
  - "Use describe.skipIf(!isLiveEnv) at outermost describe level — all 14 tests skip as a unit when no credentials, preserving exit 0 in CI"
  - "Guard GET-by-ID tests with `if (browse.TotalRows === 0) return` rather than expect — avoids false failures on empty datasets"
  - "Assert field presence via toHaveProperty only, never field values — prevents PII leakage in test output (STRIDE T-05-03)"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-10"
  tasks: 2
  files_changed: 2
requirements: [INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06]
---

# Phase 5 Plan 01: Live API Integration Test Suite Summary

**One-liner:** Read-only integration test suite with credential-guard skip, JWT auth, browse smoke, GET-by-ID, and session tests covering all 6 INTG requirements.

## What Was Built

### Task 1 — vitest timeout config (`535d03b`)

Added `testTimeout: 15000` and `hookTimeout: 15000` to the integration project block in `vitest.config.ts`. The unit project block is unchanged. This prevents JWT acquisition in `beforeAll` from hitting the default 5000ms timeout.

### Task 2 — Live API integration test suite (`1869510`)

Created `src/__tests__/integration/live-api.test.ts` with 14 tests organized in 4 nested describe blocks inside a single `describe.skipIf(!isLiveEnv)` guard:

| Describe Block | Tests | INTG Requirements |
|----------------|-------|-------------------|
| Authentication (INTG-02) | 1 — JWT token acquisition | INTG-02 |
| Session (INTG-05) | 1 — /account/session field presence | INTG-05 |
| Browse Smoke Tests (INTG-03, INTG-06) | 4 — rentalinventory, order, customer, deal | INTG-03, INTG-06 |
| GET-by-ID (INTG-04, INTG-06) | 8 — all domains | INTG-04, INTG-06 |

**INTG-01 (skip guard):** `const isLiveEnv = !!process.env.RENTALWORKS_BASE_URL` — all 14 tests skip cleanly with exit 0 when no credentials are present.

**Security constraints honored (STRIDE):**
- T-05-01: No `console.log(jwt)` — only field properties asserted
- T-05-02: Zero calls to `client.create`, `client.update`, `client.remove`, `client.put`, `client.delete`
- T-05-03: All assertions use `toHaveProperty` — no value assertions that could leak PII
- T-05-04: Credentials come from env vars; `describe.skipIf` prevents accidental runs without them

## Verification Results

```
npx vitest run --project integration
↓ |integration| src/__tests__/integration/live-api.test.ts (14 tests | 14 skipped)
Test Files  1 skipped (1)
     Tests  14 skipped (14)
  Duration  383ms
```

Exit 0. All 14 tests skip cleanly without credentials.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All test assertions are structural (field presence) — no placeholder data flows to rendering.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. Test file only consumes existing `api-client.ts` interfaces.

## Self-Check: PASSED

- `src/__tests__/integration/live-api.test.ts` — FOUND
- `vitest.config.ts` — FOUND (contains testTimeout: 15000, hookTimeout: 15000)
- Commit `535d03b` — FOUND (chore(05-01): add 15-second timeouts)
- Commit `1869510` — FOUND (feat(05-01): create live API integration test suite)
