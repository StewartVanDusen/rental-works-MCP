---
phase: 09-inventory-handler-wiring
plan: "01"
subsystem: inventory-browse
tags: [browse-helpers, inventory, field-projection, client-side-filtering, page-size]
dependency_graph:
  requires:
    - 08-01 (inventoryFieldSchema, resolveFieldPreset, projectFields, formatBrowseResult with fields option)
    - 07-01 (withClientSideFallback, applyClientFilter, BRIEF_FIELDS constants)
  provides:
    - withClientSideFallbackTracked (tracked fallback with clientFiltered + unfilteredTotal metadata)
    - browse_rental_inventory wired with page size 10 default, BRIEF_FIELDS projection, client-filtered suffix
    - browse_items wired with page size 10 default, BRIEF_FIELDS projection, client-filtered suffix
  affects:
    - All callers of browse_rental_inventory and browse_items tools
tech_stack:
  added: []
  patterns:
    - withClientSideFallbackTracked wraps withClientSideFallback pattern with metadata return
    - Handler composition: buildBrowseRequest -> withClientSideFallbackTracked -> resolveFieldPreset -> formatBrowseResult + suffix
key_files:
  created:
    - src/utils/browse-helpers.ts (ClientSideFallbackResult type + withClientSideFallbackTracked function)
    - src/__tests__/unit/inventory-browse.test.ts (11 tests covering Groups A-E)
  modified:
    - src/tools/inventory.ts (browse_rental_inventory and browse_items handlers rewritten, imports expanded)
    - src/__tests__/unit/browse-helpers.test.ts (5 new tests A-E for withClientSideFallbackTracked)
decisions:
  - Use ClientSideFallbackResult return type to expose clientFiltered and unfilteredTotal to handlers
  - Append suffix string to formatBrowseResult output rather than modifying the formatter
  - Default fieldPreset to "summary" in handler via args.fieldPreset ?? "summary" to avoid schema-level coupling
  - Test handler glue logic via simulation functions rather than McpServer instantiation for cleaner unit tests
metrics:
  duration: "~8 minutes"
  completed: "2026-04-11T20:46:36Z"
  tasks_completed: 2
  files_changed: 4
requirements: [FSEL-03, CFLT-03, ROPT-01]
---

# Phase 09 Plan 01: Inventory Handler Wiring Summary

**One-liner:** Wire browse_rental_inventory and browse_items handlers with withClientSideFallbackTracked, BRIEF_FIELDS default projection, and page size 10 default.

## What Was Built

Completed the v1.1 inventory browse fix by wiring the utilities built in phases 07-08 into the actual `browse_rental_inventory` and `browse_items` MCP tool handlers.

### Task 1: Add withClientSideFallbackTracked to browse-helpers.ts (TDD)

Added two new exports to `src/utils/browse-helpers.ts`:

1. `ClientSideFallbackResult<T>` type — wraps a `BrowseResponse<T>` with two metadata fields:
   - `clientFiltered: boolean` — true when client-side filtering was applied after API fallback
   - `unfilteredTotal: number` — the total row count from the API before client-side filtering

2. `withClientSideFallbackTracked<T>()` function — identical logic to `withClientSideFallback` but returns `ClientSideFallbackResult<T>` instead of `BrowseResponse<T>`. This allows handlers to know whether the response was client-filtered and surface that information to the user.

TDD RED: 5 tests written and confirmed failing before implementation.
TDD GREEN: Function implemented, all 33 browse-helpers tests pass.

### Task 2: Wire browse handlers

Modified `src/tools/inventory.ts`:

1. **Expanded imports**: Added `resolveFieldPreset`, `withClientSideFallbackTracked` to the browse-helpers import, added `import type { BrowseResponse }` from api.ts.

2. **Page size override (ROPT-01)**: Both `browse_rental_inventory` and `browse_items` schemas now shadow `browseSchema`'s `pageSize: z.number().optional().default(25)` with `pageSize: z.number().optional().default(10)`. Agents get compact results by default.

