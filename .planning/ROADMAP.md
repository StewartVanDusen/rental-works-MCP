# Roadmap: RentalWorks MCP Server — Production Readiness

## Overview

This milestone hardens an existing 114-tool MCP server from "works on my machine" to production-correct. The journey moves through four sequential concerns: fix the foundation so fresh checkouts work, validate every existing path against the authoritative Swagger spec, build a complete unit and error-handling test suite with those confirmed-correct paths, prove reality against the live API via read-only integration tests, and finally expand with high-value missing endpoints — but only after all 114 existing tools are validated.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### v1.0 — Production Readiness

- [ ] **Phase 1: Foundation** - Fix missing `zod` dep, reorganize test structure, configure Vitest projects
- [x] **Phase 2: Swagger Validation** - Build spec-loading machinery and produce a path-mismatch report across all 114 tools (completed 2026-04-10)
- [ ] **Phase 3: Unit Tests and Path Fixes** - Fix all discovered broken paths and write complete unit tests for every tool
- [ ] **Phase 4: Error Handling** - Prove auth failures, 500 wrapping, and malformed responses via targeted tests
- [ ] **Phase 5: Integration Tests** - Read-only live API smoke tests confirming reality against the actual instance
- [ ] **Phase 6: Expansion** - Add high-value missing endpoints after all existing tools are validated

### v1.1 — Inventory Browse Fix

- [ ] **Phase 7: Browse Utilities** - New browse-helpers.ts with client-side filter and fallback logic, fully unit-tested
- [x] **Phase 8: Schema and Formatter Extension** - Add optional fields/clientFilter params to inventory tool schemas; extend formatBrowseResult with field projection
- [ ] **Phase 9: Inventory Handler Wiring** - Wire helpers into inventory browse handlers with BRIEF_FIELDS defaults, smaller page size, and corrected pagination metadata
- [ ] **Phase 10: Integration Verification** - Read-only live API tests confirming field selection, client-side fallback, and default behavior against real inventory data
- [ ] **Phase 11: Comprehensive Browse Tool Hardening** (INSERTED 2026-04-28) - Extend the inventory fix to every browse/get tool: route all 35+ browse handlers through `client.browse()`, coerce numeric schema inputs, wire `withErrorHandling()` universally, trim `get_session`, brief-preset all entities

## Phase Details

### Phase 1: Foundation
**Goal**: The project builds cleanly from a fresh checkout and the test infrastructure is correctly structured for multi-suite execution
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. `npm ci` on a clean machine with no prior node_modules succeeds without any Zod resolution errors
  2. `vitest --project unit` runs only unit tests; `vitest --project integration` runs only integration tests
  3. Existing 5 test files are located under `src/__tests__/unit/` and all pass after relocation
  4. `vitest.config.ts` has a `projects` array defining separate `unit` and `integration` test configurations
**Plans:** 1 plan
Plans:
- [x] 01-01-PLAN.md — Add missing deps (zod, coverage), restructure tests into unit/integration dirs, configure Vitest projects

### Phase 2: Swagger Validation
**Goal**: Every one of the 114 tool API paths has been compared against the authoritative Swagger spec and a confirmed list of path bugs has been produced
**Depends on**: Phase 1
**Requirements**: PATH-01, PATH-02, PATH-07
**Success Criteria** (what must be TRUE):
  1. A `scripts/fetch-swagger.ts` script successfully fetches and caches all 12 RentalWorks sub-specs locally
  2. A sub-spec domain mapping table exists documenting which tool domain maps to which Swagger sub-spec
  3. `swagger-spec.test.ts` runs against all 114 tools and produces a list of path mismatches (pass or explicit report — no silent gaps)
  4. The exact set of incorrect paths is known and documented before any fixes begin
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md — Fetch all 12 Swagger sub-specs and generate merged path cache
- [x] 02-02-PLAN.md — Validate all 114 tool paths against cached Swagger spec

### Phase 3: Unit Tests and Path Fixes
**Goal**: All 114 tools have correct API paths and a unit test that asserts the exact HTTP method, URL path, and request body shape
**Depends on**: Phase 2
**Requirements**: PATH-03, PATH-04, PATH-05, PATH-06, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. Every incorrect path identified in Phase 2 is fixed in source — `swagger-spec.test.ts` produces zero mismatches
  2. The storefront category browsing tool calls `/storefront/catalog/{id}/categorytree`, not `/storefrontcatalog/browse`
  3. All checkout/checkin tool paths match the warehouse-v1 Swagger spec
  4. All invoice lifecycle paths (approve, process, void) match the confirmed spec
  5. Every `it()` block in the unit test suite asserts both `capturedUrl` and `capturedMethod` — no shape-only assertions remain
