# Phase 4: Error Handling - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Auth failures, API 500s, and malformed responses are all proven to produce user-friendly structured outputs rather than silent failures or crashes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withErrorHandling()` in `src/utils/tool-helpers.ts` — existing wrapper that catches "Invalid column name", "503", "500 NullReference"
- `RentalWorksClient` in `src/utils/api-client.ts` — singleton API client with JWT auth, `ensureAuth()`, generic `request()` method

### Established Patterns
- Error handler returns `{ content: [{ type: "text", text: ... }], isError: true }` for tool-level errors
- API client throws on non-OK responses with `API ${method} ${path} failed: ${status} - ${text}`
- Auth failures throw immediately from `authenticate()`: `Authentication failed: ${status} ${statusText}`
- Empty body handling: `request()` returns `{}` when response text is empty
- JSON.parse on response text without try/catch — will crash on HTML error pages

### Integration Points
- All tool handlers in `src/tools/*.ts` use `withErrorHandling()` wrapper
- `ensureAuth()` called before every `request()` — token refresh is implicit
- No retry logic on 401/403 after initial auth

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
