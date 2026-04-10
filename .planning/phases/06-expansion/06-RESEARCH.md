# Phase 6: Expansion - Research

**Researched:** 2026-04-09
**Domain:** MCP tool authoring — new domain file (address), utilities extension (change order status), unit tests, integration smoke tests
**Confidence:** HIGH

## Summary

Phase 6 adds two categories of new MCP tools: (1) address management CRUD matching the home-v1 Swagger spec, and (2) a change order status utility tool matching the utilities-v1 Swagger spec. All new tools must follow the established patterns validated in earlier phases — domain file with `register{Domain}Tools()`, `browseSchema` + helpers for browse operations, PascalCase API fields, and `withErrorHandling()` wrappers where appropriate.

The Swagger spec paths for both targets have been verified in `scripts/swagger-cache.json`. Address CRUD lives at `/api/v1/address` (home-v1) with standard browse/get/create/update/delete operations. Change order status uses a non-CRUD action pattern at `/api/v1/changeorderstatus/changestatus` (utilities-v1).

Unit tests follow the established `capturedUrl`/`capturedMethod`/`capturedBody` pattern using `InMemoryTransport` + `vi.stubGlobal("fetch", ...)`. Integration smoke tests extend `live-api.test.ts` using `describe.skipIf(!isLiveEnv)` and are read-only (browse + get-by-ID only; no create/update/delete calls against the live instance).

**Primary recommendation:** Create `src/tools/addresses.ts` for address CRUD, add `change_order_status` to `src/tools/utilities.ts`, create `src/__tests__/unit/address-tools.test.ts`, extend `src/__tests__/integration/live-api.test.ts` with address browse smoke test, and update `swagger-spec.test.ts` tool count assertion.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPN-01 | Address management tools (browse, get, create, update, delete) — home-v1 API | Paths verified in swagger-cache.json: POST /api/v1/address/browse, GET /api/v1/address/{id}, POST /api/v1/address, PUT /api/v1/address/{id}, DELETE /api/v1/address/{id} |
| EXPN-02 | Change order status utility tool — utilities-v1 API | Path verified in swagger-cache.json: POST /api/v1/changeorderstatus/changestatus |
| EXPN-03 | Unit tests for all new tools following established patterns | Pattern fully documented — capturedUrl/capturedMethod/capturedBody via vi.stubGlobal("fetch") |
| EXPN-04 | Integration smoke tests for new tools (read-only) | Pattern fully documented — extend live-api.test.ts, browse address only |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | ^1.12.1 | MCP server + InMemoryTransport in tests | Already in use across all 11 domain files |
| `zod` | ^4.3.6 | Schema validation for tool inputs | Already in dependencies |
| `vitest` | ^3.1.0 | Test runner, vi.stubGlobal, InMemoryTransport | Already in devDependencies |

[VERIFIED: package.json in codebase]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `RentalWorksClient` helpers | n/a (internal) | browse/getById/create/update/remove methods | Use directly in tool handlers — already encapsulates path patterns |
| `browseSchema` + `buildBrowseRequest()` | n/a (internal) | Standard browse input schema + request builder | Use for every browse operation |
| `formatBrowseResult()` / `formatEntity()` | n/a (internal) | Standard output formatters | Use for browse and get-by-ID responses |
| `withErrorHandling()` | n/a (internal) | Wraps handler to catch known RW server errors | Use for mutation operations (create/update/delete) |

[VERIFIED: src/utils/tool-helpers.ts, src/utils/api-client.ts]

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

New files created by this phase:
```
src/
├── tools/
│   ├── addresses.ts          # NEW: address management CRUD (EXPN-01)
│   └── utilities.ts          # MODIFIED: add change_order_status tool (EXPN-02)
├── index.ts                  # MODIFIED: import + call registerAddressTools
src/__tests__/
├── unit/
│   ├── address-tools.test.ts  # NEW: unit tests (EXPN-03)
│   └── swagger-spec.test.ts   # MODIFIED: update tool count + add address/changeorderstatus tests
└── integration/
    └── live-api.test.ts       # MODIFIED: add address browse smoke test (EXPN-04)
```

### Pattern 1: Browse + CRUD Domain File

