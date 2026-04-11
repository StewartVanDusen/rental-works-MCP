---
phase: 06-expansion
plan: 02
subsystem: tests
tags: [testing, unit-tests, integration-tests, address-tools, swagger-validation]
dependency_graph:
  requires: [06-01]
  provides: [address-tool-unit-tests, swagger-spec-120-tools, address-integration-smoke]
  affects: [src/__tests__/unit/address-tools.test.ts, src/__tests__/unit/swagger-spec.test.ts, src/__tests__/integration/live-api.test.ts]
tech_stack:
  added: []
  patterns: [vitest-mcp-tool-unit-test, integration-browse-smoke]
key_files:
  created:
    - src/__tests__/unit/address-tools.test.ts
  modified:
    - src/__tests__/unit/swagger-spec.test.ts
    - src/__tests__/integration/live-api.test.ts
    - src/__tests__/unit/tool-registration.test.ts
decisions:
  - "tool-registration.test.ts count updated to 115 (not 114) because change_order_status was added to utilities.ts in Plan 01 and counts the 11 original domains only"
  - "swagger-spec.test.ts count updated to 120 (114 original + 5 address + 1 change_order_status)"
metrics:
  duration: ~8 minutes
  completed: 2026-04-09
  tasks_completed: 2
  files_changed: 4
---

# Phase 6 Plan 2: Address Tool Tests and Swagger Spec Update Summary

**One-liner:** Unit tests for 5 address tools + change_order_status with swagger spec validation; address browse/get-by-ID integration smoke tests added.

## What Was Built

### Task 1: Address tools unit tests + swagger-spec update

Created `src/__tests__/unit/address-tools.test.ts` with 6 tests following the exact pattern from `customer-tools.test.ts`:

- `browse_addresses` — asserts POST `/api/v1/address/browse`, capturedBody not null
- `get_address` — asserts GET `/api/v1/address/A1`
- `create_address` — asserts POST `/api/v1/address`, capturedBody contains `Address1`
- `update_address` — asserts PUT `/api/v1/address/A1`, capturedBody contains `City`
- `delete_address` — asserts DELETE `/api/v1/address/A1`
- `change_order_status` — asserts POST `/api/v1/changeorderstatus/changestatus`, capturedBody contains `OrderId` + `StatusId`

Updated `swagger-spec.test.ts`:
- Added `import { registerAddressTools }` and `registerAddressTools(server)` call
- Updated tool count assertion from `toBe(114)` to `toBe(120)`
- Added `addresses (5 tools)` describe block with spec path validation for all 5 address tools
- Added `change_order_status` test inside the utilities describe section

### Task 2: Address integration smoke tests

Added to `src/__tests__/integration/live-api.test.ts`:
- `"browses address - valid shape"` in the Browse Smoke Tests describe block
- `"gets address by ID"` in the GET-by-ID describe block (skips gracefully if no data)

No mutation tests added. Both tests skip automatically when `RENTALWORKS_BASE_URL` is not set.

## Test Results

All 233 unit tests pass (`npm run test:unit`):
- `address-tools.test.ts`: 6/6 passing
- `swagger-spec.test.ts`: 121/121 passing (1 count + 120 path assertions)
- All other unit test files: unchanged pass rates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tool-registration.test.ts count assertion**
- **Found during:** Running `npm run test:unit` after Task 2
- **Issue:** `tool-registration.test.ts` expected `toBe(114)` but Plan 01 added `change_order_status` to `utilities.ts`, bringing the 11-domain count to 115. The count was never updated in Plan 01.
- **Fix:** Updated `tool-registration.test.ts` assertion from `toBe(114)` to `toBe(115)`
- **Files modified:** `src/__tests__/unit/tool-registration.test.ts`
- **Commit:** `328b6d4`

## Known Stubs

None.

## Threat Flags

None — test files do not introduce new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

Files exist:
- `src/__tests__/unit/address-tools.test.ts` — FOUND
- `src/__tests__/unit/swagger-spec.test.ts` — FOUND (modified)
- `src/__tests__/integration/live-api.test.ts` — FOUND (modified)

Commits exist:
- `5c07f73` — FOUND (address-tools.test.ts + swagger-spec.test.ts)
- `a55dc40` — FOUND (live-api.test.ts)
- `328b6d4` — FOUND (tool-registration.test.ts fix)
