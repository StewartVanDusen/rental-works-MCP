# Feature Landscape

**Domain:** MCP server wrapping a rental management REST API (RentalWorks)
**Researched:** 2026-04-09
**Milestone scope:** Production hardening — validation, test coverage, missing endpoints

---

## Table Stakes

Features users expect from any production MCP server. Missing or broken = the server is not
trustworthy and AI agents will silently produce wrong results.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Every tool calls the correct HTTP method | Wrong method (GET vs POST) silently returns wrong data or a 405 | Low | Many RW endpoints use POST for read operations — non-obvious |
| Every tool uses the correct URL path | Wrong path returns 404; AI agent gets an error and stops | Low | 19 paths were already wrong in initial impl; more likely exist |
| Request body matches Swagger spec | Missing/wrong fields produce 400 or silent wrong results | Low-Med | RW API is not REST-conventional; body shape varies per endpoint |
| Unit test for every tool (method + path + body) | Regressions discovered before deploy, not after | Med | 5 test files exist but billing, admin, customers, settings, inventory CRUD not all covered |
| Integration tests against live API (read-only) | Confirms the server works against the real API, not just mocks | Med | Must use GET/browse only — no mutations against live data |
| Auth error handling (401/403) | Without it, agents loop on auth failures silently | Low | JWT auto-refresh already exists; need tests proving it works |
| API error handling with useful messages | RW returns 500 for known bad DB columns — already wrapped | Low | `withErrorHandling` wrapper exists; needs test coverage |
| Malformed response handling | API can return HTML error pages or empty bodies | Low | Needs test coverage proving graceful degradation |
| Correct storefront catalog path | `/storefrontcatalog/browse` is wrong; Swagger shows `/storefront/catalog/{id}/categorytree` | Low | Known bug, not yet fixed |
| Checkout/checkin paths verified against warehouse-v1 spec | warehouse-v1 is a separate sub-spec with different conventions | Med | Known gap; sub-specs have divergent path patterns |
| Invoice lifecycle paths verified (approve, process, void) | Invoice state machine is central to billing correctness | Med | Known gap from PROJECT.md |
| zod in package.json | Currently a missing declared dependency — install will fail for fresh consumers | Low | Already used in code, just not declared |

---

## Differentiators

Features that meaningfully raise quality above a basic API wrapper. Not expected by default,
but make the server more useful for AI agent workflows.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dashboard / home summary endpoint | Single tool that gives an AI agent a snapshot of the day (open orders, overdue items, pending invoices) — eliminates multiple round trips | Med | home-v1 Swagger section; PROJECT.md lists as missing high-value |
| Activity log / audit trail browsing | Agents can explain "what happened to order X" without user digging through UI | Med | admin-v1 activity log browse; 5 tools in admin currently |
| Address management CRUD | Customers and orders both have address sub-entities; currently no tools for add/update/delete address | Med | Needed for full customer lifecycle |
| Inventory merge | Duplicate inventory records are a real ops problem; merge tool lets an agent fix them | Med | PROJECT.md lists as missing high-value |
| Change order status explicitly | Currently relies on implicit status transitions via other actions; direct status-change tool makes workflow automation possible | Med | PROJECT.md lists as missing |
| Swagger-driven path validation fixture | A test fixture that parses the Swagger JSON and cross-references every tool's registered path against it — catches entire classes of path bugs automatically | High | No equivalent exists; would replace manual path audit |
| Structured error taxonomy in tool descriptions | Tool descriptions that name what errors are expected (e.g., "Returns 404 if item has active orders") so AI agents make better decisions | Low | Currently only `withErrorHandling` wrapper; no per-tool error docs |
| Browse filters documented per tool | Each browse tool exposes which filter fields the Swagger spec allows — agents currently guess | Med | Currently all tools share a generic `browseSchema` |
| Test coverage report | CI output showing % of tools with path tests — makes gaps visible before code review | Low | Vitest supports coverage; just needs configuration |

---

## Anti-Features