**Plans:** 3 plans
Plans:
- [x] 03-01-PLAN.md — Fix storefront path bug, audit request-bodies.test.ts assertions, verify PATH-05/PATH-06
- [x] 03-02-PLAN.md — Unit tests for billing (13 tools) and admin (5 tools) domains
- [x] 03-03-PLAN.md — Unit tests for customer (13 tools) and settings (14 tools) domains

### Phase 4: Error Handling
**Goal**: Auth failures, API 500s, and malformed responses are all proven to produce user-friendly structured outputs rather than silent failures or crashes
**Depends on**: Phase 3
**Requirements**: TEST-06, TEST-07, TEST-08, TEST-09
**Success Criteria** (what must be TRUE):
  1. A 4xx API response returns a user-readable error message, not an unhandled exception
  2. A 401/403 response triggers the JWT re-authentication path (confirmed via test)
  3. An HTML error page or empty body returned from the API is handled gracefully without a parse crash
  4. `withErrorHandling` is confirmed to detect known RentalWorks server-side issues and surface them as structured errors
**Plans:** 2 plans
Plans:
- [x] 04-01-PLAN.md — Add 401/403 retry logic and JSON.parse guard to api-client.ts
- [x] 04-02-PLAN.md — Error handling test suite (TEST-06 through TEST-09)

### Phase 5: Integration Tests
**Goal**: The MCP server is confirmed to work correctly against the real RentalWorks API instance using read-only requests
**Depends on**: Phase 2
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06
**Success Criteria** (what must be TRUE):
  1. Integration tests skip automatically when `RENTALWORKS_BASE_URL` is not set — no credential errors in CI
  2. A real JWT token is acquired from the live instance during the test run
  3. Browse smoke tests for inventory, orders, customers, and deals return non-empty results with the expected field shapes
  4. At least one GET-by-ID test per domain returns a record matching the expected schema
  5. `/api/v1/account/session` returns a valid session object during integration runs
**Plans:** 1 plan
Plans:
- [x] 05-01-PLAN.md — Integration test suite: vitest config timeouts + live API test file (auth, browse, GET-by-ID, session)

### Phase 6: Expansion
**Goal**: High-value missing endpoints are added as new tools that follow the validated patterns and pass Swagger-backed path assertions
**Depends on**: Phase 3
**Requirements**: EXPN-01, EXPN-02, EXPN-03, EXPN-04
**Success Criteria** (what must be TRUE):
  1. Address management tools (browse, get, create, update, delete) are available and call confirmed home-v1 API paths
  2. A change order status utility tool is available and calls the confirmed utilities-v1 API path
  3. Every new tool has a unit test asserting `capturedUrl`, `capturedMethod`, and request body shape
  4. Integration smoke tests for new read-capable tools pass against the live instance
**Plans:** 2 plans
Plans:
- [x] 06-01-PLAN.md — Create address CRUD tools and change_order_status utility tool
- [x] 06-02-PLAN.md — Unit tests and integration smoke tests for all new tools

### Phase 7: Browse Utilities
**Goal**: Pure utility functions for client-side filtering and graceful API fallback exist in a standalone module, fully tested with no MCP SDK dependency
**Depends on**: Phase 6
**Requirements**: CFLT-01, CFLT-02
**Success Criteria** (what must be TRUE):
  1. `src/utils/browse-helpers.ts` exists and exports `applyClientFilter`, `withClientSideFallback`, `RENTAL_INVENTORY_BRIEF_FIELDS`, and `ITEMS_BRIEF_FIELDS` with no import from `@modelcontextprotocol/sdk`
  2. `applyClientFilter` correctly applies all six operators (`like`, `contains`, `startswith`, `endswith`, `=`, `<>`) against in-memory row arrays, verified by unit tests using mock data
  3. `withClientSideFallback` detects an "Invalid column name" 500 error, retries the fetch without server-side search fields, and applies `applyClientFilter` to the retry results — verified by unit tests with a mock API client
  4. Unit tests for `browse-helpers.ts` pass with `vitest --project unit` and require no network access or environment variables
