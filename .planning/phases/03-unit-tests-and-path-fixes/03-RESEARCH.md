# Phase 3: Unit Tests and Path Fixes - Research

**Researched:** 2026-04-09
**Domain:** Vitest unit testing patterns, RentalWorks tool path validation
**Confidence:** HIGH

## Summary

Phase 3 has two distinct work streams: (1) fix one confirmed path bug in `storefront.ts`, and (2) add request-body assertions to unit tests for four domains (billing, admin, customers, settings) and repair seven `it()` blocks in `request-bodies.test.ts` that are missing `capturedUrl` assertions.

The swagger-spec.test.ts built in Phase 2 already covers all 114 tools with combined path+method validation via `urlExistsInSpec()`. That test currently passes cleanly with zero mismatches. The checkout/checkin and invoice lifecycle paths flagged in PATH-05 and PATH-06 are already correct and already verified by the existing test suite. PATH-05's mention of "warehouse-v1" in REQUIREMENTS.md is incorrect — those endpoints live in home-v1; the paths themselves are right.

The only source-code path fix (PATH-03/PATH-04) is `storefront_browse_categories`, which calls `POST /api/v1/storefrontcatalog/browse` but should call `GET /api/v1/storefront/catalog/{id}/categorytree`. The tool's description promises customer-facing category browsing; the current implementation points at an admin catalog management endpoint instead.

**Primary recommendation:** Fix one path bug, add body assertions to four domain test files, repair seven existing it() blocks, update the swagger-spec.test.ts describe label and the corresponding storefront test.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — discuss phase skipped.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PATH-03 | All incorrect API paths fixed to match Swagger spec | One confirmed bug: storefront_browse_categories. All other paths already pass swagger-spec.test.ts |
| PATH-04 | Storefront category browsing path corrected to match storefront-v1 spec | Confirmed: must change to GET /api/v1/storefront/catalog/{catalogId}/categorytree |
| PATH-05 | Checkout/checkin paths verified against spec | All checkout/checkin paths correct (home-v1, not warehouse-v1 as stated in req). swagger-spec.test.ts passes |
| PATH-06 | Invoice lifecycle paths verified against home-v1 spec | approve/process/void use /invoice/{id}/approve etc. — all match spec and pass |
| TEST-01 | Path + method + body unit tests for all billing domain tools (13 tools) | swagger-spec.test.ts covers path+method; body assertions missing for billing |
| TEST-02 | Path + method + body unit tests for all admin domain tools (5 tools) | swagger-spec.test.ts covers path+method; body assertions missing for admin |
| TEST-03 | Path + method + body unit tests for all customer domain tools (13 tools) | swagger-spec.test.ts covers path+method; body assertions missing for customers |
| TEST-04 | Path + method + body unit tests for all settings domain tools (14 tools) | swagger-spec.test.ts covers path+method; body assertions missing for settings |
| TEST-05 | Audit all it() blocks — every block must assert capturedUrl AND capturedMethod | request-bodies.test.ts has 7 it() blocks missing capturedUrl |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^3.1.0 | Test runner | Already in project, all existing tests use it |
| @modelcontextprotocol/sdk | ^1.12.1 | InMemoryTransport + McpServer for test harness | Already used in all 6 existing test files |

No new dependencies required for this phase.

**Version verification:** [VERIFIED: package.json] Vitest 3.1.0 already installed. MCP SDK 1.12.1 already installed.

## Architecture Patterns

### Existing Test File Structure

All unit tests live in `src/__tests__/unit/`. The phase adds assertions to existing files and creates new domain test files following the established pattern.

```
src/__tests__/unit/
├── api-paths.test.ts          # Explicit capturedUrl + capturedMethod for subset
├── request-bodies.test.ts     # capturedBody assertions (needs capturedUrl added)
├── swagger-spec.test.ts       # All 114 tools via urlExistsInSpec (path+method)
├── tool-helpers.test.ts       # Pure unit tests for helper functions
├── tool-registration.test.ts  # Tool count and schema validation
├── removed-tools.test.ts      # Regression guard for accidentally re-added tools
├── billing-tools.test.ts      # NEW: body assertions for billing domain
├── admin-tools.test.ts        # NEW: body assertions for admin domain
├── customer-tools.test.ts     # NEW: body assertions for customers domain
└── settings-tools.test.ts     # NEW: body assertions for settings domain
```