**What:** A domain file exports `register{Domain}Tools(server: McpServer)` that calls `server.tool()` for each tool. Browse operations use `browseSchema` + `buildBrowseRequest()` + `formatBrowseResult()`. Entity reads use `client.get()` + `formatEntity()`. Mutations use `client.post()`/`client.put()`/`client.delete()`.

**When to use:** Any new entity with standard CRUD.

**Example (from src/tools/customers.ts):**
```typescript
// [VERIFIED: src/tools/customers.ts]
export function registerCustomerTools(server: McpServer) {
  server.tool(
    "browse_addresses",
    "Search and browse address records.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/address/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  server.tool(
    "get_address",
    "Get full details of a specific address.",
    { addressId: z.string().describe("The address ID") },
    async ({ addressId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/address/${addressId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  server.tool(
    "create_address",
    "Create a new address record.",
    {
      Address1: z.string().describe("Street address line 1"),
      // ... other fields
    },
    async (args) => {
      const client = getClient();
      const data = await client.post("/api/v1/address", args);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  server.tool(
    "update_address",
    "Update an existing address.",
    { AddressId: z.string().describe("The address ID"), Address1: z.string().optional() },
    async ({ AddressId, ...updates }) => {
      const client = getClient();
      const data = await client.put(`/api/v1/address/${AddressId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  server.tool(
    "delete_address",
    "Delete an address record.",
    { addressId: z.string().describe("The address ID to delete") },
    async ({ addressId }) => {
      const client = getClient();
      await client.delete(`/api/v1/address/${addressId}`);
      return { content: [{ type: "text", text: `Address ${addressId} deleted.` }] };
    }
  );
}
```

### Pattern 2: Utility Action Tool (non-CRUD POST)

**What:** A single POST to a custom action endpoint. Body contains entity ID(s) and action parameters. Uses `JSON.stringify(data, null, 2)` for raw output since there is no standardized response shape.

**When to use:** Any utility endpoint that performs an action rather than CRUD.

**Example (from src/tools/utilities.ts — change_icode pattern):**
```typescript
// [VERIFIED: src/tools/utilities.ts]
server.tool(
  "change_order_status",
  "Change the status of an order using the change order status utility.",
  {
    OrderId: z.string().describe("The order ID to change status for"),
    NewStatusId: z.string().describe("The new order status ID"),
  },
  async (args) => {
    const client = getClient();
    const data = await client.post("/api/v1/changeorderstatus/changestatus", args);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);
```

### Pattern 3: Unit Test File (capturedUrl/capturedMethod/capturedBody)

**What:** Uses `InMemoryTransport` to connect a real MCP server/client pair. Stubs `fetch` globally to capture URL, method, and body. Asserts exact path + method + body shape for each tool.

**When to use:** All new tools require this pattern (EXPN-03).

**Example (from src/__tests__/unit/customer-tools.test.ts):**
```typescript
// [VERIFIED: src/__tests__/unit/customer-tools.test.ts]
beforeEach(() => {
  resetClient();
  capturedUrl = "";
  capturedMethod = "";
  capturedBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/api/v1/jwt")) {
        return new Response(JWT_RESPONSE, { status: 200 });
      }
      capturedUrl = urlStr;
      capturedMethod = init?.method || "GET";
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return new Response(
        urlStr.includes("/browse") ? BROWSE_RESPONSE : ENTITY_RESPONSE,
        { status: 200 }
      );
    })
  );
});

it("browse_addresses → POST /api/v1/address/browse", async () => {
  await callTool("browse_addresses");
  expect(capturedMethod).toBe("POST");
  expect(capturedUrl).toContain("/api/v1/address/browse");
  expect(capturedBody).not.toBeNull();
});