**Plans:** 1 plan
Plans:
- [x] 07-01-PLAN.md — TDD: Create browse-helpers.ts with applyClientFilter, withClientSideFallback, and field constants + full unit test suite

### Phase 8: Schema and Formatter Extension
**Goal**: Inventory browse tools accept optional `fields` and `clientFilter` parameters and `formatBrowseResult` can project a subset of fields — all changes backward-compatible, existing 114 tools unaffected
**Depends on**: Phase 7
**Requirements**: FSEL-01, FSEL-02
**Success Criteria** (what must be TRUE):
  1. Passing `fields: ["InventoryId", "Description"]` to an inventory browse tool returns rows containing only those two fields
  2. Passing `fieldPreset: "summary"` returns the curated `RENTAL_INVENTORY_BRIEF_FIELDS` set without the caller knowing individual field names
  3. All existing unit tests for non-inventory tools pass without modification after the schema change — `grep "fields" src/utils/tool-helpers.ts` returns nothing (no pollution of shared `browseSchema`)
  4. `npx tsc --noEmit` passes after changes to `tool-helpers.ts`
**Plans:** 1 plan
Plans:
- [x] 08-01-PLAN.md — Add inventoryFieldSchema, projectFields, resolveFieldPreset; extend formatBrowseResult; spread into inventory.ts
**UI hint**: no

### Phase 9: Inventory Handler Wiring
**Goal**: Inventory browse handlers deliver trimmed, filtered, correctly-paginated responses by default — agents get useful results without knowing internal field names or page sizes
**Depends on**: Phase 8
**Requirements**: FSEL-03, CFLT-03, ROPT-01
**Success Criteria** (what must be TRUE):
  1. `browse_rental_inventory` and `browse_items` default to page size 10 (down from 25) when no `pageSize` is specified
  2. A browse call with no `fields` or `fieldPreset` argument returns the `BRIEF_FIELDS` default set (~200 chars/item vs ~2,200 chars previously)
  3. When client-side filtering is active, the response metadata reads "Showing X of Y (client-filtered)" where X is the filtered count and Y is the unfiltered API total — agents are never given a misleading total
  4. CRUD tools in `inventory.ts` (get, create, update, delete) are completely unchanged — verified by running the existing unit test suite with zero modifications to CRUD-related tests
**Plans:** 1 plan
Plans:
- [x] 09-01-PLAN.md — Wire browse handlers with field defaults, page size override, client-filtered metadata, and withClientSideFallbackTracked utility

### Phase 10: Integration Verification
**Goal**: All v1.1 changes are confirmed to work correctly against the live RentalWorks API instance using read-only requests
**Depends on**: Phase 9
**Requirements**: (verification phase — confirms FSEL-01 through ROPT-01 in production conditions)
**Success Criteria** (what must be TRUE):
  1. A `browse_rental_inventory` call with `fields: ["InventoryId", "Description"]` against the live API returns rows with only those two fields and no extra keys
  2. A browse call that triggers the "Invalid column name" 500 error automatically retries and returns client-filtered results — confirmed by passing a known-broken filter column in the test
  3. A default (no arguments) `browse_rental_inventory` call returns at most 10 items with the BRIEF_FIELDS shape — total response under 3,000 chars
  4. Integration tests skip automatically when `RENTALWORKS_BASE_URL` is not set
**Plans:** 1 plan
Plans:
- [ ] 10-01-PLAN.md — Integration tests for v1.1 browse enhancements (field selection, BRIEF_FIELDS defaults, client-side fallback, response size)

## Progress

**Execution Order:**
v1.0: 1 -> 2 -> 3 -> 4 -> 5 -> 6 (Phase 5 depends on Phase 2, not Phase 4)
v1.1: 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/1 | Not started | - |
| 2. Swagger Validation | 2/2 | Complete | 2026-04-10 |
| 3. Unit Tests and Path Fixes | 0/3 | Not started | - |
| 4. Error Handling | 0/2 | Not started | - |
| 5. Integration Tests | 0/1 | Not started | - |
| 6. Expansion | 0/2 | Not started | - |
| 7. Browse Utilities | 0/1 | Not started | - |
| 8. Schema and Formatter Extension | 1/1 | Complete | 2026-04-11 |
| 9. Inventory Handler Wiring | 0/1 | Not started | - |
| 10. Integration Verification | 0/1 | Not started | - |