### Pattern 1: Standard Test Harness (used by all it()-level tests that call tools)

Every test file that calls tools uses the same setup: InMemoryTransport linking a real McpServer to a real MCP Client, with `vi.stubGlobal("fetch", ...)` to intercept HTTP calls.

```typescript
// Source: src/__tests__/unit/api-paths.test.ts (verified in codebase)

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resetClient } from "../../utils/api-client.js";

let client: Client;
let capturedUrl: string;
let capturedMethod: string;
let capturedBody: any;

const JWT_RESPONSE = JSON.stringify({
  statuscode: 200, statusmessage: "OK",
  access_token: "test-token", webusersid: "u1", usersid: "u2", fullname: "Test",
});

const BROWSE_RESPONSE = JSON.stringify({
  TotalRows: 0, PageNo: 1, PageSize: 25, TotalPages: 0, Rows: [],
});

const ENTITY_RESPONSE = JSON.stringify({ Id: "123" });

beforeAll(async () => {
  process.env.RENTALWORKS_USERNAME = "test";
  process.env.RENTALWORKS_PASSWORD = "test";
  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerXxxTools(server);                          // only the domain under test
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(clientTransport);
});

beforeEach(() => {
  resetClient();
  capturedUrl = "";
  capturedMethod = "";
  capturedBody = null;
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.endsWith("/api/v1/jwt")) {
      return new Response(JWT_RESPONSE, { status: 200 });
    }
    capturedUrl = urlStr;
    capturedMethod = init?.method || "GET";
    if (init?.body) { capturedBody = JSON.parse(init.body as string); }
    const isBrowse = urlStr.includes("/browse");
    return new Response(isBrowse ? BROWSE_RESPONSE : ENTITY_RESPONSE, { status: 200 });
  }));
});

afterAll(() => { vi.unstubAllGlobals(); });

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}
```

### Pattern 2: The Three Assertions (for domain test files)

Every `it()` block in a new domain test file MUST assert all three:

```typescript
// Source: established pattern from api-paths.test.ts + request-bodies.test.ts

it("create_invoice_from_order → POST .../order/createinvoice with { OrderId }", async () => {
  await callTool("create_invoice_from_order", { orderId: "O1" });
  expect(capturedMethod).toBe("POST");
  expect(capturedUrl).toContain("/api/v1/order/createinvoice");
  expect(capturedBody).toEqual({ OrderId: "O1" });
});
```

For GET tools with no body, assert method + url only:

```typescript
it("get_invoice → GET .../invoice/{id}", async () => {
  await callTool("get_invoice", { invoiceId: "INV1" });
  expect(capturedMethod).toBe("GET");
  expect(capturedUrl).toContain("/api/v1/invoice/INV1");
});
```

For URL-action tools (approve/process/void where ID is in path, no body):

```typescript
it("approve_invoice → POST .../invoice/{id}/approve", async () => {
  await callTool("approve_invoice", { invoiceId: "INV1" });
  expect(capturedMethod).toBe("POST");
  expect(capturedUrl).toContain("/api/v1/invoice/INV1/approve");
});
```

### Pattern 3: TEST-05 Fix — Adding capturedUrl to request-bodies.test.ts

The 7 existing it() blocks in `request-bodies.test.ts` capture body but not URL. Add `expect(capturedUrl).toContain(...)` to each:

```typescript
// Before (shape-only — violates TEST-05):
it("create_invoice_from_order sends { OrderId }", async () => {
  await callTool("create_invoice_from_order", { orderId: "O1" });
  expect(capturedBody).toEqual({ OrderId: "O1" });
});

// After (all three assertions):
it("create_invoice_from_order sends { OrderId } to POST .../order/createinvoice", async () => {
  await callTool("create_invoice_from_order", { orderId: "O1" });
  expect(capturedMethod).toBe("POST");
  expect(capturedUrl).toContain("/api/v1/order/createinvoice");
  expect(capturedBody).toEqual({ OrderId: "O1" });
});
```

### Pattern 4: PATH-04 Fix — storefront_browse_categories

