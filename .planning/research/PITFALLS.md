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

### Pitfall 6: Mutating browseSchema Breaks All 114 Tools at Once

**What goes wrong:** `browseSchema` is spread (`...browseSchema`) into 114 tool definitions. Any change that adds a required field, renames a key, or changes a default will silently alter every tool's input contract. The TypeScript compiler will not catch this — Zod spreads are structural, not nominal. An added `fields` parameter with `.default([])` will appear in every tool's MCP tool description and parameter list, including tools where it makes no sense (e.g., `get_item_by_barcode` that does not call `formatBrowseResult`).

**Why it happens:** The `...browseSchema` spread pattern was designed for uniform browse tools. It was not designed to be extended with feature-specific fields that only apply to some tools. When adding field selection, developers reach for `browseSchema` because it's where the other filter params live.

**How to avoid:** Do NOT add `fields` or `clientFilter` parameters to `browseSchema`. Create a separate additive schema object and spread it only into the specific tools that need it:

```typescript
// BAD — bleeds into all 114 tools
export const browseSchema = {
  ...existingFields,
  fields: z.array(z.string()).optional(), // WRONG
};

// GOOD — opt-in per tool
export const browseFieldSelectionSchema = {
  fields: z.array(z.string()).optional().describe("Fields to return"),
};

// In inventory.ts only:
server.tool("browse_rental_inventory", "...", {
  ...browseSchema,
  ...browseFieldSelectionSchema,
  categoryId: z.string().optional(),
}, handler);
```

**Warning signs:**
- Editing the `browseSchema` export object in `tool-helpers.ts`
- Modifying `buildBrowseRequest`'s function signature (callers are all 114 tools)
- Running `grep -r "browseSchema"` shows 12 tool files all importing it

**Phase to address:** Design phase. Decide the extension strategy before writing any code. Lock it in as a constraint before implementation starts.

---

### Pitfall 7: Client-Side Filter With Too-Small Page Size Returns Misleadingly Empty Results

**What goes wrong:** The client fetches page N of M records from the API, then filters them in the MCP layer. If the caller requests `pageSize: 5` (the current default) and the filter discards 4 of 5 results, the caller receives 1 result and has no way to know thousands of matching records exist on other pages. The pagination metadata (`TotalRows`, `TotalPages`) comes from the API before filtering — it does not reflect the post-filter count. The LLM receives misleading result counts.

**Why it happens:** Naive implementation: fetch one page, filter, return. Pagination math is designed for server-side filtering where the API applies the filter before counting.

**How to avoid:** For client-side filter operations, either:
1. Fetch a large enough page (e.g., `pageSize: 100-500`) to get sufficient results before filtering
2. Explicitly annotate the output to show that counts reflect unfiltered API data

When client-side filtering is the workaround for a broken server filter, use a larger default page size in the specific tool, not the shared `browseSchema` default.

**Warning signs:**
- Default `pageSize: 25` left in place when client-side filtering is added
- Tests only verify "returns results" without verifying count accuracy
- Returning `formatBrowseResult(data)` after filtering `data.Rows` without updating `data.TotalRows`

**Phase to address:** Implementation phase. The default page size for inventory browse tools that use client-side filtering must be explicitly set to a working value (100+) in the tool definition, not in the shared schema.

---

### Pitfall 8: formatBrowseResult Signature Change Is a Hidden Break Across 20+ Tools

**What goes wrong:** `formatBrowseResult` is called by ~20+ browse tools across multiple domain files. If you change its signature — adding a required `fields` parameter, changing the data shape, or altering its return format — every caller silently breaks. Several callers use `data as any` casts, meaning TypeScript type checking is bypassed entirely for those call sites.

**Why it happens:** The `as any` casts in tool handlers were added because the API response type was `unknown`. They are a type-safety escape hatch that also disables compile-time protection for signature changes.

**How to avoid:** Do NOT change `formatBrowseResult`'s existing call signature. Add an optional second parameter with a default:

```typescript
// SAFE — backward compatible, existing callers unchanged
export function formatBrowseResult(
  data: { TotalRows: number; PageNo: number; PageSize: number; TotalPages: number; Rows: Record<string, unknown>[] },
  options?: { fields?: string[]; clientFiltered?: boolean }
): string
```

Run `grep -r "formatBrowseResult"` before any change and verify every caller after the change compiles with `npx tsc --noEmit`.

**Warning signs:**
- TypeScript errors in tool files you did not touch, after changing `tool-helpers.ts`
- `as any` casts masking compile errors in callers
- Unit tests for `formatBrowseResult` only test the existing shape

