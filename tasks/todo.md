# TODO — Phase 11: Comprehensive Browse Tool Hardening

Source plan: [/Users/josh/.claude/plans/i-don-t-think-the-dazzling-rivest.md](/Users/josh/.claude/plans/i-don-t-think-the-dazzling-rivest.md)

Why: live-API audit found that the v1.1 fix only covered `rentalinventory` and `item`. The same row-normalization, GET-fallback, and schema-coercion problems apply to ~35 more browse tools and several non-browse handlers. Tests pass because they mock the API client.

## Scope (P0 + P1)

### Schema layer
- [x] Switch `browseSchema.page` and `browseSchema.pageSize` to `z.coerce.number()` so LLM-stringified numerics parse cleanly
- [x] Coerce numeric fields in: `add_order_item` (QuantityOrdered, Rate, DaysPerWeek), `apply_order_discount.discountPercent`, `create_rental_inventory` (DailyRate, WeeklyRate, MonthlyRate, ReplacementCost), `update_rental_inventory` (same), `create_customer.CreditLimit`, `assign_barcodes.Quantity`

### API client
- [x] Strip trailing slash from `BASE_URL` once at module load
- [x] Tighten `request<T>(method, path, body?)` body parameter to `Record<string, unknown> | undefined` so `JSON.stringify` invariant holds in one place; eliminates the double-encode footgun on 401/403 retry
- [ ] ~Single-flight guard around `ensureAuth()`~ — descoped (low risk, token TTL is 3.5h; can revisit)
- [x] `client.browse<T>` enforced as single browse entrypoint — see invariant test below

### Browse tool wiring
Every `client.post("/api/v1/<entity>/browse", request)` replaced with `client.browse("<entity>", request)`:
- [x] `src/tools/orders.ts` — `order`, `orderitem`, `quote`
- [x] `src/tools/customers.ts` — `customer`, `contact`, `deal`, `project`
- [x] `src/tools/contracts.ts` — `contract`, `checkedoutitem`, `transferorder`, `repair`
- [x] `src/tools/billing.ts` — `invoice`, `billing`, `billingworksheet`, `receipt`, `vendorinvoice`
- [x] `src/tools/inventory.ts` — `salesinventory`, `partsinventory`, `physicalinventory` (plus existing `rentalinventory`/`item` simplified to use the new factory)
- [x] `src/tools/settings.ts` — `warehouse`, `rentalcategory`, `salescategory`, `ordertype`, `crew`, `discountitem`, `template`, `laborrate`, `officelocation`, `glaccount`, plus the dynamic `browse_settings_entity`
- [x] `src/tools/addresses.ts` — `address`
- [x] `src/tools/admin.ts` — `user`, `alert`
- [x] `src/tools/vendors.ts` — `vendor`, `purchaseorder`
- [x] `src/tools/utilities.ts` — `inventorypurchasesession`, `labeldesign` (and `raw_api_browse` already used `client.browse`)
- [x] `src/tools/storefront.ts` — `storefrontcatalog` (note: `storefront_browse_catalog` calls `GET /api/v1/storefront/catalog` — a list endpoint, not a browse endpoint; preserved as-is)

### Error handling wiring
- [x] Every `server.tool(...)` handler wraps with `withErrorHandling(...)` (verified by [phase-11-hardening.test.ts](src/__tests__/unit/phase-11-hardening.test.ts:91))
- [x] `Record Not Found` 500s surface as friendly "not found" (informational, not `isError`)
- [x] Old test wording for "Invalid column name" preserved
- [ ] ~Delete dead duplicate `browseWithFallback()`~ — kept for now; it's exported but unreferenced. Removal is a one-line change, deferred to avoid touching browse-helpers.ts in this PR.

### Response size hardening
- [x] `BRIEF_FIELDS_BY_ENTITY` map in [tool-helpers.ts](src/utils/tool-helpers.ts:99) covers all 28 browseable entities
- [x] `browseTool()` factory applies the entity's brief preset by default; callers can opt out via `fieldPreset: "full"` or override with `fields: [...]`
- [x] `get_session` returns scalar fields + a list of nested keys — turns 4 MB into ~500 bytes
- [x] `get_account_settings` gets the same treatment

### Verification
- [x] `npm run build && npm test` — green (294 passing, 20 integration skipped without creds)
- [x] [phase-11-hardening.test.ts](src/__tests__/unit/phase-11-hardening.test.ts) — 13 invariant tests covering schema coercion, "no raw `client.post(/browse)`", "every handler is error-wrapped", "every browsed entity has a brief preset", arity preservation, and keyed-output formatting
- [ ] Add live-API integration assertion (gated by env): every browse tool returns `Rows[0]` as a keyed object whose keys ⊆ live `ColumnHeaders[].DataField` — **deferred** (env-gated tests need a creds round-trip, not a write barrier; can be added after merge)
- [ ] Live re-probe of previously broken tools — **blocked on user**: see "Live verification" below

## Live verification — user action required

The Claude Code MCP server runs `tsx /Users/josh/Coworking Projects/Modern Lighting/Rental Works API/src/index.ts` from claude_desktop_config.json (~/Library/Application Support/Claude/). That path resolves to the **main repo's** `src/`, not this worktree. Until the branch is merged (or checked out into the main worktree) and the MCP connection restarted, live probes still hit the OLD code.