**Current (wrong):**
```typescript
// src/tools/storefront.ts
server.tool(
  "storefront_browse_categories",
  "Browse the storefront catalog categories available to customers. ...",
  { page: z.coerce.number().optional().default(1), pageSize: z.coerce.number().optional().default(50) },
  withErrorHandling(async (args) => {
    const data = await client.post("/api/v1/storefrontcatalog/browse", { pageno: page, pagesize: pageSize });
    ...
  })
);
```

**Fixed (correct spec path):**
```typescript
// Spec: GET /api/v1/storefront/catalog/{catalogid}/categorytree (storefront-v1)
server.tool(
  "storefront_browse_categories",
  "Browse the category tree for a storefront catalog. Returns the hierarchical categories customers see.",
  { catalogId: z.string().describe("The storefront catalog ID") },
  withErrorHandling(async ({ catalogId }) => {
    const data = await client.get(`/api/v1/storefront/catalog/${catalogId}/categorytree`);
    ...
  })
);
```

This changes: POST → GET, adds required `catalogId` param, removes pagination params, changes endpoint from admin storefrontcatalog to customer-facing storefront.

**Also update swagger-spec.test.ts** (storefront describe block):
```typescript
// Before:
it("storefront_browse_categories → POST /api/v1/storefrontcatalog/browse", async () => {
  await callTool("storefront_browse_categories", {});

// After:
it("storefront_browse_categories → GET /api/v1/storefront/catalog/{id}/categorytree", async () => {
  await callTool("storefront_browse_categories", { catalogId: "CAT1" });
```

### Anti-Patterns to Avoid
- **Shape-only assertions:** Never write an `it()` block that only checks body shape without also asserting `capturedUrl` and `capturedMethod`. TEST-05 is an audit requirement against this.
- **Catching tools in wrong domain file:** Each new domain test file should only `register{Domain}Tools` — not all 11 domains. This keeps test isolation and startup time low.
- **Testing browse request body exhaustively:** Browse body shape is already covered in `tool-helpers.test.ts` via `buildBrowseRequest`. New domain tests need only verify the POST body is non-null and contains expected fields — not the entire browse schema.
- **Re-using capturedBody across tests without reset:** `beforeEach` must reset `capturedBody = null` to prevent cross-test contamination.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP tool test harness | Custom mock server | `InMemoryTransport` from MCP SDK | Already proven in 6 test files; handles protocol correctly |
| API path matching | Custom regex or string compare | `expect(capturedUrl).toContain(path)` | Simple, readable, sufficient for path verification |
| Swagger validation | Re-implement spec loading | Import swagger-cache.json as done in swagger-spec.test.ts | Cache already built; no need to re-fetch |

## Common Pitfalls

### Pitfall 1: capturedUrl not set when tool errors silently
**What goes wrong:** A tool fails internally (e.g., withErrorHandling swallows error) but fetch was never called. `capturedUrl` stays empty string. `expect(capturedUrl).toContain(...)` fails misleadingly.
**Why it happens:** `withErrorHandling` wraps errors and returns user-friendly text without re-throwing. The test sees a successful MCP response.
**How to avoid:** In tests for withErrorHandling-wrapped tools, pass valid-enough args so the handler reaches the fetch call. The mock always returns 200.
**Warning signs:** Test fails with `expect("").toContain("/api/v1/...")` — indicates the tool returned before reaching the HTTP call.

### Pitfall 2: browse request body assertions over-specify
**What goes wrong:** Test asserts `capturedBody` equals the exact browse object `{ pageno: 1, pagesize: 25, orderby: "", orderbydirection: "asc" }`. Brittle when defaults change.
**Why it happens:** Copying request-bodies.test.ts pattern without thinking about what matters.
**How to avoid:** For browse tools, only verify the HTTP call was made with POST method and correct URL. Body shape is already tested in tool-helpers.test.ts.

### Pitfall 3: storefront_browse_categories — tool count stays at 114
**What goes wrong:** Changing the tool signature (removing page/pageSize, adding catalogId) doesn't change tool count but changes the tool's argument shape. The tool-registration.test.ts `it("registers the expected number of tools", () => { expect(tools.length).toBe(114); })` still passes.
**Why it happens:** We're replacing the tool's implementation, not removing/adding a tool.
**How to avoid:** After fixing the path, verify the tool is still registered and the new `catalogId` param appears in the tool's inputSchema.

