# Project Research Summary

**Project:** RentalWorks MCP Server — Production Readiness Hardening
**Domain:** MCP server wrapping a rental management REST API
**Researched:** 2026-04-09
**Confidence:** HIGH

## Executive Summary

This project is a production hardening milestone for an existing TypeScript MCP server that wraps the RentalWorks rental management REST API. The server already has 114 tools across 11 domains and a working unit test infrastructure using the correct `InMemoryTransport` + `vi.stubGlobal("fetch", ...)` pattern. The central problem is not missing functionality — it is correctness and trust: at least 19 paths were confirmed wrong in the initial implementation, and there is no automated mechanism to catch path drift against the 12 Swagger sub-specs that define the actual API surface.

The recommended approach is to treat this milestone as three sequential concerns: (1) validate and fix what exists before touching anything else, (2) build a reliable multi-layer test suite that catches correctness at unit, swagger-spec, and integration levels, and (3) only then expand with high-value missing tools. This ordering is non-negotiable — every new tool added before validation is complete propagates the same wrong-path patterns and makes the audit surface larger. The architecture research confirms a clean three-project Vitest configuration (unit / swagger / integration) that keeps CI fast and credential-gated tests separate.

The primary risk is complacency: the existing test suite is structurally sound but is not asserting `capturedUrl` on every test, and the `withErrorHandling` wrapper means wrong-path 500s are surfaced as structured error responses rather than failures. Both issues cause green CI with broken production behavior. Add `zod` to `package.json` first (five-minute fix, blocks fresh checkouts), then run the Swagger validation pass before writing a single new test or tool.

## Key Findings

### Recommended Stack

The current stack (TypeScript 5.7, `@modelcontextprotocol/sdk` 1.12, Vitest 3.x) is sound and requires minimal changes. Three additions are needed: `zod@^3.25.0` as a declared production dependency (it is already in use transitively), `@scalar/openapi-parser` as a dev dependency for Swagger spec loading and dereferencing (the older `@apidevtools/swagger-parser` package is unmaintained — do not use it), and `@vitest/coverage-v8` for coverage reporting. The MCP SDK should be upgraded from `^1.12.1` to `^1.29.0` — low risk, keeps protocol compliance current and the `InMemoryTransport` import path is unchanged.

Do not upgrade Vitest to 4.x during this milestone. The 4.0 release changes mock constructor behavior and coverage remapping in ways that would add noise to a validation-focused milestone. Hold at `^3.1.0` and upgrade as a separate task after the test suite stabilizes.

**Core technologies:**
- `zod@^3.25.0`: Schema validation — already used throughout codebase, must be declared in `dependencies` (not just transitive)
- `@scalar/openapi-parser`: Swagger spec loading and `$ref` dereferencing — TypeScript-native, actively maintained; do NOT use `@apidevtools/swagger-parser` (unmaintained)
- `@vitest/coverage-v8`: V8 coverage provider — enables `vitest run --coverage` with `lcov` output
- `@modelcontextprotocol/sdk@^1.29.0`: Upgrade from 1.12 — security patches, protocol compliance, Zod 3.25 compat confirmed stable

### Expected Features

The milestone has a clear, prioritized feature list. Table stakes are all correctness concerns — if these are wrong, the server gives LLMs bad data and they produce confident but incorrect results.

**Must have (table stakes):**
- Every tool calls the correct HTTP method and URL path — at least 19 were wrong; more likely exist
- Request body shape matches Swagger spec per-endpoint (RW uses PascalCase body fields non-conventionally)
- Unit test for every tool asserting `capturedUrl`, `capturedMethod`, and body shape — not just response shape
- Auth error handling proven via test (401/403 and JWT refresh path)
- Malformed response handling proven via test (HTML error pages, empty bodies)
- Known broken paths fixed: storefront catalog, checkout/checkin (warehouse-v1), invoice lifecycle (approve/process/void)
- `zod` declared in `package.json`

