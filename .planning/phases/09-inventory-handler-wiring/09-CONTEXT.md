# Phase 9: Inventory Handler Wiring - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Wire the browse-helpers utilities (applyClientFilter, withClientSideFallback, projectFields, resolveFieldPreset) into the inventory browse handlers. Default page size drops to 10, default field set becomes BRIEF_FIELDS, and client-side filtering metadata is surfaced in response text. CRUD tools must remain completely unchanged.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/browse-helpers.ts` — applyClientFilter, withClientSideFallback, RENTAL_INVENTORY_BRIEF_FIELDS, ITEMS_BRIEF_FIELDS, projectFields, resolveFieldPreset, inventoryFieldSchema
- `src/utils/tool-helpers.ts` — formatBrowseResult (already extended with field projection support in Phase 8)
- `src/tools/inventory.ts` — browse_rental_inventory, browse_items handlers with inventoryFieldSchema already spread into schemas

### Established Patterns
- Browse tools use `buildBrowseRequest()` + `client.browse()` + `formatBrowseResult()`
- Error handling via `withErrorHandling()` wrapper
- Tool schemas defined inline with Zod, domain-specific extensions spread in

### Integration Points
- Inventory browse handlers in `src/tools/inventory.ts` — where withClientSideFallback wraps the API call
- formatBrowseResult call sites — where projectFields and metadata changes apply

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