**Phase to address:** Design phase — decide extension strategy. Implementation phase — use backward-compatible optional parameter.

---

### Pitfall 9: Field Projection Stripping Fields That Are Null vs. Not-Requested

**What goes wrong:** `formatBrowseResult` already strips null/undefined/"" values. If field projection is added inside `formatBrowseResult`, projected fields that happen to be empty for a row silently disappear. The LLM cannot distinguish "field was not requested" from "field has no value" from "field does not exist on this entity."

**Why it happens:** Two orthogonal concerns — null filtering and field selection — get merged in the same function without explicitly handling their interaction.

**How to avoid:** Apply field projection as a pure array transform on `data.Rows` before passing to `formatBrowseResult`, not inside it:

```typescript
function projectFields(
  rows: Record<string, unknown>[],
  fields: string[]
): Record<string, unknown>[] {
  if (!fields.length) return rows;
  return rows.map(row => Object.fromEntries(fields.map(f => [f, row[f]])));
}

// In the tool handler:
const projected = projectFields(data.Rows, args.fields ?? []);
return { content: [{ type: "text", text: formatBrowseResult({ ...data, Rows: projected }) }] };
```

This keeps concerns separate. The existing null-filtering behavior is preserved.

**Warning signs:**
- Field selection logic added inside `formatBrowseResult`
- No test case: "projected field that is null for some rows"
- LLM receiving inconsistent numbers of fields per row in the same result set

**Phase to address:** Implementation phase. `projectFields` should be a separately unit-tested utility function.

---

### Pitfall 10: Fallback Retry Logic Added to the Shared withErrorHandling Wrapper

**What goes wrong:** The plan includes "graceful fallback for known broken endpoints — detect specific 500 errors and retry with client-side filtering." If retry logic is added to `withErrorHandling`, it affects all 114 tools. A 500 triggered by a genuinely wrong path in any tool would trigger a retry, masking the real bug. Worse: if the retry itself 500s, the wrapper can produce a misleading error or an infinite loop.

**Why it happens:** `withErrorHandling` is where 500 errors are already handled. Adding "and retry here" feels like the right place. But the wrapper was designed as a pure error-to-message converter, not a retry controller.

**How to avoid:** Implement fallback retry at the individual tool handler level only, using precise error string detection:

```typescript
// WRONG — modifies shared wrapper affecting all 114 tools
export function withErrorHandling(handler) { ... retry logic here ... }

// RIGHT — isolated to browse_rental_inventory handler only
async (args) => {
  try {
    return await callWithServerFilter(args);
  } catch (err) {
    if (isInvalidColumnError(err)) {
      // retry without server-side filter, apply client-side
      const fallbackData = await callWithoutFilter(args);
      const filtered = applyClientFilter(fallbackData.Rows, args.searchValue);
      return formatResult({ ...fallbackData, Rows: filtered }, { clientFiltered: true });
    }
    throw err; // let withErrorHandling handle everything else
  }
}
```

**Warning signs:**
- Retry logic added to `withErrorHandling` in `tool-helpers.ts`
- Retry logic added to the `browse` method in `api-client.ts`
- No maximum retry count in fallback logic
- Fallback triggers on any 500, not specifically on "Invalid column name"

**Phase to address:** Implementation phase. Retry logic must be scoped to specific inventory tool handlers only. `withErrorHandling` must remain a pure error-to-message converter.

---

### Pitfall 11: Pagination Metadata Becomes Misleading After Client-Side Filtering

**What goes wrong:** After applying client-side filtering, `TotalRows` and `TotalPages` in the formatted output still reflect the API's unfiltered count. The LLM sees "Results: 847 total (page 1 of 34)" but only 12 rows match the filter. It will attempt to paginate through 34 pages expecting more matching items — none of which will match.

**Why it happens:** `formatBrowseResult` reads `data.TotalRows` directly. When rows are filtered before display, these fields are no longer accurate but the output does not say so.

**How to avoid:** When client-side filtering is applied, annotate the output:

```typescript
// In tool handler after client filtering:
const resultText = formatBrowseResult({ ...data, Rows: filteredRows });
const note = "\n[Note: Filter applied client-side. Total row counts reflect unfiltered API data.]";
return { content: [{ type: "text", text: resultText + note }] };
```

**Warning signs:**
- `formatBrowseResult` output unchanged after client filtering
- No test: "pagination annotation present when client filter applied"
- LLM paging through all pages and finding no additional matches

**Phase to address:** Implementation phase.

---

## Moderate Pitfalls