**Should have (differentiators):**
- Swagger-driven path validation fixture — parses 12 sub-specs, diffs against tool-registered paths, catches entire classes of path bugs automatically
- Dashboard / home summary tool — single-call snapshot for AI agents (high LLM utility)
- Integration test suite (read-only, `describe.skipIf` guard) — confirms reality against live API
- Activity log browsing, address management CRUD, inventory merge, change order status tools
- Test coverage reporting via `@vitest/coverage-v8`

**Defer (v2+):**
- Per-tool browse filter documentation in tool descriptions
- Auto-generated Swagger tools (anti-feature — hand-authored tools are better for AI)
- Mobile/QuikScan endpoints, OAuth/external auth, webhook/long-polling support

### Architecture Approach

The recommended architecture introduces a three-project Vitest configuration separating `unit`, `swagger`, and `integration` test suites, each independently runnable via `vitest --project <name>`. Unit tests stay in `src/__tests__/unit/`. A new `swagger/` suite fetches and caches the 12 RentalWorks sub-specs via `@scalar/openapi-parser`, builds a master set of `{ method, path }` pairs, then drives each tool with minimal args and asserts the captured URL matches a spec template (after ID-segment normalization). An `integration/` suite calls `RentalWorksClient` directly (bypassing the MCP protocol layer for cleaner error surfaces), guards with `describe.skipIf(!RENTALWORKS_BASE_URL)`, and enforces read-only access through a restricted wrapper module.

**Major components:**
1. `src/__tests__/unit/` — existing tests reorganized + new `error-handling.test.ts`; fast, no network, runs in CI
2. `src/__tests__/swagger/swagger-loader.ts` — fetches and caches all 12 sub-specs; drives `swagger-spec.test.ts`
3. `src/__tests__/swagger/swagger-spec.test.ts` — spec-driven path validation; the automated ground-truth safety net
4. `src/__tests__/integration/` — live API smoke tests via read-only-client wrapper; requires credentials; `describe.skipIf` guarded
5. `scripts/fetch-swagger.ts` — one-time CLI script to populate `.planning/swagger-cache/` (gitignored)
6. `vitest.config.ts` — Vitest `projects` array enabling `--project unit/swagger/integration` isolation

### Critical Pitfalls

1. **`zod` missing from `package.json`** — Fix before anything else. Works today via transitive pull from MCP SDK; fails silently after any dep bump or in a clean production deploy. Run `npm install zod@^3.25.0` and commit.

2. **Trusting path guesses over the Swagger spec** — RentalWorks is deliberately non-REST-conventional. Paths that look right (like `/storefrontcatalog/browse`) are wrong. The `swagger_endpoints.txt` file in the repo is a starting point; the live 12 sub-specs are the only authoritative source.

3. **Path tests asserting response shape instead of `capturedUrl`** — Green tests can mask completely wrong paths if the mock returns the same canned response regardless of URL. Every path test `it()` block MUST assert `capturedUrl` (exact string) and `capturedMethod`. Audit all existing tests before trusting CI green.

4. **Integration tests mutating live data** — Some RentalWorks endpoints have implicit side effects regardless of HTTP method. Maintain an explicit whitelist of safe integration test endpoints. Never call warehouse-v1 state-transition endpoints (checkout, checkin, approve, process, void) in integration tests.

5. **Expanding coverage before fixing existing paths** — Each new tool added before the validation pass is complete inherits wrong-path patterns and doubles the audit burden. Treat "validate all 114 existing tools" as a hard merge-blocking gate for any expansion PR.

## Implications for Roadmap

All four research files agree on the same phase structure. Dependencies are explicit and the ordering is non-negotiable at the top (Phases 1-2) and advisory elsewhere (Phases 3 and 4 can parallelize).

### Phase 1: Foundation and Dependency Fix

**Rationale:** Two issues silently undermine everything else. `zod` missing from `package.json` causes environment-dependent failures. The test suite does not assert `capturedUrl` universally — fixing this first means new tests in Phase 3 inherit the correct pattern rather than the gap.