3. **Handler rewrite (FSEL-03, CFLT-03)**: Both handlers now:
   - Call `withClientSideFallbackTracked` (handles the Invalid column name fallback)
   - Resolve fields via `args.fields ?? resolveFieldPreset(args.fieldPreset ?? "summary", entityType)` — defaults to BRIEF_FIELDS
   - Pass resolved fields to `formatBrowseResult(data, { fields: resolvedFields })`
   - Append `"\nShowing X of Y (client-filtered)"` suffix when `clientFiltered === true`

4. **CRUD tools unchanged**: `get_rental_inventory`, `create_rental_inventory`, `update_rental_inventory`, `delete_rental_inventory`, and all other non-browse tools are byte-identical to before.

Created `src/__tests__/unit/inventory-browse.test.ts` with 11 tests across 5 groups:
- Group A: Default page size 10 sent in request
- Group B: Default BRIEF_FIELDS projection in output
- Group C: "(client-filtered)" suffix in output when fallback fires
- Group D: Explicit `fields` array overrides BRIEF_FIELDS
- Group E: `fieldPreset: "full"` disables projection (all fields returned)

## Verification Results

```
Test Files  14 passed (14)
Tests       280 passed (280)
```

All 280 unit tests pass including:
- 28 pre-existing browse-helpers tests (unchanged)
- 5 new withClientSideFallbackTracked tests
- 121 swagger-spec tests (unchanged)
- 11 new inventory-browse tests
- All other existing unit tests

TypeScript: Only pre-existing `error-handling.test.ts` type errors remain (existed before this plan, also present in main branch).

## Deviations from Plan

### Worktree Baseline Sync (Rule 3 - Blocking)

**Found during:** Setup before Task 1

**Issue:** The worktree was initialized from an older base commit and was missing several source files that the test suite depends on: `src/tools/addresses.ts`, `src/tools/utilities.ts` (older version), `src/utils/api-client.ts` (older version without 401 re-auth logic), `src/index.ts` (without `registerAddressTools`), `scripts/swagger-cache.json`.

**Fix:** Checked out the correct phase 08 versions of all affected files from commit `288ed9b` before beginning implementation. This was necessary to get the baseline test suite to pass (14 test files, 264 tests) and ensure our changes were being tested against the correct foundation.

**Files modified:** `src/tools/addresses.ts`, `src/tools/utilities.ts`, `src/utils/api-client.ts`, `src/index.ts`, `scripts/fetch-swagger.ts`, `scripts/swagger-cache.json`

### Plan Acceptance Criteria Discrepancy (documentation)

**Found during:** Task 2 verification

**Issue:** The plan's acceptance criteria stated "grep 'formatEntity' src/tools/inventory.ts returns same count as before (4 occurrences)". The actual count is 7 (6 usages + 1 import line), which is the pre-existing count at phase 08 baseline. The "4" in the plan was inaccurate documentation.

**Fix:** Verified count matches the phase 08 baseline (7), confirming no CRUD tool changes were made.

## Known Stubs

None. All behaviors are fully implemented:
- `withClientSideFallbackTracked` has real logic (not a stub)
- Default field projection uses actual `BRIEF_FIELDS` constants
- Page size override uses actual Zod `.default(10)` (takes effect in requests)
- Client-filtered suffix uses actual `clientFiltered` and `unfilteredTotal` values from the response

## Threat Flags

None. No new trust boundaries introduced. Field projection and client-side filtering operate on data already authenticated and returned from the API.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/utils/browse-helpers.ts | FOUND |
| src/tools/inventory.ts | FOUND |
| src/__tests__/unit/browse-helpers.test.ts | FOUND |
| src/__tests__/unit/inventory-browse.test.ts | FOUND |
| Commit 6a48c90 (Task 1) | FOUND |
| Commit 7cd3d3e (Task 2) | FOUND |