---

### Pitfall 12: Multi-Sub-Spec Confusion (12 Swagger Sub-Specs)

**What goes wrong:** RentalWorks exposes 12 separate Swagger sub-specs (`accountservices-v1`, `home-v1`, `warehouse-v1`, `settings-v1`, `reports-v1`, `utilities-v1`, `administrator-v1`, `storefront-v1`, etc.). Developers searching the wrong sub-spec conclude an endpoint doesn't exist, or find a similarly-named endpoint in the wrong spec and use the wrong base path.

**Warning signs:**
- Checkout/checkin tools validated against `home-v1` instead of `warehouse-v1`
- Invoice tools validated against `home-v1` instead of the correct billing sub-spec

**Prevention:**
- Document which sub-spec covers which tool domain in a reference table before beginning the validation pass
- The validation checklist (see Pitfall 2) must include the sub-spec column, not just path and method

**Phase mapping:** Phase 1 setup — build the sub-spec → domain mapping table first.

---

### Pitfall 13: `withErrorHandling` Wrapper Masking Real Bugs

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

### Pitfall 14: Zod Schema Drift from Actual API Shape

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

### Pitfall 15: Tool Name Collisions After Expansion

**What goes wrong:** When adding the ~20+ new tools for expanded coverage (dashboard, activities, address management, etc.), a new tool gets a name that conflicts with an existing tool or is ambiguous to an LLM choosing between tools.

**Prevention:**
- Review all existing tool names before naming new ones
- Follow the existing naming convention: `{domain}_{verb}_{noun}` (e.g., `inventory_browse_items`, `orders_get_order`)
- The `removed-tools.test.ts` file already guards against accidentally re-adding removed tools — keep it updated

**Phase mapping:** Phase 2 (expansion) — naming review before registration.

---

### Pitfall 16: JWT Token Lifetime Assumptions in Integration Tests

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

### Pitfall 17: Large Page Fetch Causing Memory and Latency Issues

**What goes wrong:** Client-side filtering requires fetching more records upfront (100-500) to have enough data to filter against. For the inventory domain this is intentional. If the pattern leaks into other domains (orders, customers) via a global page size change, all browse tools become slower and more memory-intensive.

**Warning signs:**
- `pageSize` default in `browseSchema` increased from 25 to 100+
- Other domain tools (orders, customers) suddenly returning 100 rows when users expect 25
- Node.js process memory growing under sustained browse usage

**Prevention:**
- Set larger page defaults in the inventory tool definitions explicitly (`pageSize: z.number().optional().default(100)`) rather than changing `browseSchema`
- Never change the shared `browseSchema` page size default

**Phase mapping:** Implementation phase — set per-tool defaults, not shared schema defaults.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Adding `fields` param to `browseSchema` | Quick implementation | Every MCP tool description polluted with irrelevant parameter | Never |
| Using `data as any` in new code | Avoids type complexity | Type changes to helpers do not compile-fail at call sites | Only when API shape is genuinely unknown at design time |
| Hardcoding field sets as constants (e.g., `INVENTORY_DEFAULT_FIELDS`) | Fast for v1.1 | Field sets diverge as RW API evolves; periodic maintenance required | Acceptable for v1.1 if documented with a review note |
| Increasing default pageSize in `browseSchema` | Simpler than per-tool defaults | Higher memory and network cost for all 114 tools | Never — scope to specific tools |
| Putting client-filter logic inside `api-client.ts` | Centralizes code | API client becomes aware of domain logic and view concerns | Never |
| Retry logic in `withErrorHandling` | Centralized retry | Retry applies to all tools, masks real bugs, breaks recovery semantics | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| RentalWorks browse API | Treating `searchfields`/`searchfieldvalues` as always reliable | These are server-side and known-broken for specific columns — detect the 500 and fall back to client-side |
| MCP tool registration | Assuming tool schema changes are additive-safe | MCP clients cache tool definitions; schema changes may require client reconnect to take effect |
| Zod spread (`...browseSchema`) | Adding fields to `browseSchema` thinking it's isolated | Zod object spread merges into all 114 tool schemas — opt-in only at the tool level |
| formatBrowseResult | Passing filtered rows but keeping original `TotalRows` | The function reads `data.TotalRows` directly — must annotate output or pass a modified data object |
| withErrorHandling wrapper | Adding retry/fallback logic to the wrapper | It wraps all tools — scope retries to individual tool handlers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching 500 rows for client-side filter on every call | Slow responses, high memory, API rate limit pressure | Use large page fetches only when server-side filter is confirmed broken for the specific column | Even at modest usage — 500-record RW responses can be 500KB+ per call |
| Loading all pages to find filtered matches | Tool hangs or times out | Set a max pages-to-scan limit (e.g., 3 pages) with early exit when enough results found | Immediately with 5000+ inventory items |
| Client-side substring match across all fields | High CPU in Node.js process | Limit client filter to the specific field the caller requested, not all row fields | At 200+ rows per page |
| Global page size increase for all browse tools | All 11 domain browse tools slow down | Set larger defaults per inventory tool, not in `browseSchema` | Immediately in any domain with large datasets |