**Delivers:** Confirmed working `npm ci` from clean checkout; `vitest.config.ts` with `projects` array; existing 5 test files moved to `unit/` subdirectory; all existing tests audited for `capturedUrl` assertion (gaps flagged for Phase 3)

**Addresses:** `zod` declaration (table stakes); test structure correctness

**Avoids:** Pitfall 1 (missing dep), Pitfall 3 (shape-only assertions)

### Phase 2: Swagger Validation Pass

**Rationale:** The Swagger spec is the only ground truth. Build spec-loading machinery before writing new unit tests, so the spec drives what assertions should be rather than what the current (potentially wrong) code says. Build the sub-spec → domain mapping table first to avoid consulting the wrong spec (warehouse-v1 for checkout vs. home-v1 for orders).

**Delivers:** `scripts/fetch-swagger.ts` populating `.planning/swagger-cache/`; `swagger-loader.ts`; `swagger-spec.test.ts` producing a path-mismatch report across all 114 tools; sub-spec domain mapping table; confirmed list of paths to fix

**Addresses:** Correct paths/methods (table stakes); Swagger-driven validation fixture (differentiator)

**Avoids:** Pitfall 2 (path guessing), Pitfall 6 (wrong sub-spec), Pitfall 7 (error wrapper masking wrong-path 500s)

**Research flag:** The exact mechanism for extracting the 12 sub-spec URLs requires parsing the embedded `SwaggerUIBundle({ urls: [...] })` config from the Swagger UI HTML page. This is inferred convention, not confirmed. A 30-minute exploration spike against the live instance should precede implementation.

### Phase 3: Full Unit Test Coverage and Path Fixes

**Rationale:** With confirmed-correct paths from Phase 2, write (or fix) unit tests for all 114 tools. Fix path bugs found in Phase 2 — storefront catalog, checkout/checkin (warehouse-v1), invoice lifecycle. Add `error-handling.test.ts` for auth failures, 500 wrapping, and malformed responses.

**Delivers:** Unit tests for all 114 tools with `capturedUrl`, `capturedMethod`, and body shape assertions; `error-handling.test.ts`; all Phase 2-identified path bugs fixed in tool source files; coverage report via `@vitest/coverage-v8`

**Uses:** `request-bodies.test.ts` pattern for body shape assertions; `@vitest/coverage-v8`

**Avoids:** Pitfall 3 (shape-only assertions), Pitfall 7 (error wrapper masking), Pitfall 8 (Zod schema drift from API shape)

### Phase 4: Integration Test Suite

**Rationale:** Integration tests confirm reality against the live API — they do not replace unit tests. Run after (or alongside) Phase 3. The Swagger validation pass findings from Phase 2 identify which endpoints are safe to smoke-test.

**Delivers:** `src/__tests__/integration/read-only-client.ts`; `auth.integration.test.ts`; `browse-smoke.integration.test.ts` (5-10 key entities, shape assertions only); JWT expiry behavior documented; `describe.skipIf(!RENTALWORKS_BASE_URL)` guard on all integration tests

**Addresses:** Integration test coverage (table stakes); live API confidence (differentiator)

**Avoids:** Pitfall 4 (live data mutation), Pitfall 10 (JWT expiry mid-suite)

### Phase 5: High-Value Missing Tools

**Rationale:** Only after all 114 existing tools are validated and tested is it safe to add new tools. New tools must follow the validated patterns and have Swagger-backed path assertions before merging.

**Delivers:** Dashboard/home summary tool; activity log browse tools; address management CRUD; inventory merge; change order status; `swagger-spec.test.ts` updated to cover new tools

**Avoids:** Pitfall 5 (expanding before validation complete), Pitfall 9 (tool name collisions)

**Research flag:** Exact Swagger paths for dashboard, address management, and inventory merge are not yet confirmed. Each new tool requires a Swagger lookup before implementation — scope each tool as: (1) find in spec, (2) implement, (3) test.

### Phase Ordering Rationale

