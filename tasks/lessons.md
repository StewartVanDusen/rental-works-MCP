# Lessons

A running log of patterns and rules captured from corrections during this project. New entries go on top.

## Quick index

- **L10** — Boolean inputs need `z.coerce.boolean()` for the same reason numerics need `z.coerce.number()`.
- **L9** — Higher-order helpers must thread their dependencies; check the call sites, not just the helper.
- **L8** — Defensive arithmetic on third-party API responses: never trust `denominator > 0`.
- **L7** — Architectural invariants belong in tests, not docs.
- **L6** — A worktree's `dist/` doesn't reach a Claude Desktop MCP server running from the main repo's path.
- **L5** — `URL.pathname` does NOT decode percent-encoded paths.
- **L4** — `as any` in tool handlers hides shape regressions.
- **L3** — Server-side bug fallbacks must be applied at the transport layer, not per-tool.
- **L2** — `z.number()` rejects LLM tool calls.
- **L1** — Mocked tests cannot validate API row shape.

## Rules

### L10 — Boolean inputs need `z.coerce.boolean()` for the same reason numerics need `z.coerce.number()`

Phase 11 caught the numeric coercion problem (`z.number()` rejects `"1"`) and applied `z.coerce.number()` everywhere. The code reviewer flagged that `z.boolean()` has the same issue: an LLM passing `Inactive: "true"` is rejected with MCP error -32602 before any HTTP call. Three places had stale `z.boolean()` (customers.update, inventory.update, reports.run_report).

- **Why:** the coercion gap was framed as "LLM stringifies numerics" but the underlying problem is broader — LLMs stringify *all primitives*. Boolean inputs are no exception.
- **How to apply:** any `z.boolean()` in tool input is a bug. Prefer `z.coerce.boolean()`. Note the semantic: `z.coerce.boolean()` treats the strings `"false"` and `"0"` as **truthy** (Boolean(string) is true for any non-empty string). If you need `"false"` to be falsy, use `z.union([z.boolean(), z.enum(["true","false"]).transform(s => s === "true")])`.

### L9 — Higher-order helpers must thread their dependencies; check the call sites, not just the helper

`withClientSideFallback(fetchFn, request, searchField?, searchValue?, searchOperator?)` accepts five args and applies a client-side filter on the retry path. The unit tests for the helper passed all five args and verified filtering worked. But the integration call site in `client.browse()` only passed two args — silently dropping the user's search criteria on retry. The helper was correct; the wiring at the call site was broken.

- **Why:** unit tests of helpers in isolation can't catch missing arguments at the integration boundary. The reviewer found this by reading the call site with the helper's signature in mind.
- **How to apply:** when a helper has optional behavioral parameters, write at least one integration test that proves they reach the helper from the highest call site. Or make them required when the behavior they enable is non-negotiable.

### L8 — Defensive arithmetic on third-party API responses: never trust `denominator > 0`

The GET fallback computed `Math.ceil(raw.TotalItems / raw.PageSize)`. The PLAN's reviewer prompt explicitly called out the `PageSize === 0` case. The agent who wrote the fallback didn't guard for it. `Math.ceil(N / 0)` is `Infinity`; `Math.ceil(N / undefined)` is `NaN`. Both pollute the response visible to the LLM ("page 1 of NaN").

- **Why:** TypeScript types declare what the API *should* return; what it *does* return on edge cases is a separate concern. RentalWorks specifically returns `PageSize: 0` for some entities.
- **How to apply:** any division by an API field needs `value && value > 0 ? value : fallback`. Prefer pulling the fallback from the request the user sent (we know what `pagesize` they asked for). Same goes for `Math.ceil`/`Math.floor` of any computed quantity that depends on possibly-undefined inputs.

### L7 — Architectural invariants belong in tests, not docs

PR #1 documented "every browse tool should use `client.browse()`" in commit messages and in `.planning/STATE.md`'s decisions list — but no test enforced it. 35 of 38 browse tools quietly diverged anyway. Phase 11 added [phase-11-hardening.test.ts](src/__tests__/unit/phase-11-hardening.test.ts) which greps `src/tools/` for `client.post("/<x>/browse"` and `withErrorHandling(`/`browseTool(` wrappers — the rules are now mechanically enforceable.

