---
phase: 11
phase_name: Comprehensive Browse Tool Hardening
milestone: v1.1
status: in-progress
depends_on: [10]
last_updated: "2026-04-28"
---

# Phase 11 — Comprehensive Browse Tool Hardening

## Goal

Every browse, get-by-id, and CRUD tool in the MCP server returns a usable, keyed, well-sized response — for every entity, not just `rentalinventory` and `item`. Every numeric input accepts both number and string forms (LLM compatibility). Every handler surfaces friendly errors instead of raw HTTP stack traces.

## Why

Live-API audit (2026-04-28) confirmed v1.1's narrow scope left 35+ browse tools broken in production:
- Rows returned as positional arrays instead of keyed objects (~35 tools)
- Same `Invalid column name` 500 affects `address`, `user`, `quote`, `billing` browses (server-side DB bug; GET fallback exists but never reached because tools bypass `client.browse()`)
- `z.number()` rejects every LLM-stringified numeric tool argument
- `withErrorHandling()` exists but is never invoked
- `get_session` returns a 4M-character blob

Reference audit: `/Users/josh/.claude/plans/i-don-t-think-the-dazzling-rivest.md`

## Success Criteria

1. `client.browse<T>()` is the **only** callable browse path; `client.post("…/browse")` is no longer used by any tool handler.
2. `browseSchema.page` and `browseSchema.pageSize` parse `{ page: "1", pageSize: "25" }` without error.
3. Live re-probe of every previously broken tool returns keyed rows (e.g. `CustomerId: A001AQ2M | Customer: …`) instead of `0: A001AQ2M | 1: …`.
4. Live re-probe of `browse_addresses`, `browse_users`, `browse_quotes`, `browse_billing` succeeds — no 500.
5. `withErrorHandling()` wraps every tool handler; "Invalid column name", "503", "500 NullReference", and "Record Not Found" all produce non-`isError` informational messages.
6. `get_session` returns ≤ 5 KB by default (curated user/office/warehouse summary).
7. `npm run build && npm test` — green, with new tests proving (a) browseSchema coerces, (b) `normalizeRows` produces keyed output, (c) every browse tool calls `client.browse()` (grep-style assertion).

## Plans

- 11-01-PLAN.md — API client and schema hardening (BASE_URL guard, body type, single-flight auth, browseSchema coercion)
- 11-02-PLAN.md — Browse tool refactor (route all 35+ browse handlers through `client.browse()`)
- 11-03-PLAN.md — Error handling wiring (`withErrorHandling()` everywhere, dead-code removal, get-by-id "Not Found")
- 11-04-PLAN.md — Response sizing (entity brief presets, `get_session` trimming, default field projection)
- 11-05-PLAN.md — Verification (unit tests for coercion + normalization + handler wrapping; live read-only re-probes; STATE update)
