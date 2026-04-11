# Project Research Summary

**Project:** RentalWorks MCP Server v1.1 — Inventory Browse Fix
**Domain:** MCP server layer — client-side filtering, field projection, response optimization
**Researched:** 2026-04-11
**Confidence:** HIGH

## Executive Summary

This milestone addresses a narrow but critical problem: the RentalWorks API's server-side search filters silently 500 on inventory browse endpoints (known DB column bugs for `masterid` and `rentalitemid`), and the existing response format dumps every non-null field per row (~2,200 chars/item), making inventory browse tools effectively unusable for LLM agents at any reasonable page size. The solution is a pure MCP-layer feature set — field projection, client-side filtering, a graceful fallback wrapper, and smarter defaults — implemented entirely with the existing stack and zero new dependencies.

The recommended approach is a clean separation of concerns: a new `browse-helpers.ts` utility module holds the pure functions (`applyClientFilter`, `withClientSideFallback`, default field constant sets) with no MCP SDK dependency, making them trivially unit-testable. `tool-helpers.ts` and `inventory.ts` receive additive, backward-compatible changes only. The most important architectural constraint is that `browseSchema` must NOT be modified — the Zod spread pattern propagates changes to all 114 tools simultaneously, making any non-backward-compatible change a codebase-wide break. New parameters belong exclusively in inventory tool definitions, not the shared schema.

The key risk is scope creep in the wrong direction: modifying shared utilities (`browseSchema`, `withErrorHandling`, `formatBrowseResult`) in breaking ways, or adding client-side filter logic to layers (api-client, the error wrapper) that should remain pure transport/formatting concerns. Every pitfall identified traces back to one of these two mistakes. The mitigation is strict layering enforced at code review time and a "looks done but isn't" checklist that verifies each guard is actually in place before merge.

## Key Findings

### Recommended Stack

No new dependencies are needed. All four features (field projection, client-side filtering, smarter defaults, graceful fallback) are pure TypeScript utility work — array iteration, string matching, and object construction. The installed stack (TypeScript 5.7, Zod 4.3.6, Vitest 3.x, MCP SDK 1.12.1) is fully sufficient. One important note: the installed Zod version is **4.3.6**, not 3.x as documented in CLAUDE.md — the default import API is compatible, no migration needed, do not downgrade.

**Core technologies:**
- TypeScript 5.7.0: Field projection via `Object.fromEntries` (ES2022 target covers this natively)
- Zod 4.3.6: Schema extension with `z.array(z.string()).optional()` and `z.object({...}).optional()`
- Vitest 3.x: Pure synchronous utility functions require no mocks — direct `expect(fn(...)).toEqual(...)` testing
- MCP SDK 1.12.1: No changes to tool registration pattern; filtering/projection happens before `content` array is assembled

### Expected Features

**Must have (table stakes):**
- Field selection (`fields?: string[]`) — reduces ~2,200 chars/row to ~100-200 chars with 4-5 key fields; without this the tool is impractical for LLM agents
- Curated default field sets for inventory — agents should get useful results without knowing internal field names; `RENTAL_INVENTORY_BRIEF_FIELDS` constant set as default
- Client-side search filter (`clientFilter`) — server-side filters 500 on `masterid`/`rentalitemid`; agents have no alternative way to filter results
- Reduced default page size for inventory browse — default 25 x 2,200 chars = 55,000 chars; change `browse_rental_inventory` and `browse_items` defaults to 10
- "Showing N of M" metadata with client-filter annotation — agents must know when pagination counts reflect unfiltered API data to avoid wrong conclusions
- Graceful fallback on "Invalid column name" 500 — auto-retry without server search fields, apply client-side, note in output

**Should have (differentiators):**
- Named field preset parameter (`fieldPreset: "summary" | "rates" | "tracking" | "full"`) — eliminates schema-knowledge burden for agents
- `filter_operator` enum (`contains | startswith | =`) — covers all common search patterns client-side
- Multi-page scan (`scan_pages`) — opt-in, capped at 10 pages, for sparse matches deep in large datasets
- Explicit field documentation in tool description strings — lets agents compose `fields` param without guessing

