# Feature Landscape

**Domain:** MCP server — client-side filtering and response optimization for a broken-server-filter scenario
**Researched:** 2026-04-11
**Milestone scope:** v1.1 Inventory Browse Fix — field selection, client-side filtering, response trimming

---

## Context

The RentalWorks API's server-side search filters fail with 500 errors for the inventory/item browse endpoints (known DB column reference bugs in the RW server). The current `formatBrowseResult` emits every non-null field from every row — estimated ~2,200 characters per item. A page of 25 items exhausts meaningful LLM context before any reasoning happens.

The existing `browseSchema` + `buildBrowseRequest` infrastructure handles pagination/ordering. The new features live at the MCP layer — not the API layer — and must be backward-compatible with all other browse tools that do not have broken server-side filters.

---

## Table Stakes

Features an AI agent requires for this toolset to be usable at all. Missing = agents refuse to use inventory browse, fall back to get-by-ID round trips, or produce truncated/wrong results.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Field selection (include_fields) | ~2,200 chars/item with all fields; ~100-200 chars with 4-5 key fields; without this the tool is impractical | Low | Zod `z.array(z.string()).optional()` param; post-process rows in the handler before calling `formatBrowseResult` |
| Curated default field sets for inventory | Agents should not need to know internal field names to get useful results; sane defaults should work without parameters | Low | Define named sets: `SUMMARY` (ICode, Description, DailyRate, QuantityAvailable, CategoryName), `RATES` (ICode + all rate fields), `FULL` (passthrough). Default to SUMMARY. |
| Client-side search filter (filter_field / filter_value) | Server-side filters 500 on RW inventory endpoints; agents have no way to filter results otherwise | Medium | Fetch unfiltered page(s), apply JS `.filter()` on the rows before returning. Must document that this is a client-side fallback, not a server push-down. |
| Reduced default page size for inventory browse | Default of 25 × 2,200 chars = 55,000 chars; exceeds useful context even before field trimming | Low | Change `browse_rental_inventory` and `browse_items` defaults to `pageSize: 10`; leave all other browse tools unchanged. |
| Clear "showing N of M" metadata in response | Agents must know when results are truncated by client-side filtering vs pagination to avoid wrong conclusions | Low | Extend `formatBrowseResult` header: "Results: 847 total (page 1 of 34) — client filter applied: 6 of 10 rows match" |
| Graceful fallback on 500 with client-side filter retry | `withErrorHandling` currently returns an informational message on "Invalid column name"; instead, automatically retry the same request without the server-side filter and apply it client-side | Medium | Detect the "Invalid column name" 500, strip search fields from the request, retry, then filter client-side. Return result with a note explaining what happened. |

---

## Differentiators

Features that meaningfully improve the experience above basic workarounds. Not blocking, but raise quality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Named field preset parameter | Agents say `fields: "summary"` instead of enumerating 5 field names every call. Eliminates schema-knowledge burden. | Low | Add `fieldPreset: z.enum(["summary", "rates", "tracking", "full"]).optional()` to `browse_rental_inventory`. When `include_fields` is also present, `include_fields` wins. |
| Client-side substring filter (contains logic) | Server "like" is broken; a client-side contains check on Description or ICode unblocks the most common agent workflow (find items matching a description) | Low | Implement as `filter_operator: z.enum(["contains", "=", "startswith"]).optional()` defaulting to `contains`. Pure string ops on already-fetched rows. |
| Multi-page client filter (scan_pages) | When a browse returns 0 matches on page 1 after client filter, the agent has no way to find sparse matches deep in the dataset without explicit pagination. A `scan_pages` option fetches up to N pages and merges before filtering. | Medium | `scan_pages: z.number().optional().max(10)`. Cap at 10 pages (100 items max with default pageSize:10) to avoid runaway context. Must document the token cost. |
| Explicit field documentation in tool description | Currently tool descriptions say "Returns ICode, description, rates, quantities, category, warehouse info" — vague. Listing actual field names lets agents compose `include_fields` without guessing. | Low | Update the tool description string to enumerate the key fields available. No code change beyond the string. |

---

## Anti-Features

Things to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Server-side filter fix / RW API patch | Cannot fix a vendor's API server; any attempt to "fix" this would be a hack that breaks on RW updates | Document the known-broken endpoints and the automatic retry fallback |
| Applying client-side filter to all browse tools | Most browse tools do have working server-side filters; adding client-side filter overhead to them wastes resources and adds unnecessary complexity | Scope client-side filter ONLY to endpoints known to be broken: `/rentalinventory/browse` and `/item/browse`. Other tools keep server-side filter path unchanged. |
| Streaming / chunked responses | MCP stdio transport is synchronous request/response; streaming is not supported in the current SDK version | Keep single-response pattern; use pagination instead |
| Caching fetched browse results across tool calls | MCP servers are stateless by design; cross-call caching requires shared state that breaks the single-request model | Each tool call fetches fresh from API |
| Fuzzy/semantic field matching | Agents provide field names like "daily rate" and matching against "DailyRate" looks attractive but adds a dependency (string similarity library) with unpredictable behavior | Require exact field names in `include_fields`; document them in the tool description |
| Fetch-all-pages-then-filter as a default | Scanning all 34 pages to apply a client filter would be 340 API calls for a 847-item dataset | Keep pagination explicit; provide `scan_pages` as opt-in with a hard cap |
| Changing the `formatBrowseResult` signature in a breaking way | It is tested and used by all 5+ browse tool domains | Add a new optional `options` parameter; keep current behavior as the default |

