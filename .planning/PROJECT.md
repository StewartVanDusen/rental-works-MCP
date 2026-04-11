# RentalWorks MCP Server — Production Readiness

## What This Is

An MCP server wrapping the RentalWorks rental management platform API. Currently exposes ~114 tools across 11 domains (inventory, orders, customers, contracts, billing, vendors, reports, settings, admin, storefront, utilities). Needs validation against the live Swagger spec, expanded coverage for missing high-value endpoints, comprehensive testing including integration tests against the live instance, and bug fixes to be production-ready.

## Core Value

Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.

## Requirements

### Validated

- ✓ JWT authentication with auto-refresh — v1.0
- ✓ Browse pattern with pagination, search, sort, filtering — v1.0
- ✓ CRUD operations for core entities (inventory, orders, customers, deals, vendors) — v1.0
- ✓ Report rendering, data export, and Excel export — v1.0
- ✓ Checkout/checkin session workflow — v1.0
- ✓ Error handling with known RW server-side issue detection — v1.0
- ✓ Raw API escape hatches (raw_api_browse, raw_api_get, raw_api_post) — v1.0
- ✓ All 114 tool API paths validated against Swagger spec — v1.0
- ✓ Unit tests for HTTP method, path, and request body — v1.0
- ✓ Integration tests (read-only) against live API — v1.0

### Active

- [ ] Client-side field selection for browse tools — callers specify which fields to return, reducing ~2,200 chars/item to ~100-200
- [ ] Client-side search/filter in MCP layer — fetch unfiltered from API, apply search logic locally to work around broken RW server-side filters (masterid/rentalitemid DB column bugs)
- [ ] Smarter inventory browse defaults — smaller page size, curated default field sets for inventory tools
- [ ] Graceful fallback for known broken endpoints — detect specific 500 errors and automatically retry with client-side filtering

### Out of Scope

- Mobile/QuikScan endpoints — specialized scanner hardware workflows, not useful via MCP
- Plugins API — instance-specific plugin endpoints
- Pages API — only 2 CardPointe payment page endpoints
- System admin endpoints (CreateNewSystem, etc.) — dangerous, shouldn't be in MCP
- OAuth/Okta/Azure AD auth flows — current JWT auth is sufficient
- Real-time features (webhooks, long-polling) — outside MCP server pattern

## Current Milestone: v1.1 Inventory Browse Fix

**Goal:** Make inventory search and browse usable for AI agents by adding client-side filtering and response trimming to work around broken RW API server-side filters.

**Target features:**
- Client-side field selection for browse responses
- Client-side search/filter in MCP layer (workaround for broken API filters)
- Smarter inventory browse defaults (smaller pages, curated field sets)
- Graceful fallback on known broken endpoints (auto-retry with client-side filtering)

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
*Last updated: 2026-04-11 after milestone v1.1 started*