**Defer (v2+):**
- Updating `formatBrowseResult` signature in a breaking way — risky to all existing callers; handler-level projection achieves the same thing
- Semantic/fuzzy field name matching — adds dependency complexity with no clear benefit
- Fetch-all-pages-then-filter as a default — too expensive at scale
- Cross-call result caching — MCP servers are stateless by design

### Architecture Approach

The v1.1 changes introduce one new file (`src/utils/browse-helpers.ts`) and make additive modifications to two existing files (`tool-helpers.ts` and `tools/inventory.ts`). `api-client.ts` and `src/types/api.ts` receive no changes. The critical pattern is strict layering: `withClientSideFallback` (inner — returns data or re-throws) wraps the fetch call inside the tool handler; `withErrorHandling` (outer — converts remaining errors to LLM-readable text) wraps the entire handler. These two wrappers serve different contracts and must not be collapsed.

**Major components:**
1. `browse-helpers.ts` (new) — `applyClientFilter`, `withClientSideFallback`, default field constant sets; zero MCP SDK dependency; fully unit-testable with mock data
2. `tool-helpers.ts` (modified) — `browseSchema` extended with optional `fields?` and `clientFilter?`; `formatBrowseResult` extended with optional `options?: { fields?: string[] }` second parameter; all existing callers unaffected
3. `tools/inventory.ts` (modified) — browse handlers pass `fields`/`clientFilter` to helpers, use `BRIEF_FIELDS` constants as defaults, wrap fetches in `withClientSideFallback`; CRUD tools completely untouched

### Critical Pitfalls

1. **Modifying `browseSchema` directly** — the Zod spread pattern propagates changes to all 114 tools simultaneously. Use a separate `browseFieldSelectionSchema` spread only into inventory tools. Verify with `grep "fields" src/utils/tool-helpers.ts` returning nothing before merge.

2. **Adding retry/fallback logic to `withErrorHandling`** — the wrapper is a pure error-to-message converter; adding retry makes it apply to all 114 tools and masks real path bugs as silent unfiltered responses. Scope retry to individual inventory tool handlers only.

3. **Client-side filter with too-small page size** — fetching page 1 of 10 and filtering to 1 result tells the LLM nothing meaningful. Set inventory browse defaults to 100+ when client-side filter is active; annotate pagination metadata to note counts reflect unfiltered API data.

4. **`formatBrowseResult` signature change breaking 20+ callers** — many callers use `data as any` casts that bypass TypeScript protection. Add an optional second parameter only; run `npx tsc --noEmit` after any change to `tool-helpers.ts`.

5. **Field projection and null-filtering interaction** — `formatBrowseResult` already strips null values; adding projection inside it conflates two concerns. Apply `projectFields` on `data.Rows` before passing to `formatBrowseResult`, not inside it.

## Implications for Roadmap

Based on research, the dependency graph drives a clear 6-step build order. Each step is independently testable before the next begins.

### Phase 1: Pure Utility Functions
**Rationale:** Zero dependencies on MCP, api-client, or tool-helpers — can be built and fully unit-tested with mock data before touching any production code. Establishes the foundation everything else builds on.
**Delivers:** `browse-helpers.ts` with `applyClientFilter`, `withClientSideFallback`, and default field constant sets
**Addresses:** Table-stakes client-side filter and graceful fallback features
**Avoids:** Pitfall of adding filter logic to api-client.ts (wrong layer) or withErrorHandling (wrong contract)

### Phase 2: formatBrowseResult Extension
**Rationale:** Backward-compatible signature change that all subsequent steps depend on. Must be verified against existing test suite before inventory handlers are touched.
**Delivers:** Optional `options?: { fields?: string[] }` parameter; existing callers unaffected; new projection test cases added
**Uses:** TypeScript `Object.fromEntries`, existing Vitest test suite
**Implements:** Backward-compatible formatter extension pattern

### Phase 3: browseSchema Extension
**Rationale:** Additive schema change that enables browse tools to optionally receive the new parameters. Must be additive-only — no defaults, no required fields.
**Delivers:** `fields?` and `clientFilter?` optional fields in shared schema; full test suite confirms no regressions across 114 tools
**Avoids:** Pitfall 6 (browseSchema mutation) — new fields are optional with no defaults, strict backward compatibility

