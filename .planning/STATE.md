---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Inventory Browse Fix
status: phase-11-implemented-pending-merge
stopped_at: phase-11-live-verify
last_updated: "2026-04-28"
last_activity: 2026-04-28
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.
**Current focus:** v1.1 Phase 11 implementation complete in worktree branch — pending merge + live re-verification

## Current Position

Phase: Phase 11 — Comprehensive Browse Tool Hardening (implemented in branch `claude/thirsty-kalam-454e05`, pending merge)
Plan: `.planning/phases/11-comprehensive-browse-hardening/PLAN.md`
Status: Code complete, build clean, 294 tests pass (281 baseline + 13 Phase 11 invariants). Live verification deferred until branch lands in main + MCP server restart.
Last activity: 2026-04-28 — Phase 11 implemented

```
Progress: in-branch (claude/thirsty-kalam-454e05)
```

## Accumulated Context

### Decisions

- Init: Validate existing 114 tools before expanding — prevents propagating wrong-path patterns
- Init: Integration tests are read-only — live instance has real data
- [Phase 02]: Committed swagger-cache.json to repo for CI offline use (no live network required in tests)
- [Phase 02-02]: sync_to_quickbooks bug fixed: URL /entity/id/synctoqbo -> /entity/synctoqbo (spec-correct), entityId sent in body
- [Phase 02-02]: swagger-spec.test.ts confirms all 114 tool paths match Swagger spec — zero genuine path mismatches beyond sync_to_quickbooks
- [v1.1]: RW API server-side bugs (masterid, rentalitemid column refs) make server-side filtering impossible for inventory/item browse — must filter client-side in MCP layer
- [v1.1 roadmap]: browseSchema must NOT be modified — new fields/clientFilter params go in inventory tool definitions only via a separate spread schema
- [v1.1 roadmap]: withClientSideFallback is a separate inner wrapper from withErrorHandling — do not collapse them; they serve different contracts
- [v1.1 roadmap]: formatBrowseResult extension uses optional second parameter only — existing callers unaffected; apply projectFields on data.Rows before passing to formatter
- [v1.1 roadmap]: browse-helpers.ts has zero MCP SDK dependency — pure TypeScript utility, trivially unit-testable with mock data
- [Phase 11]: `client.browse()` is the only sanctioned browse entrypoint — enforced by [phase-11-hardening.test.ts](src/__tests__/unit/phase-11-hardening.test.ts), not just docs (lesson L7)
- [Phase 11]: `BRIEF_FIELDS_BY_ENTITY` in tool-helpers.ts is the source of truth for browse-response field projection; per-tool overrides go via `browseTool(entity, { briefFields: [...] })`
- [Phase 11]: `z.coerce.number()` is required for all numeric tool inputs (LLMs stringify); enforced by lint test in `phase-11-hardening.test.ts`
- [Phase 11]: `tsconfig.json` excludes `src/__tests__` so the prod build doesn't carry test files into `dist/`

### Pending Todos

- Verify RENTAL_INVENTORY_BRIEF_FIELDS and ITEMS_BRIEF_FIELDS constants against live API browse response (now folded into `BRIEF_FIELDS_BY_ENTITY`)
- Update CLAUDE.md Zod version documentation (documents 3.x, installed is 4.3.6)
- After merge: live re-probe each previously-broken browse tool (see tasks/todo.md "Live verification" section)
- Future: env-gated integration tests asserting `Object.keys(Rows[0])` is non-numeric for every browse tool
- Future: remove dead `browseWithFallback()` from `browse-helpers.ts` (one-line, no callers remaining)
- Future: migrate from deprecated `server.tool(name, desc, schema, cb)` overload to the current SDK shape (~114 call sites)

### Blockers/Concerns

- RW API browse endpoints for `address`, `user`, `quote`, `billing`, `rentalinventory`, `item` (and likely more) return 500 on any search filter — server-side DB bugs we cannot fix. Mitigation: GET fallback in `client.browse()` (now reached by every browse tool, was only 2/38 before Phase 11).
- Live verification of Phase 11 requires merging the `claude/thirsty-kalam-454e05` branch and restarting the Claude Desktop MCP connection — the worktree's `dist/` does not reach the running server (lesson L6).

## Session Continuity

Last session: 2026-04-28
Stopped at: Phase 11 implementation complete; pending merge + live verification
Resume file: tasks/todo.md (Phase 11 review section)