### Pitfall 4: swagger-spec.test.ts "storefront (3 tools)" test breaks until both changes land
**What goes wrong:** Fixing storefront_browse_categories tool path but not updating the swagger-spec.test.ts will cause that test to fail (it calls the tool with no args, but new tool requires catalogId).
**Why it happens:** The tool and its swagger-spec test must be updated atomically.
**How to avoid:** Fix tool source and swagger-spec.test.ts in the same task.

### Pitfall 5: PATH-05 confusion — checkout/checkin NOT in warehouse-v1
**What goes wrong:** Treating PATH-05 as requiring code changes to checkout/checkin paths.
**Why it happens:** REQUIREMENTS.md says "warehouse-v1 spec" but the swagger cache shows checkout/checkin live in home-v1. All paths already pass.
**How to avoid:** PATH-05 is verification-only. Document the correct spec (home-v1) in a comment near the tests. No source code changes needed.

## Code Examples

### browse body for POST tools (established pattern)
```typescript
// Source: src/tools/billing.ts (verified)
// browse_invoices sends buildBrowseRequest() result as POST body
const request = buildBrowseRequest(args);
const data = await client.post("/api/v1/invoice/browse", request);
// → body is { pageno, pagesize, orderby, orderbydirection, [search fields] }
```

### approve/process/void — ID in URL, no body
```typescript
// Source: src/tools/billing.ts (verified)
// approve_invoice: POST /api/v1/invoice/{invoiceId}/approve — no body arg
const data = await client.post(`/api/v1/invoice/${invoiceId}/approve`);
```

### create_billing_estimate — explicit body fields
```typescript
// Source: src/tools/billing.ts (verified)
// create_billing_estimate: POST /api/v1/billing/createestimate
const data = await client.post("/api/v1/billing/createestimate", args);
// args = { OrderId, BillingStartDate?, BillingEndDate? }
```

### Customer tools with body
```typescript
// Source: src/tools/customers.ts (verified)
// create_customer: POST /api/v1/customer with full args object
const data = await client.post("/api/v1/customer", args);
// update_customer: PUT /api/v1/customer/{CustomerId} with updates spread
const data = await client.put(`/api/v1/customer/${CustomerId}`, updates);
```

## Inventory of Existing Test Coverage (TEST-05 Audit)

| File | it() count | capturedUrl | capturedMethod | capturedBody | Status |
|------|-----------|-------------|----------------|--------------|--------|
| api-paths.test.ts | 18 | ✓ all | ✓ all | — | OK |
| request-bodies.test.ts | 7 | ✗ none | partial (1/7) | ✓ all | NEEDS FIX |
| swagger-spec.test.ts | 116 (114 tools + 2 meta) | via urlExistsInSpec | via urlExistsInSpec | — | OK |
| tool-helpers.test.ts | pure unit | n/a | n/a | n/a | OK |
| tool-registration.test.ts | 5 | n/a | n/a | n/a | OK |
| removed-tools.test.ts | 3 | n/a | n/a | n/a | OK |

**Files needing work:** Only `request-bodies.test.ts` (7 it() blocks need `capturedUrl` added).

## Domain Tool Inventory (for TEST-01 through TEST-04)

### Billing — 13 tools (TEST-01)
| Tool | HTTP | Path | Has Body? | Body Fields |
|------|------|------|-----------|-------------|
| browse_invoices | POST | /api/v1/invoice/browse | browse request | pageno, pagesize, etc. |
| get_invoice | GET | /api/v1/invoice/{id} | — | — |
| create_invoice | POST | /api/v1/invoice | explicit | DealId, OrderId, CustomerId, etc. |
| approve_invoice | POST | /api/v1/invoice/{id}/approve | — | — |
| process_invoice | POST | /api/v1/invoice/{id}/process | — | — |
| void_invoice | POST | /api/v1/invoice/{id}/void | — | — |
| browse_billing | POST | /api/v1/billing/browse | browse request | pageno, pagesize, etc. |
| create_billing_estimate | POST | /api/v1/billing/createestimate | explicit | OrderId, BillingStartDate, BillingEndDate |
| browse_billing_worksheets | POST | /api/v1/billingworksheet/browse | browse request | — |
| browse_receipts | POST | /api/v1/receipt/browse | browse request | — |
| get_receipt | GET | /api/v1/receipt/{id} | — | — |
| browse_vendor_invoices | POST | /api/v1/vendorinvoice/browse | browse request | — |
| get_vendor_invoice | GET | /api/v1/vendorinvoice/{id} | — | — |