### Phase 4: Inventory Browse Handler Updates
**Rationale:** Widest change in lines touched, but all primitives are stable and tested by this point. Apply `BRIEF_FIELDS` defaults, reduced page sizes, and `withClientSideFallback` wrappers to inventory browse handlers only.
**Delivers:** `browse_rental_inventory` and `browse_items` fully updated with field selection, client-side filter, graceful fallback, and metadata annotation
**Implements:** The complete tool handler layer described in ARCHITECTURE.md

### Phase 5: Integration Tests
**Rationale:** Final validation against the live API. Read-only only. Establish a safe-endpoints whitelist before writing any tests.
**Delivers:** Integration test coverage for: explicit `fields` browse, client-filter fallback on broken columns, regression guard for unchanged output shape
**Avoids:** Pitfall 4 (live data mutation) — whitelist approach with Swagger side-effect review before adding any endpoint

### Phase Ordering Rationale

- Pure utilities first because they have no dependencies and establish the API for everything downstream
- Formatter extension before schema extension because formatter tests serve as the regression guard for the handler changes
- Schema extension before handler changes because TypeScript will catch mismatches at compile time once both are in place
- Integration tests last because they require a working end-to-end implementation to be meaningful
- This order means any step can be abandoned without leaving the codebase in a broken intermediate state

### Research Flags

Phases with standard patterns (no additional research needed):
- **Phase 1 (pure utilities):** Pure TypeScript array/object manipulation — well-understood patterns
- **Phase 2 (formatter extension):** Backward-compatible optional parameter — established TypeScript/Zod pattern
- **Phase 3 (schema extension):** Additive Zod schema change — well-documented pattern
- **Phase 4 (handler updates):** All patterns established by phases 1-3; straight wiring
- **Phase 5 (integration tests):** Standard Vitest integration test pattern already established in codebase

No phases require `/gsd-research-phase` — research is complete and high-confidence. The Zod 4.3.6 version discrepancy with CLAUDE.md documentation is the only item needing a documentation update (not a code change).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection; confirmed Zod 4.3.6 installed and working; no new dependencies needed |
| Features | HIGH | Grounded in PROJECT.md milestone requirements and direct code inspection of existing formatBrowseResult behavior |
| Architecture | HIGH | Based on direct code inspection of existing architecture; patterns verified against live codebase |
| Pitfalls | HIGH | Every pitfall grounded in specific observed codebase conditions; CLAUDE.md and PROJECT.md corroborate |

**Overall confidence:** HIGH

### Gaps to Address

- **Zod version documentation drift:** CLAUDE.md documents Zod 3.x but 4.3.6 is installed. Update CLAUDE.md as part of this milestone to prevent future confusion.
- **Default field constants need live-API verification:** `RENTAL_INVENTORY_BRIEF_FIELDS` and `ITEMS_BRIEF_FIELDS` constants are proposed based on code inspection but must be verified against a live browse response before hardcoding — field names in API responses may differ from TypeScript type definitions.
- **`scan_pages` complexity:** Multi-page scan is listed as a "should have" differentiator but has medium complexity and token-cost implications. Flag for explicit scoping decision during planning — it can safely be deferred to v1.2 without compromising the core milestone.

## Sources

### Primary (HIGH confidence)
- `src/utils/tool-helpers.ts` — existing browseSchema, formatBrowseResult, withErrorHandling implementations
- `src/utils/api-client.ts` — HTTP client, browse method, error patterns
- `src/tools/inventory.ts` — existing browse handler implementations
- `src/__tests__/api-paths.test.ts` — test pattern and capturedUrl assertion coverage
- `.planning/PROJECT.md` — v1.1 milestone requirements, known broken endpoints
- `CLAUDE.md` — project constraints, "no additional frameworks" requirement
- `package.json` + `node_modules/zod/package.json` — confirmed Zod 4.3.6 installed

### Secondary (MEDIUM confidence)
- [Axiom: Designing MCP servers for wide schemas](https://axiom.co/blog/designing-mcp-servers-for-wide-events) — cell-budget approach, field projection pattern
- [MCP GitHub discussion #2211](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2211) — confirms no protocol-level response size limit; filtering is a server responsibility
- [Speakeasy: Reducing MCP token usage by 100x](https://www.speakeasy.com/blog/how-we-reduced-token-usage-by-100x-dynamic-toolsets-v2) — progressive disclosure / field trimming as primary lever

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