- **Why:** documentation is descriptive; tests are prescriptive. Future contributors don't read STATE.md.
- **How to apply:** any architectural rule that's worth stating in prose ("never call X directly", "always wrap with Y") is worth a one-line grep test in `__tests__/`. The test should fail loudly with a list of offending files.

### L6 — A worktree's `dist/` doesn't reach a Claude Desktop MCP server running from the main repo's path

The MCP server registered in `~/Library/Application Support/Claude/claude_desktop_config.json` runs `tsx /<repo>/src/index.ts`. Git worktrees live at `<repo>/.claude/worktrees/<name>/` with their own `src/`. Building `dist/` in the worktree changes nothing for the live MCP server — the server reads from the main repo's `src/`. Live verification of MCP-served tool changes requires the branch to be merged (or checked out in the main worktree) AND the Claude Desktop MCP connection restarted.

- **Why:** worktrees are independent checkouts but the MCP server config points to the canonical path.
- **How to apply:** if a phase needs live verification, plan it for after merge. Or sync `src/` files into the main worktree as a temporary measure (with the user's consent). Don't claim live verification while still working in a branch worktree.

### L5 — `URL.pathname` does NOT decode percent-encoded paths

When using `import.meta.url` to find a directory next to the test file, `new URL("../foo/", import.meta.url).pathname` returns `/Users/josh/Coworking%20Projects/...` and `fs.readdirSync()` fails with ENOENT on the literal `%20`. Use `fileURLToPath()` from `node:url` instead.

- **Why:** spec-compliant, but the WHATWG URL parser keeps the path encoded; Node's `fs` module wants OS-native paths.
- **How to apply:** any `new URL(rel, import.meta.url).pathname` that feeds `fs` is a bug. Always wrap in `fileURLToPath()`.

### L4 — `as any` in tool handlers hides shape regressions

Every browse tool wrote `formatBrowseResult(data as any)`. The compiler couldn't catch that `data.Rows` had become `string[][]` instead of `Record<string, unknown>[]`. Strict typing on `client.browse<T>` and `formatBrowseResult` would have surfaced this at compile time.

- **Why:** the broad `unknown` return type pushed casting onto every caller, which uniformly chose `any`.
- **How to apply:** API client methods should return the actual envelope type. Helper functions should accept the envelope type, not `any`.

### L3 — Server-side bug fallbacks must be applied at the transport layer, not per-tool

The PR #1 fix added a GET fallback inside `client.browse()` for two entities. The intended scope was "all entities that hit the same DB bug" but the fallback only fires if the tool *uses* `client.browse()` — and 35 of 38 browse tools called `client.post()` directly, bypassing it. Result: same RW server bug, same broken tool.

- **Why:** fallback was scoped per-call site instead of being the only callable path.
- **How to apply:** transport-layer compensations belong in the client. Tool handlers should not have a choice of bypass.

### L2 — `z.number()` rejects LLM tool calls

LLMs (Claude in particular, but generally any JSON-RPC consumer) pass `"1"` for numeric tool args. `z.number()` produces an MCP `-32602` validation error before any HTTP call. Use `z.coerce.number()` for any numeric input that comes from a tool argument.

- **Why:** the MCP transport JSON-encodes everything; LLM token output for numerics is often quoted.
- **How to apply:** any `z.number()` in a tool input schema is a bug. Audit `grep "z.number" src/tools src/utils`.

### L1 — Mocked tests cannot validate API row shape

The v1.0/v1.1 unit suites passed entirely with mocked clients. The bug they couldn't catch: the live RentalWorks `/browse` endpoints return rows as **positional arrays** alongside a `ColumnHeaders` metadata array. The MCP tool layer must zip these together before formatting, or `formatBrowseResult` (which iterates `Object.entries(row)`) emits `0: foo | 1: bar` instead of named fields — making the response unusable for an LLM.

- **Why:** mocks were hand-written and assumed `Rows[0]` was already keyed.
- **How to apply:** any tool that talks to a `/browse` endpoint must (a) route through `client.browse()` so `normalizeRows()` runs, and (b) have at least one read-only live integration test that asserts `Object.keys(Rows[0])` is a non-numeric set.