### Admin — 5 tools (TEST-02)
| Tool | HTTP | Path | Has Body? | Body Fields |
|------|------|------|-----------|-------------|
| get_session | GET | /api/v1/account/session | — | — |
| get_account_settings | POST | /api/v1/account/getsettings | — (no args) | — |
| browse_users | POST | /api/v1/user/browse | browse request | pageno, pagesize, etc. |
| get_user | GET | /api/v1/user/{id} | — | — |
| browse_alerts | POST | /api/v1/alert/browse | browse request | — |

### Customers — 13 tools (TEST-03)
| Tool | HTTP | Path | Has Body? |
|------|------|------|-----------|
| browse_customers | POST | /api/v1/customer/browse | browse request |
| get_customer | GET | /api/v1/customer/{id} | — |
| create_customer | POST | /api/v1/customer | explicit (Customer, Address1, etc.) |
| update_customer | PUT | /api/v1/customer/{id} | explicit updates |
| browse_contacts | POST | /api/v1/contact/browse | browse request |
| get_contact | GET | /api/v1/contact/{id} | — |
| create_contact | POST | /api/v1/contact | explicit (FirstName, LastName, etc.) |
| browse_deals | POST | /api/v1/deal/browse | browse request |
| get_deal | GET | /api/v1/deal/{id} | — |
| create_deal | POST | /api/v1/deal | explicit (Deal, CustomerId, etc.) |
| update_deal | PUT | /api/v1/deal/{id} | explicit updates |
| browse_projects | POST | /api/v1/project/browse | browse request |
| get_project | GET | /api/v1/project/{id} | — |

### Settings — 14 tools (TEST-04)
| Tool | HTTP | Path | Has Body? |
|------|------|------|-----------|
| browse_warehouses | POST | /api/v1/warehouse/browse | browse request |
| get_warehouse | GET | /api/v1/warehouse/{id} | — |
| browse_rental_categories | POST | /api/v1/rentalcategory/browse | browse request |
| browse_sales_categories | POST | /api/v1/salescategory/browse | browse request |
| browse_order_types | POST | /api/v1/ordertype/browse | browse request |
| browse_crews | POST | /api/v1/crew/browse | browse request |
| get_crew | GET | /api/v1/crew/{id} | — |
| browse_discount_items | POST | /api/v1/discountitem/browse | browse request |
| browse_templates | POST | /api/v1/template/browse | browse request |
| browse_labor_rates | POST | /api/v1/laborrate/browse | browse request |
| get_default_settings | GET | /api/v1/defaultsettings | — |
| browse_office_locations | POST | /api/v1/officelocation/browse | browse request |
| browse_gl_accounts | POST | /api/v1/glaccount/browse | browse request |
| browse_settings_entity | POST | /api/v1/{entityName}/browse | browse request (dynamic entity) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PATH-03 | storefront_browse_categories uses correct path | unit | `npm test -- --reporter=dot` | Needs update to swagger-spec.test.ts |
| PATH-04 | Same as PATH-03 | unit | `npm test -- --reporter=dot` | Needs update |
| PATH-05 | checkout/checkin paths correct | unit | `npm test -- --reporter=dot` | ✅ swagger-spec.test.ts (already passing) |
| PATH-06 | invoice lifecycle paths correct | unit | `npm test -- --reporter=dot` | ✅ swagger-spec.test.ts (already passing) |
| TEST-01 | Billing path+method+body assertions | unit | `npm test -- --reporter=dot` | ❌ Wave 0: billing-tools.test.ts |
| TEST-02 | Admin path+method+body assertions | unit | `npm test -- --reporter=dot` | ❌ Wave 0: admin-tools.test.ts |
| TEST-03 | Customer path+method+body assertions | unit | `npm test -- --reporter=dot` | ❌ Wave 0: customer-tools.test.ts |
| TEST-04 | Settings path+method+body assertions | unit | `npm test -- --reporter=dot` | ❌ Wave 0: settings-tools.test.ts |
| TEST-05 | All it() blocks assert capturedUrl + capturedMethod | unit | `npm test -- --reporter=dot` | Needs update to request-bodies.test.ts |

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=dot`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (164 + new tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/unit/billing-tools.test.ts` — covers TEST-01 (13 tools)
- [ ] `src/__tests__/unit/admin-tools.test.ts` — covers TEST-02 (5 tools)
- [ ] `src/__tests__/unit/customer-tools.test.ts` — covers TEST-03 (13 tools)
- [ ] `src/__tests__/unit/settings-tools.test.ts` — covers TEST-04 (14 tools)

