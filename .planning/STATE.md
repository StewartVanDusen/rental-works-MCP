---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Inventory Browse Fix
status: roadmap-ready
stopped_at: null
last_updated: "2026-04-11"
last_activity: 2026-04-11
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Every MCP tool must call the correct API endpoint with the correct method, path, and request body — verified by tests and validated against the live Swagger spec.
**Current focus:** v1.1 Inventory Browse Fix — Phase 7 (Browse Utilities) is next

## Current Position

Phase: Phase 7 — Browse Utilities (not started)
Plan: —
Status: Roadmap approved, ready to plan Phase 7
Last activity: 2026-04-11 — Roadmap created for v1.1

```
Progress: [░░░░░░░░░░] 0% (0/4 phases)
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

### Pending Todos

- Verify RENTAL_INVENTORY_BRIEF_FIELDS and ITEMS_BRIEF_FIELDS constants against live API browse response before hardcoding (field names in API responses may differ from TypeScript type definitions)
- Update CLAUDE.md Zod version documentation (documents 3.x, installed is 4.3.6)

### Blockers/Concerns

- RW API browse endpoints for rentalinventory and item return 500 on any search filter (server-side DB bugs we cannot fix)
- Unfiltered browse responses are ~2,200 chars/item — exceeds LLM context at even 25 items/page

## Session Continuity

Last session: 2026-04-11
Stopped at: Roadmap created — Phase 7 ready to plan
Resume file: None
