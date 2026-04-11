# Phase 6: Expansion - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add high-value missing endpoints as new MCP tools following validated patterns. Address management CRUD (home-v1 API), change order status utility (utilities-v1 API). Every new tool gets unit tests and integration smoke tests.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RentalWorksClient` with browse/getById/create/update/remove helpers
- `withErrorHandling()` wrapper for tool handlers
- `browseSchema` shared Zod schema for browse operations
- `buildBrowseRequest()` / `formatBrowseResult()` helpers
- `swagger-cache.json` for path validation in tests
- Established unit test patterns in `src/__tests__/unit/` (capturedUrl, capturedMethod assertions)

### Established Patterns
- Tool domain files: `src/tools/{domain}.ts` with `register{Domain}Tools()` export
- Tool registration in `src/index.ts` importing and calling each register function
- Browse pattern: POST `/api/v1/{entity}/browse` with browseSchema params
- CRUD pattern: GET/POST/PUT/DELETE `/api/v1/{entity}/{id}`
- PascalCase for API field names, camelCase for handler params

### Integration Points
- New tools registered in `src/index.ts`
- New tool paths added to swagger-spec.test.ts validation
- Unit tests follow capturedUrl/capturedMethod pattern
- Integration tests in `src/__tests__/integration/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
