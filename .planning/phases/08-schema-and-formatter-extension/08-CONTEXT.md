# Phase 8: Schema and Formatter Extension - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Inventory browse tools accept optional `fields` and `clientFilter` parameters and `formatBrowseResult` can project a subset of fields — all changes backward-compatible, existing 114 tools unaffected. This phase extends schemas and formatters; Phase 9 wires them into handlers.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior decisions:
- `browseSchema` in tool-helpers.ts must NOT be modified — new `fields`/`clientFilter` params go in inventory tool definitions only via a separate spread schema
- `formatBrowseResult` extension uses optional second parameter only — existing callers unaffected
- Field projection (projectFields) applied on data.Rows before passing to formatter
- browse-helpers.ts has zero MCP SDK dependency — pure TypeScript utility

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/tool-helpers.ts` — existing `browseSchema`, `buildBrowseRequest()`, `formatBrowseResult()`, `withErrorHandling()`
- `src/utils/browse-helpers.ts` — `applyClientFilter()`, `withClientSideFallback()`, `RENTAL_INVENTORY_BRIEF_FIELDS`, `ITEMS_BRIEF_FIELDS`
- `src/tools/inventory.ts` — current inventory tool definitions using `...browseSchema` spread

### Established Patterns
- Tool schemas defined inline via Zod objects spread with `...browseSchema`
- `formatBrowseResult` takes a single data parameter, dumps all non-null fields
- All browse tools use the shared `browseSchema` — must not be polluted

### Integration Points
- New inventory-specific schema fields added alongside `...browseSchema` spread in inventory.ts
- `formatBrowseResult` extended with optional options parameter for field projection
- Phase 9 will wire these into actual handler logic

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
