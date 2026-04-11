---
phase: 03-unit-tests-and-path-fixes
plan: "01"
subsystem: storefront-tools, unit-tests
tags: [path-fix, storefront, request-bodies, test-coverage]
dependency_graph:
  requires: []
  provides: [storefront_browse_categories-correct-path, request-bodies-url-assertions]
  affects: [src/tools/storefront.ts, src/__tests__/unit/swagger-spec.test.ts, src/__tests__/unit/request-bodies.test.ts]
tech_stack:
  added: []
  patterns: [fetch-stub-url-capture, vitest-unit-test]
key_files:
  created: []
  modified:
    - src/tools/storefront.ts
    - src/__tests__/unit/swagger-spec.test.ts
    - src/__tests__/unit/request-bodies.test.ts
decisions:
  - "Used actual source paths in request-bodies assertions (applybottomlinediscountpercent, quote/createorder, firstapprove) rather than plan-suggested paths — verified from source before writing"
  - "approve_purchase_order uses /api/v1/purchaseorder/firstapprove (first-level approval), not /approve"
  - "convert_quote_to_order uses /api/v1/quote/createorder, not /api/v1/order/convertquote"
  - "apply_order_discount uses /api/v1/order/applybottomlinediscountpercent, not /api/v1/order/discount"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 3
---

# Phase 03 Plan 01: Storefront Path Fix and Request-Bodies URL Assertions Summary

Fixed storefront_browse_categories to call GET /api/v1/storefront/catalog/{catalogId}/categorytree and upgraded all 7 request-bodies.test.ts it() blocks to assert capturedUrl + capturedMethod in addition to capturedBody.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix storefront_browse_categories path and update swagger-spec test | baf8911 | src/tools/storefront.ts, src/__tests__/unit/swagger-spec.test.ts |
| 2 | Add capturedUrl assertions to all 7 request-bodies.test.ts it() blocks | f48dd68 | src/__tests__/unit/request-bodies.test.ts |

## What Was Built

**Task 1 — Storefront path fix:**
- Replaced `storefront_browse_categories` tool schema from `{page, pageSize}` pagination to `{catalogId: z.string()}`
- Changed handler from `client.post("/api/v1/storefrontcatalog/browse", {...})` to `client.get(\`/api/v1/storefront/catalog/${catalogId}/categorytree\`)`
- Updated swagger-spec.test.ts it() label and args to pass `{ catalogId: "CAT1" }`
- All 115 swagger-spec tests pass

**Task 2 — Request-bodies URL capture:**
- Added `let capturedUrl: string` module-level variable
- Capture `capturedUrl = urlStr` in fetch stub before JWT check
- Reset `capturedUrl = ""` in beforeEach
- Updated all 7 it() blocks with `expect(capturedUrl).toContain(...)` and `expect(capturedMethod).toBe("POST")` assertions
- Updated it() labels to include method + path
- Used actual source paths (verified against orders.ts and vendors.ts)

## Verification Results

- `npx vitest run src/__tests__/unit/swagger-spec.test.ts` — 115/115 passed
- `npx vitest run src/__tests__/unit/request-bodies.test.ts` — 7/7 passed
- `npm test` — 164/164 passed (6 test files)
- `grep -c "capturedUrl" request-bodies.test.ts` → 10 (1 declaration + 1 reset + 1 capture + 7 assertions)
- `grep "storefrontcatalog/browse" storefront.ts` → no matches (old path removed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used actual source paths in URL assertions, not plan-suggested paths**
- **Found during:** Task 2 (pre-write verification of source files)
- **Issue:** Plan listed `/api/v1/order/discount`, `/api/v1/order/convertquote`, `/api/v1/purchaseorder/approve` as assertion targets, but actual source uses different paths
- **Actual paths in source:**
  - `apply_order_discount` → `/api/v1/order/applybottomlinediscountpercent`
  - `convert_quote_to_order` → `/api/v1/quote/createorder`
  - `approve_purchase_order` → `/api/v1/purchaseorder/firstapprove`
- **Fix:** Used actual source paths so assertions match real behavior
- **Files modified:** src/__tests__/unit/request-bodies.test.ts
- **Commit:** f48dd68

## Known Stubs

None — all tools call real endpoints with real parameters.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Changes are path corrections and test coverage additions only.

## Self-Check: PASSED

- src/tools/storefront.ts — FOUND, contains `catalogId` and `categorytree`
- src/__tests__/unit/swagger-spec.test.ts — FOUND, contains `catalogId: "CAT1"`
- src/__tests__/unit/request-bodies.test.ts — FOUND, contains `capturedUrl`
- Commit baf8911 — FOUND
- Commit f48dd68 — FOUND