---

## Feature Dependencies

```
Reduced default page size for inventory browse
  → independent, no deps, implement first

Field selection (include_fields)
  → depends on: formatBrowseResult must accept an optional fields allowlist
  → OR: field filtering done in the tool handler before calling formatBrowseResult
  → recommended: handle in the tool handler to avoid changing the tested helper signature

Named field preset parameter
  → depends on: field selection (include_fields) being implemented first
  → presets expand to a concrete include_fields list before the same code path

Client-side search filter (filter_field / filter_value)
  → independent of field selection
  → must run AFTER rows are fetched, BEFORE formatBrowseResult
  → for browse_rental_inventory and browse_items only

Graceful fallback on 500 with auto-retry
  → depends on: client-side search filter being implemented
  → catch "Invalid column name" error, strip server search fields, retry, then call client filter
  → change to withErrorHandling or add inline catch in the specific tool handlers

Multi-page client filter (scan_pages)
  → depends on: client-side search filter
  → depends on: field selection (to keep multi-page results from exploding context)

Clear "showing N of M with filter" metadata
  → depends on: client-side search filter (need to know pre- vs post-filter counts)
  → small change to formatBrowseResult or the text output construction in the handler
```

---

## MVP Recommendation

Implement strictly in this order (each step is independently testable):

1. **Reduce default page size** for `browse_rental_inventory` and `browse_items` to 10 — trivial, immediate improvement, no risk
2. **Field selection (include_fields)** — implement in the tool handler, not in `formatBrowseResult`. Take `include_fields?: string[]`, filter row objects before display.
3. **Named field presets** — expand preset to an `include_fields` list before step 2 runs. Adds `fieldPreset` param.
4. **Client-side filter** — add `filter_field` + `filter_value` + `filter_operator` params to the two broken browse tools. Apply after fetch, before format.
5. **Auto-retry on 500** — wrap the known-broken browse tools to catch "Invalid column name", retry without server search fields, apply client filter. Update tool description to explain behavior.
6. **Multi-page scan** — add `scan_pages` param as opt-in. Cap at 10 pages. Document token implications in the tool description.

Defer:
- Updating `formatBrowseResult` itself (risky to existing behavior; handler-level filtering achieves the same thing)
- Semantic / fuzzy field name matching (adds complexity, no clear benefit over exact names)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Field selection pattern | HIGH | Zod array param + JS filter on row objects is established MCP pattern; Axiom's cell-budget approach confirms the general approach |
| Client-side filtering as workaround | HIGH | Standard pattern when server filters are unreliable; nothing MCP-specific — just post-fetch JS filter |
| Default page size reduction | HIGH | Pure config change; no external dependencies |
| Auto-retry on 500 | MEDIUM | The error detection already exists in `withErrorHandling`; wiring it to a retry adds control flow complexity |
| Graceful "showing N of M" metadata | HIGH | Trivial string construction; pattern confirmed by Axiom and MCP community discussions |
| Multi-page scan | MEDIUM | Correct approach but needs careful capping to avoid context explosion; complexity is manageable |

---

## Sources

- `/Users/josh/Coworking Projects/Modern Lighting/Rental Works API/.planning/PROJECT.md` — milestone requirements, known broken endpoints
- `src/utils/tool-helpers.ts` — existing `browseSchema`, `buildBrowseRequest`, `formatBrowseResult` implementations
- `src/tools/inventory.ts` — existing browse tool implementations showing current field-dump behavior
- `src/__tests__/tool-helpers.test.ts` — confirmed `formatBrowseResult` behavior is tested; changing its signature requires test updates
- [Designing MCP servers for wide schemas and large result sets — Axiom](https://axiom.co/blog/designing-mcp-servers-for-wide-events) — cell-budget approach, source-level capping, "start small expand on demand" philosophy (MEDIUM confidence — verified via WebFetch)
- [Response size limit discussion — MCP GitHub #2211](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2211) — confirms no protocol-level limit exists; filtering is a server responsibility (MEDIUM confidence)
- [Reducing MCP token usage by 100x — Speakeasy](https://www.speakeasy.com/blog/how-we-reduced-token-usage-by-100x-dynamic-toolsets-v2) — progressive disclosure pattern; confirmed field/response trimming is the primary lever (MEDIUM confidence — WebFetch verified)
- [MCP Tools specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) — no built-in field projection in MCP protocol; must be server-implemented (LOW confidence — not directly read)