it("create_address → POST /api/v1/address with body", async () => {
  await callTool("create_address", { Address1: "123 Main St" });
  expect(capturedMethod).toBe("POST");
  expect(capturedUrl).toMatch(/\/api\/v1\/address$/);
  expect(capturedBody).toEqual(expect.objectContaining({ Address1: "123 Main St" }));
});
```

### Pattern 4: Integration Smoke Test (read-only browse)

**What:** Extends `src/__tests__/integration/live-api.test.ts` with a new `it()` block inside `describe.skipIf(!isLiveEnv)`. Calls `client.browse()` and asserts response shape. Never calls create/update/delete.

**When to use:** Read-capable tools only — browse and get-by-ID (EXPN-04). The `change_order_status` utility (mutation) must NOT have integration tests per CLAUDE.md constraint.

**Example (from src/__tests__/integration/live-api.test.ts):**
```typescript
// [VERIFIED: src/__tests__/integration/live-api.test.ts]
it("browses address — valid shape", async () => {
  const result = await client.browse<Record<string, unknown>>("address", { pagesize: 5 });
  expect(result).toHaveProperty("TotalRows");
  expect(result).toHaveProperty("Rows");
  expect(Array.isArray(result.Rows)).toBe(true);
  expect(typeof result.TotalRows).toBe("number");
}, 10000);
```

### Anti-Patterns to Avoid

- **New file for utilities:** Do NOT create a new domain file for `change_order_status`. Add it to the existing `src/tools/utilities.ts` following the same pattern as `change_icode`.
- **Integration test for mutations:** Do NOT write integration tests for `change_order_status`, `create_address`, `update_address`, or `delete_address`. CLAUDE.md prohibits mutable integration tests.
- **Inventing field names:** Address field names (Address1, City, State, etc.) follow the same conventions as `Customer` entity — use PascalCase matching API convention. No Swagger schema detail is available for body shape, so model after the `create_customer` tool.
- **Forgetting tool count update:** `swagger-spec.test.ts` has `expect(tools.length).toBe(114)` — this must be updated to `119` when 5 new tools are added (5 address tools + 1 change_order_status = 6, but change_order_status goes into utilities.ts which is already registered).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browse pagination + search | Custom pagination logic | `buildBrowseRequest()` + `browseSchema` | Already handles searchfields, operators, miscfields |
| Response formatting | Custom formatters | `formatBrowseResult()` / `formatEntity()` | Consistent output format across all tools |
| Error message translation | Custom try/catch | `withErrorHandling()` | Detects "Invalid column name", 503, NullReference |
| Auth + HTTP | Custom fetch calls | `getClient().post()`, `.get()`, etc. | Handles JWT, token refresh, empty response, retry |
| Test HTTP interception | Custom mock server | `vi.stubGlobal("fetch", vi.fn(...))` | Established pattern, works with InMemoryTransport |

**Key insight:** The entire infrastructure — HTTP client, schema helpers, formatters, error wrappers, test utilities — already exists and is validated. Phase 6 is pure assembly of new tools using proven parts.

---

## Confirmed API Paths

[VERIFIED: scripts/swagger-cache.json]

### Address Management (home-v1)

| Method | Path | Tool |
|--------|------|------|
| POST | `/api/v1/address/browse` | `browse_addresses` |
| GET | `/api/v1/address/{id}` | `get_address` |
| POST | `/api/v1/address` | `create_address` |
| PUT | `/api/v1/address/{id}` | `update_address` |
| DELETE | `/api/v1/address/{id}` | `delete_address` |

Also present in cache (not required by phase scope):
- POST `/api/v1/address/exportexcelxlsx` — export, can be added opportunistically but not required
- GET `/api/v1/address` — list all (no pagination), lower value than browse

### Change Order Status (utilities-v1)

| Method | Path | Tool |
|--------|------|------|
| POST | `/api/v1/changeorderstatus/changestatus` | `change_order_status` |
| POST | `/api/v1/changeorderstatus/validateorder/browse` | Optional validation helper |

The `validateorder/browse` endpoint is a validation helper used by the UI before performing the status change. It is out of scope for this phase but worth noting as a potential future tool.

---

## Common Pitfalls

### Pitfall 1: Tool Count Assertion in swagger-spec.test.ts
**What goes wrong:** `swagger-spec.test.ts` line 148 asserts `expect(tools.length).toBe(114)`. After adding 6 new tools it will fail with "expected 114, received 120".
**Why it happens:** The test explicitly counts all registered tools as a completeness guard.
**How to avoid:** Update the assertion to the new total (114 + 5 address tools + 1 change_order_status = 120) in the same commit as registering the new tools.
**Warning signs:** `swagger-spec.test.ts` fails on the "covers all registered tools" test.

### Pitfall 2: Forgetting to Register in index.ts
**What goes wrong:** New `src/tools/addresses.ts` is created but `registerAddressTools` is never imported/called in `src/index.ts`, so tools are never exposed.
**Why it happens:** `index.ts` requires an explicit import + call for every domain.
**How to avoid:** Add the import and `registerAddressTools(server)` call immediately when creating the file.
**Warning signs:** `tool-registration.test.ts` may catch this; alternatively tools simply don't appear in `listTools()`.

### Pitfall 3: Writing Mutable Integration Tests
**What goes wrong:** Creating integration tests that call `create_address`, `update_address`, or `delete_address` against the live API.
**Why it happens:** Developer tests the full CRUD surface.
**How to avoid:** Integration tests for this phase are browse-only per CLAUDE.md constraint. The `change_order_status` tool has no safe read-only test either, so it gets unit tests only.
**Warning signs:** Tests that pass in isolation but mutate production data.

### Pitfall 4: Address Field Name Guessing
**What goes wrong:** Using incorrect field names (e.g., `addressLine1` instead of `Address1`) in create/update schemas.
**Why it happens:** swagger-cache.json stores paths and methods only — not request body schemas. The live Swagger spec has the body schema but is not available offline.
**How to avoid:** Model address fields after the existing `create_customer` tool which uses `Address1`, `Address2`, `City`, `State`, `ZipCode`, `Country`, `Phone`, `Email` — these are PascalCase RW API conventions and are likely shared with the address entity. Flag in tool description that field names are based on RW convention patterns.
**Warning signs:** API returns 400 with field validation errors during integration testing.

### Pitfall 5: Change Order Status Body Shape Unknown
**What goes wrong:** `change_order_status` tool passes wrong body fields to `/api/v1/changeorderstatus/changestatus`.
**Why it happens:** swagger-cache.json has the path but not the request body schema.
**How to avoid:** Model after `change_icode` utility pattern — pass the primary entity ID and the target value as PascalCase fields. For order status change the natural fields are `OrderId` (or `OrderNumber`) and `NewStatusId` (or `StatusId`). This is LOW confidence — the exact field names may differ.
**Warning signs:** API returns 400 or 422 when called with wrong field names during integration test.

---

## Code Examples

### New domain file skeleton (addresses.ts)

```typescript
// Source: derived from src/tools/customers.ts pattern [VERIFIED]
/**
 * Address management tools
 *
 * Covers: home-v1 Address endpoints
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  buildBrowseRequest,
  formatBrowseResult,
  formatEntity,
} from "../utils/tool-helpers.js";

export function registerAddressTools(server: McpServer) {
  // tools here
}
```

### index.ts registration pattern

```typescript
// Source: src/index.ts [VERIFIED]
import { registerAddressTools } from "./tools/addresses.js";
// ...
registerAddressTools(server);
```

### unit test file skeleton

```typescript
// Source: src/__tests__/unit/customer-tools.test.ts pattern [VERIFIED]
import { registerAddressTools } from "../../tools/addresses.js";
import { resetClient } from "../../utils/api-client.js";
// ... standard beforeAll/beforeEach/afterAll setup
describe("address tools", () => {
  it("browse_addresses → POST /api/v1/address/browse", async () => { ... });
  it("get_address → GET /api/v1/address/{id}", async () => { ... });
  it("create_address → POST /api/v1/address with body", async () => { ... });
  it("update_address → PUT /api/v1/address/{id} with updates", async () => { ... });
  it("delete_address → DELETE /api/v1/address/{id}", async () => { ... });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No address tools | address CRUD in new domain file | Phase 6 | 5 new tools |
| No change order status | utility action in utilities.ts | Phase 6 | 1 new tool |

**Total new tools:** 6 (5 address + 1 change order status)
**New total after phase:** 120 tools

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Address request body uses PascalCase fields matching `customer` convention (Address1, City, State, etc.) | Common Pitfalls #4 | API returns 400 errors; field names must be corrected after live testing |
| A2 | Change order status body takes `OrderId` and a status identifier field (e.g. `NewStatusId` or `StatusId`) | Pitfall #5, Pattern 2 | API returns 400; tool implementation must be updated after live testing |
| A3 | `registerAddressTools` is a suitable function name and `addresses.ts` is a suitable file name | Architecture | Minor naming inconsistency; easy fix |

---

## Open Questions

1. **Exact body fields for `change_order_status`**
   - What we know: The endpoint is `POST /api/v1/changeorderstatus/changestatus` (utilities-v1) — verified.
   - What's unclear: The request body schema (field names, required vs optional) — not in swagger-cache.json.
   - Recommendation: Use `OrderId` + `StatusId` as the initial implementation (PascalCase convention). Document as "field names inferred from RW API convention — verify against live Swagger spec." Unit tests can assert these fields are sent; if integration tests fail, update field names.

2. **Exact body fields for address create/update**
   - What we know: The path pattern is confirmed; conventions follow PascalCase.
   - What's unclear: Whether Address has additional RW-specific fields beyond the standard address fields.
   - Recommendation: Use Address1, Address2, City, State, ZipCode, Country as the initial implementation. Integration smoke test (browse) will confirm the entity shape from the response.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond already-verified project stack — Node.js, npm, vitest, TypeScript all confirmed present from earlier phases).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:unit` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPN-01 | Address tools call correct paths/methods | unit | `npm run test:unit -- --reporter=verbose` | ❌ Wave 0: `src/__tests__/unit/address-tools.test.ts` |
| EXPN-01 | Address browse returns valid shape (live) | integration | `npm run test:integration` | ❌ Wave 0: add `it()` blocks to `live-api.test.ts` |
| EXPN-02 | change_order_status POSTs to correct path | unit | `npm run test:unit` | ❌ Wave 0: add to `address-tools.test.ts` or utilities test |
| EXPN-03 | capturedUrl, capturedMethod, capturedBody assertions for all new tools | unit | `npm run test:unit` | ❌ Wave 0 |
| EXPN-04 | Integration smoke test for address browse (read-only) | integration | `npm run test:integration` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:unit`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/unit/address-tools.test.ts` — covers EXPN-01, EXPN-03 (address tools)
- [ ] Add `change_order_status` unit test to utility-domain test file or address-tools file — covers EXPN-02, EXPN-03
- [ ] Add address browse `it()` block to `src/__tests__/integration/live-api.test.ts` — covers EXPN-04
- [ ] Update tool count in `src/__tests__/unit/swagger-spec.test.ts` from 114 to 120 — covers EXPN-01/EXPN-02 completeness check
- [ ] Add address/changeorderstatus swagger spec assertions to `swagger-spec.test.ts` — confirms paths match spec

---

## Security Domain

Security enforcement applies but Phase 6 introduces no new authentication mechanisms, data stores, or external integrations. All tools use the existing `RentalWorksClient` which already handles JWT bearer auth, token refresh, and HTTPS transport. No new ASVS controls are required beyond what is already implemented.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing JWT + bearer token in api-client.ts |
| V3 Session Management | no (unchanged) | Existing 3.5h TTL + auto-refresh |
| V4 Access Control | no | RentalWorks server enforces; MCP exposes all tools equally |
| V5 Input Validation | yes | zod schemas on all tool inputs |
| V6 Cryptography | no | No new crypto — TLS handled by fetch/Node.js |

---

## Sources

### Primary (HIGH confidence)
- `scripts/swagger-cache.json` — address paths (home-v1) and changeorderstatus paths (utilities-v1) verified directly
- `src/tools/customers.ts` — browse/get/create/update CRUD pattern verified
- `src/tools/utilities.ts` — utility action pattern (change_icode) verified
- `src/__tests__/unit/customer-tools.test.ts` — unit test capturedUrl/capturedMethod/capturedBody pattern verified
- `src/__tests__/integration/live-api.test.ts` — integration smoke test pattern verified
- `src/index.ts` — domain registration pattern verified
- `src/utils/api-client.ts` — RentalWorksClient helpers verified
- `src/utils/tool-helpers.ts` — browseSchema, buildBrowseRequest, formatBrowseResult verified
- `vitest.config.ts` — test project structure verified
- `package.json` — dependency versions verified

### Secondary (MEDIUM confidence)
- None needed — all critical claims verified from codebase directly.

### Tertiary (LOW confidence)
- A1, A2 in Assumptions Log — address and changeorderstatus request body field names inferred from RW PascalCase convention, not verified against live Swagger schema detail.

---

## Metadata

**Confidence breakdown:**
- Confirmed API paths: HIGH — verified in swagger-cache.json
- Standard Stack: HIGH — verified in package.json and existing tool files
- Architecture patterns: HIGH — verified from 3+ existing implementations
- Body field names for new tools: LOW — inferred from convention, not verified against live spec schema detail
- Pitfalls: HIGH — derived from verified codebase patterns

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable patterns — Swagger spec paths and codebase patterns unlikely to change)