After merging this branch and restarting the MCP server, re-run these read-only probes — every one should now return keyed rows and no 500 fallthroughs:

| Tool                   | Pre-fix observed       | Expected after fix                         |
| ---------------------- | ---------------------- | ------------------------------------------ |
| `browse_orders`        | Positional rows, ~107K | Keyed rows, brief preset, ≤30 KB           |
| `browse_customers`     | Positional rows        | Keyed rows: `CustomerId: … \| Customer: …` |
| `browse_invoices`      | Positional rows        | Keyed rows                                 |
| `browse_contracts`     | Positional rows        | Keyed rows                                 |
| `browse_quotes`        | 500 Invalid column     | GET fallback fires, keyed rows             |
| `browse_addresses`     | 500 Invalid column     | GET fallback fires, keyed rows             |
| `browse_users`         | 500 Invalid column     | GET fallback fires, keyed rows             |
| `browse_billing`       | 500 Invalid column     | GET fallback fires, keyed rows             |
| `get_session`          | 4 MB blob              | Scalar fields + nested-key hint            |
| `browse_orders` w/ `page: "1"` | MCP -32602      | Parses cleanly                             |

## Review

**What changed**: 12 source files modified, 1 new file (`tasks/lessons.md`), 1 new test file. ~35 browse-tool handlers now route through `client.browse()` (was: raw `client.post`). Every tool handler is wrapped with `withErrorHandling` (was: zero wrapping despite the helper being exported). `browseSchema` page/pageSize and 14 per-tool numeric fields now coerce strings to numbers (was: `z.number()` rejected all stringified inputs). `get_session` and `get_account_settings` summarize their multi-megabyte payloads to scalar fields plus a list of nested keys.

**Test results**: 294 passing / 20 integration-skipped (no creds in env). New `phase-11-hardening.test.ts` adds 13 invariant tests that pin the architectural rules in place — future tools that bypass `client.browse()` or skip `withErrorHandling` will fail CI.

**Why this works where the previous fix didn't**: PR #1's GET fallback was on `client.browse()`, but only 3 of 38 browse tools used `client.browse()` — the rest called `client.post()` directly and never reached the fallback. Phase 11 makes `client.browse()` the only path: a grep-style invariant test (`phase-11-hardening.test.ts:79`) prevents regression.

**Out of scope**:
- Mutating endpoints (create/update/delete, checkout/checkin sessions) — read-only audit didn't probe them. They got the same `withErrorHandling` wrap and numeric coercion, but their request body shapes weren't separately validated against live behavior.
- The deprecated `server.tool(name, desc, schema, cb)` overload — a future cleanup, ~114 call sites.
- Removing the now-dead `browseWithFallback()` from `browse-helpers.ts` — one-line cleanup, deferred.

**Code review pass**: `/gsd-code-review phase 11` produced [11-REVIEW.md](.planning/phases/11-comprehensive-browse-hardening/11-REVIEW.md) with 2 BLOCKERs, 9 warnings, 5 info items. All blockers and 5 of 9 warnings fixed in the same branch:

| ID    | Severity | Issue                                                                | Status                                      |
| ----- | -------- | -------------------------------------------------------------------- | ------------------------------------------- |
| BL-01 | BLOCKER  | `Math.ceil(N / 0)` in GET fallback                                   | Fixed — defensive arithmetic + regression test |
| BL-02 | BLOCKER  | Search criteria silently dropped on Invalid-column retry             | Fixed — search params threaded + regression test |
| WR-01 | WARNING  | `ensureAuth()` not single-flight                                     | Fixed — `authPromise` mutex                  |
| WR-02 | WARNING  | `>`, `>=`, `<`, `<=` operators rejected all rows in `applyClientFilter` | Fixed — numeric comparison + regression test |
| WR-03 | WARNING  | `browse_order_items` bypassed `BRIEF_FIELDS_BY_ENTITY`               | Fixed — `resolveBrowseFields("orderitem", args)` wired |
| WR-04 | WARNING  | `as never` casts in `reports.ts`                                     | Fixed — narrowed to `as unknown as BrowseResponse` |
| WR-06 | WARNING  | 3 `z.boolean()` fields rejected stringified bools                    | Fixed — `z.coerce.boolean()` for Inactive (×2), IncludeSubHeadings |
| IN-04 | INFO     | `BRIEF_FIELDS_BY_ENTITY.address` missing Phone/Email                 | Fixed                                       |
| WR-05 | WARNING  | `raw_api_post` cryptic JSON.parse error                              | Deferred — UX polish, low impact            |
| WR-07 | WARNING  | `convert_quote_to_order` requires location/warehouse                 | Deferred — pre-existing behavior            |
| WR-08 | WARNING  | `as unknown as Record<string, unknown>` double-cast                  | Deferred — cosmetic                         |
| WR-09 | WARNING  | `formatEntity` vs `JSON.stringify` inconsistency                     | Deferred — cosmetic, broad refactor         |
| IN-01 | INFO     | BASE_URL unset → confusing fetch error                               | Deferred — config-time concern              |
| IN-02 | INFO     | `Inactive` field default                                             | Acknowledged — pre-existing behavior is correct |
| IN-03 | INFO     | Address browse may not have GET fallback                             | Verify post-merge live probe                |
| IN-05 | INFO     | Test description nit                                                 | Deferred — cosmetic                         |

After fixes: 308 tests pass (281 baseline + 27 Phase 11 invariants/regressions), build clean.
