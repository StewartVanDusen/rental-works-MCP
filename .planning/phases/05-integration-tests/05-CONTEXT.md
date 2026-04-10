# Phase 5: Integration Tests - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Read-only integration tests that confirm the MCP server works correctly against the real RentalWorks API instance. Tests must skip gracefully when credentials are absent (CI-safe). Covers JWT auth, browse smoke tests for core domains, GET-by-ID per domain, and session endpoint validation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RentalWorksClient` in `src/utils/api-client.ts` — singleton with JWT auth, browse/getById/getSession helpers
- `getClient()` / `resetClient()` — singleton management for test isolation
- `vitest.config.ts` already has `integration` project targeting `src/__tests__/integration/**/*.test.ts`
- Integration test directory `src/__tests__/integration/` exists and is empty

### Established Patterns
- Unit tests use `vitest` with `describe`/`it`/`expect`
- Browse requests: `POST /api/v1/{entity}/browse` with pageno/pagesize
- GET by ID: `GET /api/v1/{entity}/{id}`
- Session: `GET /api/v1/account/session`
- API client is singleton, reads env vars at construction time

### Integration Points
- `RENTALWORKS_BASE_URL`, `RENTALWORKS_USERNAME`, `RENTALWORKS_PASSWORD` env vars
- `vitest --project integration` runs only integration tests
- Tests go in `src/__tests__/integration/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