## Security Domain

Security enforcement applies (no explicit `false` in config). This phase only modifies test files and one tool implementation (changing endpoint path, not authentication or data handling). No new security surface is introduced.

| ASVS Category | Applies | Note |
|---------------|---------|------|
| V2 Authentication | no | Tests mock JWT, no real auth changes |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | no | Zod schemas unchanged except storefront tool parameter rename |
| V6 Cryptography | no | No crypto involved |

The only source change (storefront_browse_categories path fix) does not affect auth, input validation, or data handling — it corrects an endpoint path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `storefront/catalog/{catalogid}/categorytree` is the correct customer-facing category endpoint | PATH-04 | Path fix would be incorrect; low risk since spec is verified in swagger-cache.json |
| A2 | browse request body assertions can be tested lightly (not exhaustively) for TEST-01 through TEST-04 because body shape is already tested in tool-helpers.test.ts | TEST-01-04 | Requirements might expect exhaustive body assertions; low risk since tool-helpers.test.ts is thorough |
| A3 | checkout/checkin paths are confirmed correct and PATH-05 is verification-only with no source changes needed | PATH-05 | If the spec actually specifies different paths, there would be source changes needed |

## Open Questions

1. **swagger-spec.test.ts uses urlExistsInSpec — does it satisfy TEST-01 through TEST-04?**
   - What we know: swagger-spec.test.ts covers all 114 tools with path+method validation. TEST-01-04 say "path + method + body unit tests."
   - What's unclear: Whether "body" is required for ALL tools, or only tools that actually send a meaningful body.
   - Recommendation: Create four new test files covering path+method+body for every tool. For GET tools and body-less POSTs, assert path+method only. This unambiguously satisfies the requirement.

2. **storefront_browse_categories tool schema change — does it affect total tool count?**
   - What we know: Tool count stays at 114 (we're replacing implementation, not adding/removing).
   - What's unclear: Nothing — tool-registration.test.ts will still pass.
   - Recommendation: No action needed beyond fixing source and tests.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure test + source code changes, no network calls, databases, or CLI tools required beyond npm).

## Sources

### Primary (HIGH confidence)
- `src/__tests__/unit/swagger-spec.test.ts` — verified all 114 tools, path/method status
- `src/__tests__/unit/api-paths.test.ts` — verified existing pattern for capturedUrl + capturedMethod
- `src/__tests__/unit/request-bodies.test.ts` — confirmed 7 it() blocks missing capturedUrl
- `scripts/swagger-cache.json` — verified storefront/catalog/{catalogid}/categorytree, invoice lifecycle paths, checkout/checkin in home-v1
- `src/tools/storefront.ts` — confirmed storefrontcatalog/browse bug
- `src/tools/billing.ts`, `admin.ts`, `customers.ts`, `settings.ts` — confirmed tool counts and HTTP methods

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md PATH-05 references warehouse-v1 for checkout/checkin, but swagger cache confirms home-v1. The paths are correct; only the spec attribution in the requirement is wrong.

## Metadata

**Confidence breakdown:**
- Path fix (PATH-03/04): HIGH — confirmed by swagger cache comparison
- Checkout/checkin (PATH-05): HIGH — swagger-spec.test.ts passes, spec confirmed
- Invoice lifecycle (PATH-06): HIGH — swagger-spec.test.ts passes, spec confirmed
- Test patterns: HIGH — directly observed from 6 existing test files
- New test file scope: HIGH — domain inventories verified from source files

**Research date:** 2026-04-09
**Valid until:** Stable — dependent on tool implementations which are not changing this phase