- Phase 1 before everything: missing `zod` dep and test structure gaps silently corrupt all subsequent work
- Phase 2 before Phase 3: the Swagger pass produces the ground truth that Phase 3 unit tests assert against — writing tests before spec validation means asserting the current (possibly wrong) behavior as correct
- Phases 3 and 4 can run in parallel with sufficient capacity; Phase 4 does not depend on Phase 3 completion but benefits from Phase 2 findings
- Phase 5 is hard-gated behind Phase 3 completion: non-negotiable per PROJECT.md and confirmed by PITFALLS.md analysis

### Research Flags

Phases needing deeper research or live-instance discovery during planning:
- **Phase 2:** Swagger sub-spec URL discovery (parsing `SwaggerUIBundle` config from HTML) — MEDIUM confidence; spike against live instance before committing to implementation
- **Phase 5:** Exact Swagger paths for new tools (dashboard, address management, inventory merge, change order status) — MEDIUM confidence; must be resolved per-tool before implementation

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** Dependency declaration and Vitest config are mechanical; no ambiguity
- **Phase 3:** `InMemoryTransport` + `vi.stubGlobal` unit test pattern is established and proven; gap-filling is mechanical once Phase 2 provides correct paths
- **Phase 4:** `describe.skipIf` integration guard and read-only-client wrapper are standard patterns; no novel technical territory

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Version facts grounded in npm registry, SDK GitHub releases, and specific incompatibility evidence (Zod 4 / MCP SDK issue #925) |
| Features | HIGH | Derived from codebase inspection and PROJECT.md; tool count, test gaps, and known broken paths are enumerable facts |
| Architecture | HIGH (unit/integration patterns); MEDIUM (Swagger loading) | InMemoryTransport pattern is standard; sub-spec URL discovery is inferred Swagger UI convention, not confirmed against live instance |
| Pitfalls | HIGH | All 10 pitfalls grounded in specific observed codebase conditions and confirmed facts; not generic advice |

**Overall confidence:** HIGH

### Gaps to Address

- **Swagger sub-spec URL discovery:** The `urls.primaryName` query parameter values and the HTML parsing approach must be confirmed against the live instance before Phase 2 implementation begins. Manual inspection of the Swagger UI index page resolves this in under an hour.

- **Path normalization edge cases:** The segment-matching algorithm for normalizing concrete URLs to spec path templates is straightforward for simple IDs but RentalWorks has documented deep compound paths. Budget extra time in Phase 2 for iteration on the normalization logic.

- **JWT token expiry window:** RentalWorks JWT expiry time is unknown; could cause mid-suite auth failures in integration tests if tokens expire during a long run. Verify against the live instance in Phase 4 setup.

- **Invoice lifecycle sub-spec location:** The correct sub-spec for invoice approve/process/void (likely `accountservices-v1` or a billing-specific spec) is not yet confirmed. Resolve during Phase 2 sub-spec mapping table construction.

## Sources

### Primary (HIGH confidence)
- Project codebase: `package.json`, `src/__tests__/api-paths.test.ts`, `src/index.ts`, all tool files — confirmed facts about tool count, missing dep, test patterns
- `.planning/PROJECT.md` — requirements, constraints, out-of-scope decisions, known issues
- MCP SDK npm / GitHub releases — version facts, Zod v4 incompatibility (issue #925)
- Zod v4 changelog — breaking changes confirmed
- Vitest 4.0 migration guide — breaking changes confirmed

### Secondary (MEDIUM confidence)
- `@scalar/openapi-parser` npm — actively maintained; archived GitHub repo migrated into Scalar monorepo but package continues publishing
- MCPcat unit/integration testing guides — InMemoryTransport pattern corroboration
- Vitest discussions #4675, #5557 — projects array configuration for test separation

### Tertiary (requires live instance confirmation)
- Swagger sub-spec URL pattern (`/swagger/v1/swagger.json?urls.primaryName=...`) — inferred from Swagger UI conventions
- `swagger_endpoints.txt` in project root — may be stale; live Swagger spec is authoritative

---
*Research completed: 2026-04-09*
*Ready for roadmap: yes*
