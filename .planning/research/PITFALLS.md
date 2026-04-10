# Domain Pitfalls: MCP Server Production Hardening

**Domain:** REST API wrapper / MCP server production readiness
**Project:** RentalWorks MCP Server
**Researched:** 2026-04-09
**Confidence:** HIGH (grounded in existing codebase evidence + well-understood domain patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or production failures.

---

### Pitfall 1: Missing Runtime Dependency (`zod` not in `package.json`)

**What goes wrong:** `zod` is imported throughout the codebase (`tool-helpers.ts`, all tool files) but is not listed in `dependencies` in `package.json`. It only works because it happens to be installed transitively — likely pulled in by `@modelcontextprotocol/sdk`. If the SDK's peer dep changes, or if anyone runs `npm ci --production` or deploys to a clean environment, the server crashes at startup with a module-not-found error.

**Why it happens:** Developers install packages globally, transitively, or from a parent monorepo, and the working dev environment masks the missing declaration.

**Consequences:** Silent production breakage — the server may work perfectly in dev and fail on deploy or after a dependency bump.

**Warning signs:**
- `npm ls zod` shows it as a transitive dep, not a direct dep
- `package.json` lists only `@modelcontextprotocol/sdk` in `dependencies`
- `npm ci` on a fresh checkout does not fail (but only because the transitive pull still works — for now)

**Prevention:** Add `zod` to `dependencies` immediately. Pin to the major version range you're using (`^3.x`). Run `npm ls zod` to confirm which version is actually resolved after adding it.

**Phase mapping:** Phase 1 / first task before any other work. Anything built before this fix is built on a fragile foundation.

---

### Pitfall 2: Trusting Path Guesses Over the Swagger Spec

**What goes wrong:** The RentalWorks API is "not REST-conventional in many places" (PROJECT.md). Paths like `/storefrontcatalog/browse` vs. `/storefront/catalog/{id}/categorytree` look plausible but are wrong. When 114 tools are written by reasoning about naming conventions rather than reading the spec, path errors accumulate silently — the tool exists, it calls something, and a 404 or a wrong-resource response comes back.

**Why it happens:** Swagger specs are long. Developers make educated guesses to go faster. Guesses that happen to return 200s (even with wrong data) are never caught.

**Consequences:** MCP tools call wrong endpoints. The LLM receives incorrect or empty data. Users get wrong answers from an AI that sounds confident.

**Warning signs:**
- Tool path matches a plausible English reading but was never verified against the spec
- `storefront_browse_categories` returning 404 or empty results
- Checkout/checkin tools were written without explicitly cross-referencing `warehouse-v1` sub-spec
- Invoice lifecycle (approve/process/void) tools were written without cross-referencing the correct sub-spec section

**Prevention:**
1. Create a mechanical verification checklist: for every tool, record the Swagger sub-spec, HTTP method, and exact path it was validated against.
2. Do not trust the path in existing code — go to the spec, find the endpoint, then compare.
3. For ambiguous paths, test against the live instance (GET/browse endpoints only) and confirm expected response shape.
4. The project already has `swagger_endpoints.txt` and `swagger-endpoints.txt` in the root — use these as the ground truth list, not the code.

**Phase mapping:** Phase 1 (validation pass) — must complete before expanding coverage. Every expansion built before the validation pass risks propagating the same guessing pattern.

---

### Pitfall 3: Path Tests That Only Assert Shape, Not the Actual URL

**What goes wrong:** The existing test suite captures `capturedUrl` and `capturedMethod` using a mocked `fetch`. This is the right pattern. The risk is tests that verify the response shape (e.g., "response has `Rows`") but not the exact URL string. A test can pass even if the path is wrong because the mock returns the same canned `BROWSE_RESPONSE` regardless.

**Why it happens:** It's easy to write `expect(result).toBeDefined()` rather than `expect(capturedUrl).toBe('/api/v1/inventory/browse')`. Shape assertions feel like real tests.

**Consequences:** 100% passing test suite, broken production behavior. The tests give false confidence during the validation phase.

**Warning signs:**
- Tests mock `fetch` globally but assert only on return value, not `capturedUrl`
- `capturedUrl` and `capturedMethod` variables exist in test setup (they do in `api-paths.test.ts`) but are not asserted in every `it()` block
- Test names say "calls correct endpoint" but the assertion is on the response

**Prevention:**
- Every `it()` for a path test MUST assert `capturedUrl` (exact string) and `capturedMethod`
- Add a linter rule or test-file template that enforces this pattern
- Consider a test helper: `expectApiCall(url, method)` that wraps the assertion so it can't be accidentally omitted

**Phase mapping:** Phase 1 (test hardening) — audit all existing tests for this before treating green CI as a signal.

---

### Pitfall 4: Integration Tests That Accidentally Mutate Data

**What goes wrong:** Integration tests hit the live RentalWorks instance. A test written as "read-only" can trigger a mutation if the endpoint has side effects (e.g., a GET that advances a workflow state, or a browse on a checkout session that marks it as reviewed).

**Why it happens:** REST semantics (GET = safe) don't hold for all RentalWorks endpoints given the non-conventional API design. A developer assumes GET = safe and writes a "read-only" integration test that triggers a state change.

**Consequences:** Real rental records corrupted, orders moved to wrong states, invoice status changed — all on a live instance with real customer data.

**Warning signs:**
- Any integration test against warehouse-v1 endpoints (checkout/checkin sessions are stateful)
- Any test calling endpoints with verbs in the path like `approve`, `process`, `void`, `complete`
- Any test that browses a list of "pending" or "in-progress" items (some RW browse endpoints have implicit side effects)

**Prevention:**
- Whitelist-only approach: maintain an explicit list of safe integration test endpoints. Default is: do not add to integration tests.
- Never call warehouse-v1 state-transition endpoints in integration tests, even as GET/browse
- Review every integration test endpoint against the Swagger spec for documented side effects before adding it
- Add a comment to every integration test file: `// SAFE ENDPOINTS ONLY — verify in Swagger before adding`

**Phase mapping:** Phase 2 (integration testing) — establish the whitelist before writing any integration tests.

---

### Pitfall 5: Expanding Coverage Before Fixing Existing Paths

**What goes wrong:** New endpoints are added to cover "high-value missing functionality" (dashboard, activities, address management, etc.) while the 114 existing tools still have unverified paths. The new tools follow the same patterns as the old ones — including any wrong patterns.

**Why it happens:** It feels more productive to add features than to audit and fix existing ones. "We'll validate it all at the end."

**Consequences:** The bug surface grows linearly with each new tool added before validation. At 200 tools, a full audit is twice the work it would have been at 100.

**Warning signs:**
- PRs adding new tools before `swagger_endpoints.txt` has been fully cross-referenced against tool files
- "Validation pass" is listed as a separate task to do "later" rather than a prerequisite gate

**Prevention:**
- Hard gate: no new tool additions until all existing tools have a validated-path assertion in `api-paths.test.ts`
- Track validation progress with a simple checklist (one row per tool) in the PR description
- The PROJECT.md already states "Validate existing before expanding" — enforce it as a merge-blocking rule

**Phase mapping:** Phase 1 complete before Phase 2 begins (non-negotiable sequencing).

---

## Moderate Pitfalls

---

### Pitfall 6: Multi-Sub-Spec Confusion (12 Swagger Sub-Specs)

**What goes wrong:** RentalWorks exposes 12 separate Swagger sub-specs (`accountservices-v1`, `home-v1`, `warehouse-v1`, `settings-v1`, `reports-v1`, `utilities-v1`, `administrator-v1`, `storefront-v1`, etc.). Developers searching the wrong sub-spec conclude an endpoint doesn't exist, or find a similarly-named endpoint in the wrong spec and use the wrong base path.

**Warning signs:**
- Checkout/checkin tools validated against `home-v1` instead of `warehouse-v1`
- Invoice tools validated against `home-v1` instead of the correct billing sub-spec

**Prevention:**
- Document which sub-spec covers which tool domain in a reference table before beginning the validation pass
- The validation checklist (see Pitfall 2) must include the sub-spec column, not just path and method

**Phase mapping:** Phase 1 setup — build the sub-spec → domain mapping table first.

---

### Pitfall 7: `withErrorHandling` Wrapper Masking Real Bugs

**What goes wrong:** The existing `withErrorHandling` wrapper catches RentalWorks 500 errors (known server-side DB column bugs) and returns structured error messages instead of throwing. This is correct behavior for known server issues. The risk is that it also masks 500s caused by wrong paths or wrong request bodies — bugs introduced by the MCP server itself.

**Warning signs:**
- A tool that should return data instead returns a structured error response with status 500
- The error message looks like a RW server-side issue but the path hasn't been validated
- New tools added using the same wrapper before their paths are verified

**Prevention:**
- In tests, assert that a correctly-formed request to a correct path returns non-error data (not just "no throw")
- Log the full request (method + path + body) alongside every 500 response during development, even if the error is caught gracefully
- During the validation pass, temporarily disable `withErrorHandling` on tools being validated so wrong-path 500s surface as failures rather than structured errors

**Phase mapping:** Phase 1 (validation) — awareness required throughout.

---

### Pitfall 8: Zod Schema Drift from Actual API Shape

**What goes wrong:** Zod schemas are written once and then the API changes or was never correctly understood. A schema accepts `orderId: string` but the API requires `OrderId: string` (capitalization matters). Or the schema allows optional fields the API treats as required. The MCP tool "works" in the sense that it doesn't throw, but the API silently ignores the input.

**Warning signs:**
- API returns a success response but no record is created/updated
- Request body schema uses camelCase but RW API historically uses PascalCase for body fields
- Optional fields in Zod that always need to be supplied to get useful results

**Prevention:**
- Cross-reference every request body schema against the Swagger `requestBody` definition, not just the path
- Add at least one test per tool that asserts the exact request body shape sent to the API (the `request-bodies.test.ts` file already exists for this — use it)

**Phase mapping:** Phase 1 (validation) alongside path validation.

---

## Minor Pitfalls

---

### Pitfall 9: Tool Name Collisions After Expansion

**What goes wrong:** When adding the ~20+ new tools for expanded coverage (dashboard, activities, address management, etc.), a new tool gets a name that conflicts with an existing tool or is ambiguous to an LLM choosing between tools.

**Prevention:**
- Review all existing tool names before naming new ones
- Follow the existing naming convention: `{domain}_{verb}_{noun}` (e.g., `inventory_browse_items`, `orders_get_order`)
- The `removed-tools.test.ts` file already guards against accidentally re-adding removed tools — keep it updated

**Phase mapping:** Phase 2 (expansion) — naming review before registration.

---

### Pitfall 10: JWT Token Lifetime Assumptions in Integration Tests

**What goes wrong:** Integration tests authenticate once (`beforeAll`) and reuse the token for all tests. If the test suite is slow or RentalWorks JWT tokens have a short expiry, later tests in the suite fail with auth errors rather than the actual assertion failing.

**Warning signs:**
- Integration tests pass when run individually but fail when the full suite runs
- Auth errors appearing only in tests that run late in the sequence

**Prevention:**
- Test the JWT expiry window against the live instance before writing the integration suite
- If expiry is short, use `beforeEach` auth refresh or a token refresh helper in the test setup
- Already have `resetClient()` in the test setup — verify it re-authenticates, not just clears state

**Phase mapping:** Phase 2 (integration tests) — verify before writing the suite.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dependency audit | `zod` missing from `package.json` (Pitfall 1) | Fix before anything else |
| Swagger validation pass | Wrong sub-spec consulted (Pitfall 6) | Build sub-spec mapping table first |
| Path validation | Tests assert shape not URL (Pitfall 3) | Audit `capturedUrl` assertions in all existing tests |
| Path validation | `withErrorHandling` masking wrong-path 500s (Pitfall 7) | Temporarily disable wrapper per-tool during validation |
| Request body validation | Zod schema / API shape mismatch (Pitfall 8) | Use `request-bodies.test.ts` for every tool |
| Endpoint expansion | Adding tools before validation complete (Pitfall 5) | Hard gate: validate first |
| Integration tests | Live data mutation from "safe" endpoints (Pitfall 4) | Whitelist + Swagger side-effect review |
| Integration tests | JWT token expiry mid-suite (Pitfall 10) | Verify expiry window before writing suite |
| Tool naming in expansion | Name collisions / ambiguity (Pitfall 9) | Review existing names before registering new tools |

---

## Sources

- Codebase evidence: `package.json` (missing `zod`), `src/__tests__/api-paths.test.ts` (test pattern), `src/utils/tool-helpers.ts` (zod import), `PROJECT.md` (known issues)
- Confidence: HIGH — pitfalls are grounded in specific observed codebase conditions, not generic advice
