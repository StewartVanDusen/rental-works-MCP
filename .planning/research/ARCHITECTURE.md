# Architecture Research

**Domain:** MCP server layer — client-side filtering, field projection, and error fallback
**Researched:** 2026-04-11
**Confidence:** HIGH (based on direct code inspection of existing architecture)

## Standard Architecture

### System Overview — Current State

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Tool Handlers                            │
│  (src/tools/inventory.ts, orders.ts, ...)                        │
│                                                                  │
│  server.tool("browse_rental_inventory", browseSchema, async(args)│
│    → buildBrowseRequest(args)                                    │
│    → client.post("/api/v1/rentalinventory/browse", request)      │
│    → formatBrowseResult(data)   ← dumps ALL non-null fields      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ uses
┌─────────────────────────▼───────────────────────────────────────┐
│                     tool-helpers.ts                              │
│  browseSchema          — shared Zod schema (page/search/sort)   │
│  buildBrowseRequest()  — schema args → API request body          │
│  formatBrowseResult()  — raw API response → text string          │
│  formatEntity()        — single record → text string             │
│  withErrorHandling()   — wraps handlers, maps known errors       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ calls
┌─────────────────────────▼───────────────────────────────────────┐
│                     api-client.ts                                │
│  RentalWorksClient (singleton)                                   │
│  request(), get(), post(), put(), delete()                       │
│  browse(), getById(), create(), update(), remove()               │
│  JWT auth with 3.5h auto-refresh                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────────┐
│               RentalWorks Cloud API                              │
│  /api/v1/rentalinventory/browse  (broken: masterid, rentalitemid)│
│  /api/v1/salesinventory/browse                                   │
│  /api/v1/item/browse                                             │
└─────────────────────────────────────────────────────────────────┘
```

### System Overview — Target State (v1.1)

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Tool Handlers                            │
│  browse_rental_inventory:                                        │
│    → buildBrowseRequest(args)                                    │
│    → withClientSideFallback(                                     │
│         () => client.post(..., request),                         │
│         () => client.post(..., requestNoSearch),                 │
│         args.clientFilter                                        │
│       )                                                          │
│    → formatBrowseResult(data, { fields: args.fields             │
│                                    ?? RENTAL_INVENTORY_BRIEF })  │
└──────────────────┬──────────────────────┬───────────────────────┘
                   │                      │
     ┌─────────────▼──────────┐  ┌────────▼────────────────────┐
     │   tool-helpers.ts      │  │   browse-helpers.ts (NEW)    │
     │   (modified)           │  │                              │
     │                        │  │  applyClientFilter()         │
     │  browseSchema          │  │  withClientSideFallback()    │
     │    + fields?  (new)    │  │  RENTAL_INVENTORY_BRIEF      │
     │    + clientFilter? (new│  │  SALES_INVENTORY_BRIEF       │
     │                        │  │  ITEMS_BRIEF                 │
     │  buildBrowseRequest()  │  │                              │
     │   (unchanged)          │  └─────────────────────────────┘
     │                        │
     │  formatBrowseResult()  │
     │   (add fields? option) │
     └────────────────────────┘
```

## Recommended Project Structure

```
src/
├── tools/
│   └── inventory.ts           # Modified: browse handlers gain fields + clientFilter
├── utils/
│   ├── api-client.ts          # No changes needed
│   ├── tool-helpers.ts        # Modified: browseSchema + formatBrowseResult
│   └── browse-helpers.ts      # NEW: applyClientFilter, withClientSideFallback,
│                              #      default field constant sets
└── types/
    └── api.ts                 # No changes expected
```

### Structure Rationale

- **browse-helpers.ts (new):** Isolates the three new concerns (projection, filtering, fallback) from the general-purpose tool-helpers.ts. Keeps tool-helpers.ts minimal and stable. Has zero dependency on MCP SDK — easily unit-tested with mock data, no InMemoryTransport required.
- **tool-helpers.ts (modified):** Two targeted changes only — extend `browseSchema` with two optional fields, and extend `formatBrowseResult` to accept an options object. All existing callers pass no second argument, so behavior is unchanged.
- **inventory.ts (modified):** Browse tool handlers pick up `fields` and `clientFilter` from schema args and pass them to the new helpers. CRUD tools (get/create/update/delete) are untouched.
- **api-client.ts (no changes):** The client layer is responsible for HTTP communication only. Filtering and projection are application concerns that belong above it.

## Architectural Patterns

### Pattern 1: Schema Extension — Additive, Non-Breaking

**What:** Add two optional fields to the shared `browseSchema` object in tool-helpers.ts.
**When to use:** For fields that apply to all browse tools equally. Field selection and client-side search both belong at this level since any browse tool could benefit.
**Trade-offs:** Adding to the shared schema means all browse tools pick these up automatically. This is intentional — field selection should work on customers, orders, vendors, etc., not just inventory. Adding optional-with-no-default fields is strictly backward compatible.

```typescript
// tool-helpers.ts — extend browseSchema
export const browseSchema = {
  // ... existing fields unchanged ...
  fields: z
    .array(z.string())
    .optional()
    .describe("Return only these fields per row (e.g. ['ICode','Description','DailyRate']). Omit for domain defaults."),
  clientFilter: z.object({
    field: z.string().describe("Field name to filter on"),
    value: z.string().describe("Value to match"),
    operator: z.enum(["contains", "startswith", "=", "like"]).default("contains"),
  })
  .optional()
  .describe("Client-side filter applied after fetch — use when server-side search returns 500 (broken column)"),
};
```

### Pattern 2: Field Projection at the Formatter Layer

**What:** `formatBrowseResult` accepts an optional `fields` array and strips all other keys from each row before building the output string. Projection happens at format time, not at fetch time.
**When to use:** Whenever a caller wants a compact response. The savings are in what the MCP tool returns to the LLM, not in network traffic — we have no control over what the API includes in its response.
**Trade-offs:** Fetches the full payload from the API regardless of `fields`. Acceptable because the bottleneck is LLM context length (~2200 chars/row → ~150 chars/row), not network bandwidth.

```typescript
// tool-helpers.ts — modified formatBrowseResult
export function formatBrowseResult(
  data: { TotalRows: number; PageNo: number; PageSize: number; TotalPages: number; Rows: Record<string, unknown>[] },
  options?: { fields?: string[] }
): string {
  const rows = options?.fields
    ? data.Rows.map(row =>
        Object.fromEntries(options.fields!.map(f => [f, row[f]]))
      )
    : data.Rows;
  // ... header and row-rendering logic unchanged, operating on `rows` ...
}
```

### Pattern 3: Client-Side Filter as a Pre-Format Step

**What:** `applyClientFilter()` in browse-helpers.ts filters `data.Rows` in memory before `formatBrowseResult` is called. It is invoked explicitly in tool handlers that receive a `clientFilter` arg.
**When to use:** When the caller wants to search by a field that triggers "Invalid column name" 500 errors server-side (e.g. `masterid`, `rentalitemid`). Caller should also set a larger `pageSize` (e.g. 100-500) since filtering only sees the fetched page.
**Trade-offs:** Requires fetching a larger page to be useful. This trade-off is the caller's responsibility to manage. Document in the tool description string.

```typescript
// browse-helpers.ts
export function applyClientFilter(
  rows: Record<string, unknown>[],
  filter: { field: string; value: string; operator: string }
): Record<string, unknown>[] {
  const { field, value, operator } = filter;
  const needle = value.toLowerCase();
  return rows.filter(row => {
    const cell = String(row[field] ?? "").toLowerCase();
    if (operator === "contains" || operator === "like") return cell.includes(needle);
    if (operator === "startswith") return cell.startsWith(needle);
    if (operator === "=") return cell === needle;
    return cell.includes(needle);
  });
}
```

### Pattern 4: Error-Fallback Wrapper

**What:** `withClientSideFallback()` wraps a browse call. On "Invalid column name" error AND when `clientFilter` is provided, it retries with a request that has no server-side search fields, then applies `applyClientFilter` locally.
**When to use:** Wrap the `client.post(...)` call in browse tool handlers for entities known to have broken server-side filter columns. Can also be applied broadly to all browse tools — no-ops on the happy path.
**Trade-offs:** Two API calls on the failure path (original attempt + retry). Acceptable because the broken 500 path was previously a dead end. Errors not matching "Invalid column name" re-throw and propagate to `withErrorHandling`.

```typescript
// browse-helpers.ts
export async function withClientSideFallback(
  fetchFn: () => Promise<BrowseResponse>,
  fallbackFetchFn: () => Promise<BrowseResponse>,
  clientFilter?: { field: string; value: string; operator: string }
): Promise<BrowseResponse> {
  try {
    return await fetchFn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (clientFilter && msg.includes("Invalid column name")) {
      const data = await fallbackFetchFn();
      const filtered = applyClientFilter(data.Rows, clientFilter);
      return { ...data, Rows: filtered, TotalRows: filtered.length };
    }
    throw err; // re-throw for withErrorHandling to catch
  }
}
```

**Error layering:** `withClientSideFallback` (inner) must execute before `withErrorHandling` (outer). Inner catches "Invalid column name" and returns real data. Outer catches anything remaining and formats as error text. They serve different contracts: one recovers with data, the other formats failure.

### Pattern 5: Curated Default Field Sets

**What:** Named `string[]` constants in browse-helpers.ts representing curated field sets for each inventory entity.
**When to use:** As the default `fields` value in browse tool handlers when caller omits `fields`. Caller can always override by passing explicit `fields: [...]`.
**Trade-offs:** Opinionated defaults. Field names must match what the API actually returns — verify against a live browse response before hardcoding.

```typescript
// browse-helpers.ts
export const RENTAL_INVENTORY_BRIEF_FIELDS = [
  "InventoryId", "ICode", "Description", "CategoryDescription",
  "DailyRate", "WeeklyRate", "MonthlyRate",
  "QuantityOwned", "QuantityAvailable", "WarehouseDescription",
];

export const ITEMS_BRIEF_FIELDS = [
  "ItemId", "ICode", "Description", "BarCode", "SerialNumber",
  "Status", "WarehouseDescription",
];
```

## Data Flow

### Request Flow — Happy Path (field selection only)

```
LLM calls browse_rental_inventory
  { searchValue: "LED PAR", fields: ["ICode","Description","DailyRate"] }
           |
buildBrowseRequest(args)
  → { pageno:1, pagesize:10, searchfields:["Description"], ... }
           |
client.post("/api/v1/rentalinventory/browse", request)
  → { TotalRows:47, Rows:[{InventoryId:..., ICode:..., 80+ fields...}] }
           |
formatBrowseResult(data, { fields: ["ICode","Description","DailyRate"] })
  → strips all but 3 fields per row
  → "Results: 47 total (page 1 of 5)\nICode: LED-PAR64 | Description:... | DailyRate: 15"
           |
MCP returns ~150 chars/row instead of ~2200 chars/row
```

### Request Flow — Fallback Path (broken server-side filter)

```
LLM calls browse_rental_inventory
  { clientFilter: { field:"masterid", value:"12345", operator:"=" }, pageSize: 200 }
           |
buildBrowseRequest(args)  →  requestWithSearch (searchfields: ["masterid"])
buildBrowseRequest({...args, searchField:undefined})  →  requestNoSearch
           |
withClientSideFallback(
  () => client.post(..., requestWithSearch),    ← attempt 1: 500 "Invalid column name"
  () => client.post(..., requestNoSearch),      ← attempt 2: returns 200 unfiltered rows
  { field:"masterid", value:"12345", ... }
)
           |
applyClientFilter(data.Rows, filter)
  → filters 200 rows to those where masterid = "12345"
           |
formatBrowseResult(filteredData, { fields: RENTAL_INVENTORY_BRIEF_FIELDS })
```

### Key Data Flows

1. **Field projection:** `fields` arg flows from schema → tool handler → `formatBrowseResult` options. No change to the API call or api-client.ts.
2. **Client-side filter:** `clientFilter` arg flows from schema → tool handler → `withClientSideFallback`. On error, re-fetch without broken search field, filter rows locally, return as if normal browse.
3. **Default fields:** Browse tools use a named constant (e.g. `RENTAL_INVENTORY_BRIEF_FIELDS`) when caller omits `fields`. Explicit `fields: [...]` in args overrides this.
4. **Error bubbling:** `withClientSideFallback` only intercepts "Invalid column name" errors when `clientFilter` is provided. All other errors propagate to `withErrorHandling` unchanged — existing behavior preserved.

## Integration Points

### Modified Components

| Component | What Changes | What Stays the Same |
|-----------|-------------|---------------------|
| `tool-helpers.ts / browseSchema` | Add `fields?` and `clientFilter?` optional fields | All existing fields, defaults, operators — fully backward compatible |
| `tool-helpers.ts / formatBrowseResult` | Accept optional `options?: { fields?: string[] }` second parameter | All callers passing no second arg continue to work identically |
| `tools/inventory.ts` browse handlers | Pass `fields` / `clientFilter` to helpers; set smaller default `pageSize`; use `withClientSideFallback` | CRUD tools (get/create/update/delete/copy) completely untouched |

### New Components

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `utils/browse-helpers.ts` | `applyClientFilter`, `withClientSideFallback`, default field constant sets | Only `../types/api.js` for `BrowseResponse` type — no MCP SDK, no tool-helpers |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Tool handler → browse-helpers | Direct function calls | browse-helpers has zero MCP SDK dependency; fully unit-testable with mock data |
| Tool handler → tool-helpers | Direct function calls (unchanged) | Non-inventory browse tools unaffected by this milestone |
| browse-helpers → api-client | No direct coupling | browse-helpers receives already-fetched `BrowseResponse` data; all API calls stay in tool handlers |
| withClientSideFallback → withErrorHandling | Layered: inner wraps fetch, outer wraps handler | withClientSideFallback runs inside the handler; withErrorHandling wraps the entire handler call |

## Anti-Patterns

### Anti-Pattern 1: Filtering Inside api-client.ts

**What people do:** Add `clientFilter` to `RentalWorksClient.browse()` and apply filtering there.
**Why it's wrong:** The api-client layer owns HTTP communication. Adding filtering logic couples it to application concerns, makes it harder to test in isolation, and silently applies the behavior to every caller of `browse()` — including CRUD scaffolding, checkout sessions, and other domains.
**Do this instead:** Keep filtering in browse-helpers.ts. Invoke explicitly from tool handlers where the intent is clear.

### Anti-Pattern 2: Auto-Fallback on Every 500 Error

**What people do:** Make every browse call automatically retry with client-side filtering on any 500.
**Why it's wrong:** Silent auto-retry on all 500s masks real server errors as seemingly successful (but silently unfiltered) responses. The fallback requires a larger `pageSize` to be meaningful, and the caller needs to choose that consciously. Auto-fallback without caller awareness creates non-deterministic results.
**Do this instead:** Only activate `withClientSideFallback` when `clientFilter` is explicitly provided. The presence of `clientFilter` signals that the caller understands the trade-off and accepts client-side filtering.

### Anti-Pattern 3: Server-Side Field Selection via Request Body

**What people do:** Add a `fields` array to the API request body, hoping the server returns fewer fields.
**Why it's wrong:** RentalWorks browse endpoints do not support server-side field selection (not in Swagger spec). The server will ignore the field or return a 400/500 error.
**Do this instead:** Project fields client-side in `formatBrowseResult` — fetch the full payload, strip before formatting.

### Anti-Pattern 4: Collapsing Fallback and Error-Formatting Into One Wrapper

**What people do:** Extend `withErrorHandling` to also handle the fallback retry logic — one wrapper for both concerns.
**Why it's wrong:** `withErrorHandling` formats exceptions as LLM-readable text and returns a `ToolResult`. The fallback retry must return actual `BrowseResponse` data, not a `ToolResult`. These two contracts are incompatible in the same function. Mixing them means the fallback can never cleanly return real data.
**Do this instead:** Layer them: `withClientSideFallback` runs inside the handler (returns data or re-throws). `withErrorHandling` wraps the entire handler (catches whatever `withClientSideFallback` re-threw and returns error text).

## Suggested Build Order

Dependencies drive this order. Each step produces something the next step can test before the next step starts.

### Step 1: browse-helpers.ts — Pure Functions

Build and unit-test the pure utility functions with mock data:
- `applyClientFilter(rows, filter)` — array in, filtered array out
- Default field constants (`RENTAL_INVENTORY_BRIEF_FIELDS`, `ITEMS_BRIEF_FIELDS`, etc.)

Zero dependencies on MCP, api-client, or tool-helpers. Test completely with inline mock arrays. No server access needed.

### Step 2: withClientSideFallback — Async Wrapper

Build and test with mocked `fetchFn` / `fallbackFetchFn` functions:
- Happy path: no error → returns original data, fallback never called
- Error matching "Invalid column name" + clientFilter provided → fallback called, filter applied
- Error matching "Invalid column name" + no clientFilter → error re-thrown
- Other errors → re-thrown regardless

### Step 3: Extend formatBrowseResult — Backward-Compatible Signature Change

Add optional `options?: { fields?: string[] }` parameter. Existing callers pass nothing — behavior unchanged. Existing unit tests must continue to pass without modification. Add new test cases for the projection behavior.

### Step 4: Extend browseSchema — Additive Schema Fields

Add `fields` and `clientFilter` to `browseSchema`. Both optional with no defaults. All existing browse tools continue to work without changes to their handler functions. Run full unit test suite to confirm no regressions.

### Step 5: Update Inventory Browse Handlers

For each browse tool in inventory.ts:
- Pass `fields` and `clientFilter` from args to formatBrowseResult and withClientSideFallback
- Set inventory-specific default `pageSize` (e.g. 10 instead of 25)
- Apply appropriate `BRIEF_FIELDS` constant as default when caller omits `fields`
- Wrap the `client.post()` call in `withClientSideFallback` using `args.clientFilter`

This is the widest change in terms of lines touched but all primitives are stable and tested by this point.

### Step 6: Integration Tests

Add read-only integration test cases:
- Browse with explicit `fields` array — confirm output contains only requested fields
- Browse with large `pageSize` and `clientFilter` on a known-broken column — confirm fallback works end-to-end against live API
- Browse with no `fields` and no `clientFilter` — confirm existing output shape is unchanged (regression guard)

## Sources

- Direct code inspection: `src/utils/tool-helpers.ts`, `src/utils/api-client.ts`, `src/tools/inventory.ts`
- Project context: `.planning/PROJECT.md` (v1.1 milestone requirements, broken column documentation)
- CLAUDE.md: Project constraints and known RW server-side 500 patterns

---
*Architecture research for: RentalWorks MCP Server v1.1 — inventory browse fix*
*Researched: 2026-04-11*
