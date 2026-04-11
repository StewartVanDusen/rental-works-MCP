# Phase 7: Browse Utilities - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Pure utility functions for client-side filtering and graceful API fallback exist in a standalone module (`src/utils/browse-helpers.ts`), fully tested with no MCP SDK dependency. This phase creates the foundation that Phases 8-9 wire into inventory tools.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from research:
- `browse-helpers.ts` must have zero imports from `@modelcontextprotocol/sdk`
- `applyClientFilter` must support all 6 operators: like, contains, startswith, endswith, =, <>
- `withClientSideFallback` must detect "Invalid column name" in error messages and retry without server-side search fields
- Default field constants (`RENTAL_INVENTORY_BRIEF_FIELDS`, `ITEMS_BRIEF_FIELDS`) need field names verified against live API before hardcoding
- Unit tests must pass with no network access or environment variables

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/tool-helpers.ts` — existing `browseSchema`, `buildBrowseRequest()`, `formatBrowseResult()`, `withErrorHandling()`
- `src/utils/api-client.ts` — `RentalWorksClient` singleton with `post()`, `browse()` methods
- `src/__tests__/` — existing test patterns with Vitest

### Established Patterns
- Error handling via `withErrorHandling()` wrapper that catches and returns user-friendly messages
- Browse request building via `buildBrowseRequest()` — constructs pageno, pagesize, searchfields arrays
- All browse tools use `formatBrowseResult()` which dumps all non-null fields

### Integration Points
- New `browse-helpers.ts` will be consumed by Phase 8 (schema extension) and Phase 9 (handler wiring)
- `withClientSideFallback` wraps around the API call inside the handler, separate from `withErrorHandling` which wraps the entire handler

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