---

## "Looks Done But Isn't" Checklist

- [ ] **Field selection:** The `fields` parameter is in the Zod schema — verify it is actually applied to `data.Rows` before `formatBrowseResult` is called, not just documented in the description
- [ ] **Client-side filter:** Filter is applied — verify pagination metadata is annotated to note client-filter was used and counts are unfiltered
- [ ] **Fallback retry:** Retry works manually — verify it is guarded by the specific error string "Invalid column name" and not the general 500 case
- [ ] **Default page size:** Inventory browse defaults increased — verify `browseSchema` default in `tool-helpers.ts` is still 25 (unchanged)
- [ ] **browseSchema unchanged:** New params are in `inventory.ts` only — `grep "fields" src/utils/tool-helpers.ts` returns nothing
- [ ] **withErrorHandling unchanged:** No retry logic added — inspect `withErrorHandling` body before merge
- [ ] **projectFields unit tests:** New field-projection utility has its own unit tests, not just tested through integration
- [ ] **TypeScript clean:** Run `npx tsc --noEmit` — zero errors after any change to `tool-helpers.ts`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `browseSchema` accidentally modified | HIGH | Revert change; audit all 114 tools for schema drift; re-run full test suite and manually verify MCP tool descriptions |
| `withErrorHandling` modified with retry | MEDIUM | Revert to pure error converter; move retry logic to individual tool handlers; re-test each affected tool |
| Misleading pagination metadata shipped | LOW | Add annotation string to call sites that use client filtering; no schema change needed |
| Wrong default pageSize set globally | LOW | Revert `browseSchema` default to 25; add explicit larger default in inventory tool definitions |
| Client filter logic added to `api-client.ts` | MEDIUM | Extract filter to `tool-helpers.ts` or `inventory.ts`; `api-client.ts` must remain a pure transport layer |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dependency audit | `zod` missing from `package.json` (Pitfall 1) | Fix before anything else |
| Swagger validation pass | Wrong sub-spec consulted (Pitfall 12) | Build sub-spec mapping table first |
| Path validation | Tests assert shape not URL (Pitfall 3) | Audit `capturedUrl` assertions in all existing tests |
| Path validation | `withErrorHandling` masking wrong-path 500s (Pitfall 13) | Temporarily disable wrapper per-tool during validation |
| Request body validation | Zod schema / API shape mismatch (Pitfall 14) | Use `request-bodies.test.ts` for every tool |
| Endpoint expansion | Adding tools before validation complete (Pitfall 5) | Hard gate: validate first |
| Integration tests | Live data mutation from "safe" endpoints (Pitfall 4) | Whitelist + Swagger side-effect review |
| Integration tests | JWT token expiry mid-suite (Pitfall 16) | Verify expiry window before writing suite |
| Tool naming in expansion | Name collisions / ambiguity (Pitfall 15) | Review existing names before registering new tools |
| Adding field selection | Modifying `browseSchema` (Pitfall 6) | Opt-in schema extension at tool level only |
| Adding field selection | `formatBrowseResult` signature break (Pitfall 8) | Backward-compatible optional second parameter |
| Adding client-side filter | Wrong page size (Pitfall 7) | Larger default in inventory tool definition, not shared schema |
| Adding client-side filter | Misleading pagination counts (Pitfall 11) | Annotate output when client filter applied |
| Adding fallback retry | Retry in shared wrapper (Pitfall 10) | Scope retry to individual tool handlers only |
| Inventory browse page size | Global page size increase (Pitfall 17) | Per-tool default, not `browseSchema` default |

---

## Sources

- Codebase evidence: `package.json` (missing `zod`), `src/__tests__/api-paths.test.ts` (test pattern), `src/utils/tool-helpers.ts` (zod import, browseSchema spread pattern), `src/tools/inventory.ts` (tool handler patterns), `PROJECT.md` (known issues and active milestone)
- Confidence: HIGH — pitfalls are grounded in specific observed codebase conditions, not generic advice
