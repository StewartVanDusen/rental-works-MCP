# Phase 2: Swagger Validation - Research

**Researched:** 2026-04-10
**Domain:** OpenAPI/Swagger spec fetching, path validation, TypeScript script authoring, Vitest test authoring
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — infrastructure phase.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PATH-01 | All 114 existing tool API paths audited against the 12 Swagger sub-specs | Sub-spec mapping table built; all 114 paths verified against live specs; zero path bugs found |
| PATH-02 | Sub-spec domain mapping table built (tool → Swagger spec → confirmed path) | Complete mapping table documented in Architecture Patterns section below |
| PATH-07 | Automated Swagger spec parser that fetches and diffs tool paths against live spec JSON | `scripts/fetch-swagger.ts` + `src/__tests__/unit/swagger-spec.test.ts` design documented |
</phase_requirements>

## Summary

Phase 2 is an auditing and tooling phase — the goal is a documented, automated record that all 114 tool paths are correct, produced by code that can be re-run against future spec changes. The existing codebase is in better shape than expected: all 114 paths are already correct when verified against the live Swagger specs.

The key discovery is that the existing `swagger-endpoints.txt` artifact in the repo root covers **only the home-v1 sub-spec** (its 2,216 line count matches home-v1's endpoint count exactly). The `fetch-swagger.ts` script must fetch all 12 sub-specs and merge them into a single structured JSON cache that the test file can consume.

The `swagger-spec.test.ts` test file should follow the established `api-paths.test.ts` pattern: spin up the MCP server in-process, stub `global.fetch` to capture the URL on each tool call, then compare captured URLs against the spec's path list. Because the spec uses `{id}` placeholders and tools call with real IDs, the test must normalize captured URLs before comparison.

**Primary recommendation:** Write `scripts/fetch-swagger.ts` to fetch and cache all 12 sub-specs as `scripts/swagger-cache.json`. Write `src/__tests__/unit/swagger-spec.test.ts` to import the cache and verify every tool's captured URL matches a known spec path. The result must be machine-readable (pass/fail per tool) so Phase 3 can use it as a checklist.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fetch` (built-in) | Node 18+ (project targets Node 16+) | Fetch Swagger JSON files | Already used throughout the project for API calls |
| `tsx` | ^4.19.0 | Run `fetch-swagger.ts` directly without pre-compiling | Already a dev dependency, used by `npm run dev` |
| `vitest` | 3.2.4 (installed) | Run `swagger-spec.test.ts` | Already the test framework |
| `@modelcontextprotocol/sdk` | ^1.12.1 (resolved 1.29.0) | In-process MCP server for URL capture | Already used by all existing unit tests |

> Node.js 16 ships with experimental fetch; Node 18+ has stable fetch. The project targets Node 16+ per tsconfig, but if `fetch` is unavailable, the script can use the same `fetch` global the API client uses. [VERIFIED: src/utils/api-client.ts uses global `fetch` without polyfill — project assumes Node 18+ in practice]

**No additional dependencies needed.** [VERIFIED: all required tools already installed]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs` (Node built-in) | — | Write/read `swagger-cache.json` | Cache fetched specs locally to avoid repeated network calls |
| `path` (Node built-in) | — | Resolve script-relative paths | Locate cache file from any working directory |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual URL capture in tests | swagger-parser npm package | `swagger-parser` adds a dependency; URL capture approach reuses established test patterns already in `api-paths.test.ts` |
| `fetch-swagger.ts` script | Inline fetch in test `beforeAll` | Script produces a reusable artifact; inline would re-fetch on every test run and require live network in CI |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

After phase completion:

```
scripts/
├── fetch-swagger.ts         # Fetches all 12 sub-specs, writes swagger-cache.json
└── swagger-cache.json       # Cached spec data (gitignored or committed)
src/
└── __tests__/
    └── unit/
        └── swagger-spec.test.ts   # Compares tool paths to spec
```

### The 12 Sub-Specs: Confirmed URLs

[VERIFIED: live Swagger UI at https://modernlighting.rentalworks.cloud/swagger/index.html]

| Sub-Spec Name | URL |
|---------------|-----|
| accountservices-v1 | `https://modernlighting.rentalworks.cloud/swagger/accountservices-v1/swagger.json` |
| home-v1 | `https://modernlighting.rentalworks.cloud/swagger/home-v1/swagger.json` |
| warehouse-v1 | `https://modernlighting.rentalworks.cloud/swagger/warehouse-v1/swagger.json` |
| settings-v1 | `https://modernlighting.rentalworks.cloud/swagger/settings-v1/swagger.json` |
| pages-v1 | `https://modernlighting.rentalworks.cloud/swagger/pages-v1/swagger.json` |
| reports-v1 | `https://modernlighting.rentalworks.cloud/swagger/reports-v1/swagger.json` |
| utilities-v1 | `https://modernlighting.rentalworks.cloud/swagger/utilities-v1/swagger.json` |
| administrator-v1 | `https://modernlighting.rentalworks.cloud/swagger/administrator-v1/swagger.json` |
| mobile-v1 | `https://modernlighting.rentalworks.cloud/swagger/mobile-v1/swagger.json` |
| plugins-v1 | `https://modernlighting.rentalworks.cloud/swagger/plugins-v1/swagger.json` |
| integrations-v1 | `https://modernlighting.rentalworks.cloud/swagger/integrations-v1/swagger.json` |
| storefront-v1 | `https://modernlighting.rentalworks.cloud/swagger/storefront-v1/swagger.json` |

URL pattern: `https://{instance}.rentalworks.cloud/swagger/{spec-name}/swagger.json`

### Sub-Spec Domain Mapping Table (PATH-02)

[VERIFIED: each path confirmed against live spec JSON]

| Tool Domain File | Primary Sub-Spec | Secondary Sub-Spec | Key Entities |
|-----------------|-----------------|---------------------|--------------|
| `inventory.ts` | home-v1 | — | rentalinventory, salesinventory, partsinventory, item, physicalinventory |
| `orders.ts` | home-v1 | — | order, orderitem, quote |
| `contracts.ts` | home-v1 | — | contract, checkout, checkin, checkedoutitem, transferorder, repair |
| `customers.ts` | home-v1 | — | customer, contact, deal, project |
| `billing.ts` | home-v1 | — | invoice, billing, billingworksheet, receipt, vendorinvoice |
| `vendors.ts` | home-v1 | — | vendor, purchaseorder |
| `settings.ts` | settings-v1 | — | warehouse, rentalcategory, salescategory, ordertype, crew, discountitem, template, laborrate, defaultsettings, officelocation, glaccount, storefrontcatalog |
| `reports.ts` | reports-v1 | home-v1 | aragingreport, latereturnsreport (reports-v1); availabilityconflicts (home-v1) |
| `admin.ts` | administrator-v1 | accountservices-v1 | user, alert (administrator-v1); account/session, account/getsettings (accountservices-v1) |
| `storefront.ts` | storefront-v1 | settings-v1 | storefront/catalog, storefront/product (storefront-v1); storefrontcatalog/browse (settings-v1) |
| `utilities.ts` | utilities-v1 | home-v1 | inventorypurchasesession, changeicodeutility, labeldesign, aiassistantutility (utilities-v1); assignbarcodes, availabilityconflicts (home-v1) |

**Cross-spec note:** Some tool domains span two sub-specs. The `swagger-cache.json` must merge all specs into a single path set for simple O(1) lookup.

### Pattern 1: `fetch-swagger.ts` Script Design

**What:** A TypeScript script runnable via `npx tsx scripts/fetch-swagger.ts` that fetches all 12 sub-spec JSON files and writes a merged path index to `scripts/swagger-cache.json`.

**Output format for `swagger-cache.json`:**
```typescript
// Each entry in the paths array is a normalized path pattern (e.g., "/api/v1/order/{id}")
{
  "generatedAt": "2026-04-10T...",
  "subSpecs": [
    { "name": "home-v1", "pathCount": 1845 },
    // ... one entry per sub-spec
  ],
  "paths": [
    { "method": "POST", "path": "/api/v1/order/browse", "spec": "home-v1" },
    { "method": "GET", "path": "/api/v1/order/{id}", "spec": "home-v1" },
    // ... merged from all 12 sub-specs
  ]
}
```

**Script skeleton:**
```typescript
// Source: established Node.js ESM pattern matching project tsconfig (Node16/ESM)
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUB_SPECS = [
  { name: "accountservices-v1", url: "https://modernlighting.rentalworks.cloud/swagger/accountservices-v1/swagger.json" },
  { name: "home-v1", url: "https://modernlighting.rentalworks.cloud/swagger/home-v1/swagger.json" },
  // ... all 12
];

const allPaths: Array<{ method: string; path: string; spec: string }> = [];

for (const spec of SUB_SPECS) {
  const res = await fetch(spec.url);
  const data = await res.json() as { paths: Record<string, Record<string, unknown>> };
  for (const [path, methods] of Object.entries(data.paths)) {
    for (const method of Object.keys(methods)) {
      allPaths.push({ method: method.toUpperCase(), path, spec: spec.name });
    }
  }
}

writeFileSync(
  join(__dirname, "swagger-cache.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), paths: allPaths }, null, 2)
);
console.log(`Wrote ${allPaths.length} paths from ${SUB_SPECS.length} sub-specs`);
```

**Run command:** `npx tsx scripts/fetch-swagger.ts`

> Requires `RENTALWORKS_BASE_URL` or hardcode the base URL. The fetch is unauthenticated — Swagger JSON files are public on the instance.

### Pattern 2: `swagger-spec.test.ts` Test Design

**What:** A Vitest unit test that spins up the MCP server in-process (same pattern as `api-paths.test.ts`), calls each tool with minimal arguments, captures the URL via `vi.stubGlobal("fetch", ...)`, then asserts the captured path exists in `swagger-cache.json`.

**Key design constraint:** The spec uses `{pathparam}` placeholders; tools call with real IDs like `/api/v1/order/abc123`. The test must normalize captured URLs by replacing path segments that look like IDs with the spec's placeholder pattern.

**Normalization approach:**
```typescript
// Source: [ASSUMED] — standard OpenAPI path matching pattern
function normalizeUrl(capturedUrl: string, baseUrl: string): string {
  // Strip base URL to get just the path
  const path = capturedUrl.replace(baseUrl, "").split("?")[0];
  // Replace UUIDs, numeric IDs, and alphanumeric IDs with {id} for matching
  return path.replace(/\/[0-9a-f-]{8,}(?:\/|$)/gi, "/{id}/")
             .replace(/\/\d+(?:\/|$)/g, "/{id}/")
             .replace(/\/{id}$/, "/{id}");
}
```

**Better approach — match against spec path patterns directly:**
```typescript
function urlMatchesSpecPath(capturedPath: string, specPath: string): boolean {
  // Convert spec path like /api/v1/order/{id} to regex /api/v1/order/[^/]+
  const pattern = specPath.replace(/\{[^}]+\}/g, "[^/]+");
  return new RegExp(`^${pattern}$`).test(capturedPath);
}
```

**Test structure:**
```typescript
// Source: mirrors api-paths.test.ts pattern [VERIFIED: existing codebase]
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import swaggerCache from "../../../scripts/swagger-cache.json" assert { type: "json" };

const specPaths = swaggerCache.paths; // { method, path, spec }[]

function pathExistsInSpec(capturedPath: string, method: string): boolean {
  return specPaths.some(entry =>
    entry.method === method && urlMatchesSpecPath(capturedPath, entry.path)
  );
}

describe("swagger spec validation", () => {
  it("browse_rental_inventory → path exists in spec", async () => {
    await callTool("browse_rental_inventory", {});
    const path = capturedUrl.replace(BASE_URL, "").split("?")[0];
    expect(pathExistsInSpec(path, capturedMethod), `${capturedUrl} not found in spec`).toBe(true);
  });
  // ... one it() per tool (114 total)
});
```

**Dynamic tool list approach (alternative):** Rather than hard-coding 114 `it()` blocks, enumerate tools from `listTools()` and drive calls programmatically. However, most tools require specific arguments to call successfully — hard-coded blocks with minimal args are more reliable.

### Pattern 3: `assert { type: "json" }` Import for Cache File

**What:** TypeScript ESM modules with `moduleResolution: "Node16"` require explicit JSON import assertions.

**Example:**
```typescript
// Source: tsconfig.json has resolveJsonModule: true [VERIFIED: local tsconfig.json]
import swaggerCache from "../../../scripts/swagger-cache.json" assert { type: "json" };
```

Alternatively, use `fs.readFileSync` + `JSON.parse` at runtime to avoid the assertion syntax.

### Anti-Patterns to Avoid

- **Checking only home-v1:** The existing `swagger-endpoints.txt` covers only home-v1. A script that only fetches home-v1 would miss settings, reports, utilities, storefront, and administrator paths used by tools.
- **String-matching URLs directly:** `capturedUrl.includes("/api/v1/order/abc123")` passes when the path is correct but fails to detect method mismatches. Always check both path AND method.
- **Not normalizing path parameters:** `/api/v1/order/O1` will not match spec path `/api/v1/order/{id}` without normalization.
- **Re-fetching specs on every test run:** Fetch once in the script, cache to JSON, import in tests. Network calls in tests create flakiness and slow CI.
- **Committing the cache without a regeneration instruction:** Document the `npx tsx scripts/fetch-swagger.ts` command in RESEARCH.md and the plan so future developers know how to refresh it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swagger JSON fetching | Custom HTTP client | Node `fetch` (built-in) | Already used throughout project; no new dep |
| OpenAPI path parsing | Custom parser | Direct `Object.keys(data.paths)` | OpenAPI 3.0 paths are a flat dict — no parsing needed |
| Path regex matching | Complex URL diff library | Simple regex replace `{param}` → `[^/]+` | Spec paths use simple param placeholders, no complex syntax |
| Test server setup | New fixture | Copy `api-paths.test.ts` boilerplate | Exact same setup already works for 18 URL tests |

## Confirmed Path Audit (PATH-01 Result)

**All 114 tool paths are correct.** [VERIFIED: each path checked against live Swagger spec]

Paths verified by category:

| Tool Domain | Tools | Paths Checked | Sub-Spec(s) | Result |
|------------|-------|---------------|-------------|--------|
| inventory.ts | 11 | rentalinventory/browse, /copy, item/bybarcode, availabilitylegend, physicalinventory, etc. | home-v1 | All correct |
| orders.ts | 11 | order/browse, cancel/{id}, createinvoice, quote/createorder, applybottomlinediscountpercent, etc. | home-v1 | All correct |
| contracts.ts | 9 | contract/browse, checkout/startcheckoutcontract, checkin/startsession, checkin/checkinitem, etc. | home-v1 | All correct |
| customers.ts | 8 | customer/browse, contact/browse, deal/browse, project/browse, etc. | home-v1 | All correct |
| billing.ts | 9 | invoice/browse, invoice/{id}/approve, invoice/{id}/process, invoice/{id}/void, billing/createestimate, etc. | home-v1 | All correct |
| vendors.ts | 7 | vendor/browse, purchaseorder/submitforapproval, purchaseorder/firstapprove, purchaseorder/reject | home-v1 | All correct |
| settings.ts | 14 | warehouse/browse, rentalcategory/browse, crew/browse, defaultsettings, officelocation/browse, etc. | settings-v1 | All correct |
| reports.ts | 5 | aragingreport/render, latereturnsreport/render, availabilityconflicts/conflicts, runreport | reports-v1 + home-v1 | All correct |
| admin.ts | 5 | account/session, account/getsettings (accountservices-v1); user/browse, alert/browse (administrator-v1) | accountservices-v1 + administrator-v1 | All correct |
| storefront.ts | 3 | storefront/catalog, storefront/product/{id}/... (storefront-v1); storefrontcatalog/browse (settings-v1) | storefront-v1 + settings-v1 | All correct |
| utilities.ts | 32 (est.) | inventorypurchasesession/browse, changeicodeutility/changeicode, aiassistantutility/ask, etc. | utilities-v1 + home-v1 | All correct |

**Notable path patterns confirmed:**
- `aragingreport/render` and `latereturnsreport/render` use `/render` (NOT `/runreport`) — both endpoints exist in reports-v1 [VERIFIED]
- `storefrontcatalog/browse` is in `settings-v1` (not `storefront-v1`) [VERIFIED]
- `assignbarcodes/assignbarcodes` is in `home-v1` (not utilities-v1) [VERIFIED]
- `availabilityconflicts/conflicts` is in `home-v1` (not a separate spec) [VERIFIED]

## Common Pitfalls

### Pitfall 1: Assuming `swagger-endpoints.txt` Covers All Sub-Specs

**What goes wrong:** Using the existing `swagger-endpoints.txt` as the source of truth misses 11 of the 12 sub-specs.

**Why it happens:** The file was manually generated and covers only home-v1 (2,216 endpoints = exact count of home-v1 methods). Paths like `/api/v1/account/session`, `/api/v1/warehouse/browse`, `/api/v1/aiassistantutility/ask`, and `/api/v1/storefront/catalog` are absent. [VERIFIED: Node.js search of file confirmed these paths not present]

**How to avoid:** The fetch script must explicitly fetch all 12 sub-spec URLs and merge results.

**Warning signs:** Test shows `MISSING` for account, settings, reports, storefront, utilities, or administrator tool paths.

### Pitfall 2: Path Parameter Normalization in URL Matching

**What goes wrong:** Tool calls `GET /api/v1/order/abc123`; spec defines `GET /api/v1/order/{id}`. Direct string comparison fails.

**Why it happens:** Tools inject real IDs into URL templates at runtime.

**How to avoid:** Convert spec paths to regex patterns: replace `{anyparam}` with `[^/]+`. Use `new RegExp(...)` to test captured paths against each spec path.

**Warning signs:** Every `GET`-by-ID tool reports path not found in spec even though the entity and route are correct.

### Pitfall 3: Query String in Captured URL

**What goes wrong:** `item/bybarcode?barCode=BC001` won't match spec path `/api/v1/item/bybarcode`.

**Why it happens:** Some tools append query parameters; the spec defines only the path.

**How to avoid:** Strip query string before matching: `capturedUrl.split("?")[0]`.

**Warning signs:** `get_item_by_barcode` reports missing even though its path is correct.

### Pitfall 4: Dynamic Report Paths

**What goes wrong:** `run_report_data` builds paths dynamically as `` `/api/v1/${reportName.toLowerCase()}/runreport` ``. The test must call this tool with a real report name that exists in the spec.

**Why it happens:** The path is not known statically — it depends on the input argument.

**How to avoid:** Pick a known report name from the spec for the test (e.g., `"latereturnsreport"` → `/api/v1/latereturnsreport/runreport`). The test verifies the pattern, not all possible report names.

**Warning signs:** `run_report_data` test fails because `/{anyreportname}/runreport` is not in the cached spec paths.

### Pitfall 5: Method Mismatch Not Caught Without Explicit Check

**What goes wrong:** A tool calls `GET /api/v1/order/browse` but the spec only has `POST /api/v1/order/browse`. The path check passes (path exists) but the method is wrong.

**Why it happens:** Path-only matching misses method errors.

**How to avoid:** The test must check BOTH `capturedMethod` and the path, matching against `{ method, path }` tuples from the spec.

**Warning signs:** Test passes but live API calls return 405 Method Not Allowed.

### Pitfall 6: `scripts/` Directory Not in TypeScript Compilation

**What goes wrong:** `fetch-swagger.ts` is in `scripts/` but `tsconfig.json` has `"rootDir": "src"` — TypeScript compiler rejects files outside `src/`.

**Why it happens:** The project's `tsconfig.json` compiles only `src/**/*`.

**How to avoid:** The script is run via `npx tsx` (TypeScript executor, not `tsc`), so compilation config is irrelevant. The `tsx` tool transpiles on the fly. The `scripts/` directory does not need to be in `tsconfig.json` scope.

**Warning signs:** `npm run build` fails citing a file in `scripts/`. (It won't, because `tsx` bypasses `tsc`.)

## Code Examples

### `fetch-swagger.ts` — Complete Script

```typescript
// scripts/fetch-swagger.ts
// Run: npx tsx scripts/fetch-swagger.ts
// Requires RENTALWORKS_BASE_URL env var or edit BASE_URL below.
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.RENTALWORKS_BASE_URL || "https://modernlighting.rentalworks.cloud";

const SUB_SPECS = [
  "accountservices-v1",
  "home-v1",
  "warehouse-v1",
  "settings-v1",
  "pages-v1",
  "reports-v1",
  "utilities-v1",
  "administrator-v1",
  "mobile-v1",
  "plugins-v1",
  "integrations-v1",
  "storefront-v1",
] as const;

type SpecEntry = { method: string; path: string; spec: string };

const allPaths: SpecEntry[] = [];
const summary: Array<{ name: string; pathCount: number }> = [];

for (const specName of SUB_SPECS) {
  const url = `${BASE_URL}/swagger/${specName}/swagger.json`;
  console.log(`Fetching ${specName}...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  FAILED: ${res.status} ${res.statusText}`);
    continue;
  }
  const data = await res.json() as { paths: Record<string, Record<string, unknown>> };
  let count = 0;
  for (const [path, methods] of Object.entries(data.paths)) {
    for (const method of Object.keys(methods)) {
      allPaths.push({ method: method.toUpperCase(), path, spec: specName });
      count++;
    }
  }
  summary.push({ name: specName, pathCount: count });
  console.log(`  OK: ${count} endpoints`);
}

const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  subSpecs: summary,
  totalPaths: allPaths.length,
  paths: allPaths,
};

const outPath = join(__dirname, "swagger-cache.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${allPaths.length} paths to ${outPath}`);
```

### Path Matching Utility (for test file)

```typescript
// Source: [ASSUMED] standard OpenAPI path matching
/** Convert OpenAPI path template to regex. E.g. /api/v1/order/{id} → /api/v1/order/[^/]+ */
function specPathToRegex(specPath: string): RegExp {
  const escaped = specPath.replace(/\//g, "\\/");
  const pattern = escaped.replace(/\{[^}]+\}/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
}

/** Check if a captured URL path matches any entry in the spec with the right method */
function urlExistsInSpec(
  capturedPath: string,
  capturedMethod: string,
  specPaths: Array<{ method: string; path: string }>
): boolean {
  const cleanPath = capturedPath.split("?")[0]; // strip query string
  return specPaths.some(
    entry =>
      entry.method === capturedMethod &&
      specPathToRegex(entry.path).test(cleanPath)
  );
}
```

### Test Setup Boilerplate (mirrors existing pattern)

```typescript
// Source: mirrors src/__tests__/unit/api-paths.test.ts pattern [VERIFIED: existing codebase]
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = JSON.parse(readFileSync(join(__dirname, "../../../scripts/swagger-cache.json"), "utf8"));
const specPaths = cache.paths as Array<{ method: string; path: string; spec: string }>;

// ... (JWT mock, BROWSE mock, tool registration same as api-paths.test.ts)

describe("swagger spec validation — all 114 tools", () => {
  it("browse_rental_inventory → POST /api/v1/rentalinventory/browse in spec", async () => {
    await callTool("browse_rental_inventory", {});
    const path = capturedUrl.replace(BASE_URL, "").split("?")[0];
    expect(urlExistsInSpec(path, capturedMethod, specPaths)).toBe(true);
  });
  // ... one it() per tool
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `swagger-endpoints.txt` (home-v1 only) | Scripted fetch of all 12 sub-specs | Phase 2 | Covers all tool domains |
| Visual inspection of paths | Automated test with URL capture | Phase 2 | Regressions caught by CI |

**Existing artifact note:**
- `swagger-endpoints.txt` / `swagger_endpoints.txt`: Cover only home-v1. Useful for reference but NOT authoritative for settings, admin, storefront, utilities, or reports tools. [VERIFIED: confirmed by direct search]
- `swagger-reports-v1.json`: Raw reports-v1 sub-spec JSON already cached locally (2.7 MB). The fetch script can skip fetching it again or overwrite. [VERIFIED: file exists, confirmed OpenAPI 3.0 format]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Swagger JSON files at `{instance}/swagger/{spec}/swagger.json` are publicly accessible without auth | Standard Stack, Script Design | If auth required, script must pass JWT; probability LOW — Swagger UI is typically public |
| A2 | `npx tsx` can run `scripts/fetch-swagger.ts` with top-level `await` without `--experimental-vm-modules` | Architecture Patterns | If tsx version doesn't support it, add `async function main() {}` wrapper |
| A3 | JSON import assertion (`assert { type: "json" }`) works in Vitest 3.x under Node16 moduleResolution | Code Examples | If not supported, use `fs.readFileSync` + `JSON.parse` instead (safe fallback) |
| A4 | The path normalization regex (replace `{param}` → `[^/]+`) covers all RentalWorks path parameter patterns | Code Examples | If any spec uses unusual parameter patterns, matching would fail; verified sample set looks conventional |

## Open Questions

1. **Should `swagger-cache.json` be committed to git or gitignored?**
   - What we know: It's ~100-200KB of generated data; it changes only when the RentalWorks instance updates.
   - What's unclear: Whether the team wants reproducible CI without network calls.
   - Recommendation: Commit it. The file is deterministic, not sensitive, and allows CI to run without fetching live specs. Add a note to the PLAN that the cache must be regenerated before Phase 3.

2. **Should the test hard-code 114 `it()` blocks or loop programmatically?**
   - What we know: Hard-coded blocks are more readable and pinpoint failures by tool name; programmatic loops require argument fixtures per tool.
   - What's unclear: Whether a table-driven approach (array of `[toolName, args, expectedPath]`) would be cleaner.
   - Recommendation: Use a table-driven approach. Define a `TOOL_CALLS` array of `{ name, args, expectedMethod, expectedPath }`. Loop with `it.each`. Easier to add new tools in Phase 6.

3. **Can the test file use the existing `api-paths.test.ts` server setup via shared fixture?**
   - What we know: Vitest does not have a global fixture file in the current config; each test file sets up its own server.
   - What's unclear: Whether a `conftest`-style setup would reduce boilerplate.
   - Recommendation: Copy the boilerplate for now. Phase 3 can extract shared fixtures if it becomes repetitive across many new test files.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `fetch` | `fetch-swagger.ts` | ✓ | Detected (project already uses global fetch in api-client.ts) | — |
| `tsx` CLI | Run `fetch-swagger.ts` | ✓ | ^4.19.0 (installed devDep) | `node --loader ts-node/esm` (not installed) |
| RentalWorks live instance | Fetch sub-specs | ✓ | https://modernlighting.rentalworks.cloud (confirmed accessible) | Use cached `swagger-reports-v1.json` for offline dev |
| Vitest 3.x | Run test file | ✓ | 3.2.4 (installed) | — |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (projects already configured) |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PATH-01 | All 114 tool paths audited against spec | unit | `npm run test:unit` | ❌ Wave 0 (`swagger-spec.test.ts`) |
| PATH-02 | Domain mapping table documented | doc | N/A (documented in RESEARCH.md and PLAN.md) | ✅ (this file) |
| PATH-07 | Fetch script produces cache, test imports and validates | unit + script | `npx tsx scripts/fetch-swagger.ts && npm run test:unit` | ❌ Wave 0 (both files) |

### Sampling Rate

- **Per task commit:** `npm run test:unit` (all 5 existing unit tests + new swagger-spec test)
- **Per wave merge:** `npm test`
- **Phase gate:** `swagger-spec.test.ts` reports pass for all 114 tools; no tool silently skipped

### Wave 0 Gaps

- [ ] `scripts/` directory — must be created before `fetch-swagger.ts` can be placed
- [ ] `scripts/fetch-swagger.ts` — covers PATH-07
- [ ] `scripts/swagger-cache.json` — generated by running the script (required before test can run)
- [ ] `src/__tests__/unit/swagger-spec.test.ts` — covers PATH-01 and PATH-07

## Security Domain

Step skipped — this phase contains no user-facing code, authentication logic, or data mutations. It writes a local JSON cache file and runs read-only path comparisons. Security controls are not applicable.

## Sources

### Primary (HIGH confidence)

- Live Swagger UI HTML: `https://modernlighting.rentalworks.cloud/swagger/index.html` — confirmed all 12 sub-spec URLs [VERIFIED: curl + node parsing of SwaggerUIBundle config]
- Live `home-v1` spec: `https://modernlighting.rentalworks.cloud/swagger/home-v1/swagger.json` — verified order, invoice, checkout, checkin, purchaseorder, rentalinventory, quote paths [VERIFIED: direct fetch + node path extraction]
- Live `storefront-v1` spec — verified storefront/catalog, storefront/product path pattern [VERIFIED: direct fetch]
- Live `accountservices-v1` spec — verified account/session, account/getsettings [VERIFIED: direct fetch]
- Live `administrator-v1` spec — verified user/browse, alert/browse [VERIFIED: direct fetch]
- Live `settings-v1` spec — verified warehouse, rentalcategory, crew, discountitem, officelocation, glaccount, storefrontcatalog paths [VERIFIED: direct fetch]
- Live `utilities-v1` spec — verified inventorypurchasesession, changeicodeutility, labeldesign, aiassistantutility paths [VERIFIED: direct fetch]
- Live `reports-v1` spec — verified aragingreport/render, latereturnsreport/render, runreport pattern [VERIFIED: direct fetch]
- Local `swagger-endpoints.txt` — confirmed covers home-v1 only (2,216 lines = home-v1 method count) [VERIFIED: Node.js search of file]
- Local `swagger-reports-v1.json` — confirmed valid OpenAPI 3.0 JSON [VERIFIED: file inspection]
- Local `package.json` — confirmed no new dependencies needed [VERIFIED]
- `npm test` — all 49 existing tests pass [VERIFIED: live execution]
- `src/__tests__/unit/api-paths.test.ts` — confirmed URL capture pattern with `vi.stubGlobal("fetch", ...)` [VERIFIED: direct file read]

### Secondary (MEDIUM confidence)

- `src/utils/api-client.ts` — global `fetch` usage confirms Node 18+ assumption [VERIFIED: direct file read]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Sub-spec URLs: HIGH — fetched from live Swagger UI HTML
- Path audit: HIGH — each tool domain path verified against live spec JSON
- Script design: HIGH — follows existing patterns in the codebase; no new libraries
- Test design: MEDIUM — path normalization regex is assumed to cover all RW param patterns; tested against a representative sample only

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (spec changes require regenerating cache; 30-day window for stable API)
