# RentalWorks MCP Server — Production Readiness

## What This Is

An MCP server wrapping the RentalWorks rental management platform API. Currently exposes ~114 tools across 11 domains (inventory, orders, customers, contracts, billing, vendors, reports, settings, admin, storefront, utilities). Needs validation against the live Swagger spec, expanded coverage for missing high-value endpoints, comprehensive testing including integration tests against the live instance, and bug fixes to be production-ready.

## Core Value

Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.

## Requirements

### Validated

- ✓ JWT authentication with auto-refresh — existing
- ✓ Browse pattern with pagination, search, sort, filtering — existing
- ✓ CRUD operations for core entities (inventory, orders, customers, deals, vendors) — existing
- ✓ Report rendering, data export, and Excel export — existing
- ✓ Checkout/checkin session workflow — existing
- ✓ Error handling with known RW server-side issue detection — existing
- ✓ Raw API escape hatches (raw_api_browse, raw_api_get, raw_api_post) — existing

### Active

- [ ] All ~114 existing tool API paths validated against Swagger spec
- [ ] Missing `zod` dependency added to package.json
- [ ] Every tool has a unit test verifying correct HTTP method, path, and request body
- [ ] Integration tests that hit the live API (read-only: GET/browse only)
- [ ] Bug fixes for any incorrect paths, methods, or body formats found during validation
- [ ] Expanded coverage: high-value missing endpoints added (e.g. dashboard, activities, address management, inventory merge, change order status)
- [ ] Error handling tests (API failures, auth failures, malformed responses)
- [ ] Storefront category browsing path corrected (currently uses `/storefrontcatalog/browse`, Swagger shows `/storefront/catalog/{id}/categorytree`)
- [ ] All checkout/checkin endpoint paths verified against warehouse-v1 Swagger spec
- [ ] All invoice lifecycle paths verified (approve, process, void)

### Out of Scope

- Mobile/QuikScan endpoints — specialized scanner hardware workflows, not useful via MCP
- Plugins API — instance-specific plugin endpoints
- Pages API — only 2 CardPointe payment page endpoints
- System admin endpoints (CreateNewSystem, etc.) — dangerous, shouldn't be in MCP
- OAuth/Okta/Azure AD auth flows — current JWT auth is sufficient
- Real-time features (webhooks, long-polling) — outside MCP server pattern

## Context

- **API Spec**: https://modernlighting.rentalworks.cloud/swagger/index.html (12 sub-specs)
- **Existing tests**: 5 test files covering path validation, tool registration, request bodies, removed tools, and helper utilities
- **Known server-side issues**: Several RW endpoints return 500 errors due to invalid DB column references — already handled with `withErrorHandling` wrapper
- **Live testing**: Read-only API calls permitted against the live instance for integration testing
- **Key API sections**: accountservices-v1, home-v1 (main CRUD), warehouse-v1, settings-v1, reports-v1, utilities-v1, administrator-v1, storefront-v1

## Constraints

- **Read-only integration tests**: Live API tests must not create, update, or delete any data
- **Tech stack**: TypeScript, MCP SDK, Vitest, Zod — no additional frameworks
- **API compatibility**: Must match the exact paths/methods from the Swagger spec — RW API is not REST-conventional in many places

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Validate existing before expanding | Fix what's built first, then add coverage | — Pending |
| Integration tests read-only | Live instance has real data, can't risk mutations | — Pending |
| Generic tools (raw_api_*, browse_settings_entity) as escape hatches | Can't cover all ~3000+ RW endpoints, generics fill gaps | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after initialization*