Things to deliberately NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Mobile / QuikScan endpoint tools | Scanner hardware workflow; not useful via MCP; adds 50+ tools with low ROI | Already scoped out in PROJECT.md |
| OAuth / Okta / Azure AD auth flows | Current JWT auth covers all use cases; OAuth adds complexity with no benefit for an MCP server | Keep JWT; document env vars clearly |
| Webhook / long-polling support | MCP is a request/response protocol; async push is architecturally incompatible | Agents should poll via browse tools if they need state changes |
| System admin endpoints (CreateNewSystem, etc.) | Destructive; wrong tool call could wipe the instance | Already scoped out; no exceptions |
| Plugin API endpoints | Instance-specific; breaks portability; no consistent spec | Raw escape hatches (`raw_api_post`, etc.) cover this |
| Pages API (CardPointe payment pages) | 2 endpoints, highly payment-processor-specific, not general rental management | Out of scope |
| Full Swagger code generation | Auto-generated tools are verbose, poorly described, and not AI-friendly | Hand-author tools with good descriptions and focused input schemas |
| Mutable integration tests | Any test that creates/updates/deletes against the live API risks data corruption | Read-only integration tests only (GET + browse POSTs) |
| Generic "do anything" tool that accepts raw JSON | Duplicate of already-existing raw_api_* escape hatches; encourages bypassing validated tools | Use and improve existing raw_api_* tools instead |

---

## Feature Dependencies

```
zod in package.json
  → required before any test suite runs in a fresh checkout

Swagger path validation fixture
  → requires access to the Swagger JSON endpoint
  → produces the ground truth that unit path tests assert against

Unit tests for all tools (method + path + body)
  → require the InMemoryTransport pattern already established in api-paths.test.ts
  → should be complete before integration tests run (catch bugs cheaply first)

Integration tests (live API, read-only)
  → require unit tests to pass first (integration confirms reality, not replaces unit tests)
  → require RENTALWORKS_BASE_URL / USERNAME / PASSWORD env vars at test time
  → must be in a separate test suite or marked with a flag so they don't run in CI without credentials

Storefront catalog path fix
  → blocks storefront integration test (can't test a wrong path against live API)

Checkout/checkin path verification
  → requires warehouse-v1 Swagger sub-spec to be consulted separately
  → warehouse-v1 has different path conventions than home-v1

Invoice lifecycle path verification
  → blocking for any billing integration test
  → approve/process/void are state-machine actions; wrong path silently skips a step

Dashboard / home summary tool
  → requires home-v1 section of Swagger to identify the correct endpoint(s)

Address management
  → depends on knowing whether addresses are sub-resources of Customer or standalone entities in RW
  → need Swagger to confirm path shape before implementing

Inventory merge
  → likely a POST action on an existing inventory item; confirm in Swagger before building
```

---

## MVP Recommendation

For this hardening milestone, prioritize strictly in this order:

1. **Fix the zod package.json declaration** — unblocks fresh checkouts immediately (trivial)
2. **Validate and fix all existing paths/methods against Swagger** — correctness before coverage
3. **Unit tests for all 114 tools** — every tool needs method + path + body assertion
4. **Fix known broken paths** (storefront catalog, any found during step 2)
5. **Error handling tests** — auth failure, 500 errors, malformed responses
6. **Integration tests (read-only)** — confirm reality against live API, separate suite
7. **High-value missing endpoints** — dashboard, activities, address management, inventory merge, change order status

Defer:
- Swagger-driven validation fixture (high value but high complexity; do manual audit first, then automate)
- Per-tool filter documentation (useful but not blocking correctness)
- Test coverage reporting (nice to have; add once all tests exist)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes features | HIGH | Derived directly from PROJECT.md requirements and existing code inspection |
| Anti-features | HIGH | All derived from PROJECT.md "Out of Scope" decisions with clear rationale |
| Missing high-value endpoints | MEDIUM | Listed in PROJECT.md; exact Swagger paths not yet confirmed |
| Testing patterns | HIGH | Existing test suite structure is clear; gaps are enumerable from tool count vs test count |
| Swagger path validation fixture | MEDIUM | Technically feasible; exact Swagger JSON structure not verified |

---

## Sources

- `/Users/josh/Coworking Projects/Modern Lighting/Rental Works API/.planning/PROJECT.md` — requirements, constraints, out-of-scope decisions
- `src/index.ts` — domain registration, 11 tool modules confirmed
- `src/tools/inventory.ts` — representative tool implementation patterns
- `src/__tests__/api-paths.test.ts` — existing test strategy (InMemoryTransport + fetch stub)
- Tool counts per domain: orders (15), billing (13), contracts (14), customers (13), inventory (13), vendors (9), reports (6), settings (14), admin (5), storefront (3), utilities (9) = 114 total
- Domains with NO path tests yet: billing, admin, customers, settings (confirmed by test file imports in api-paths.test.ts)
