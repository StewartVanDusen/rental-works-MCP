/**
 * Phase 11 invariants — the bugs the v1.0/v1.1 mocked test suites couldn't catch.
 *
 * Each test here pins down one architectural rule that, if violated, would
 * regress real-world LLM usability:
 *
 *   1. browseSchema accepts string-typed numerics (LLM transports stringify).
 *   2. Per-tool numeric fields (rates, quantities, discounts) coerce.
 *   3. Every tool source file routes browses through `client.browse(entity, …)`
 *      — never `client.post("/<entity>/browse", …)` — so row normalization
 *      and the "Invalid column name" GET fallback always run.
 *   4. Every tool handler is wrapped with `withErrorHandling` so the
 *      friendly-error branches actually fire.
 *   5. BRIEF_FIELDS_BY_ENTITY covers every entity that `client.browse(...)`
 *      is ever called with — keeps response sizes within LLM context limits.
 *   6. `withErrorHandling` preserves handler arity (zero- and one-arg).
 *   7. `formatBrowseResult` produces keyed output when given keyed rows.
 */

import { describe, it, expect, afterEach } from "vitest";
import { z } from "zod";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  browseSchema,
  withErrorHandling,
  formatBrowseResult,
  BRIEF_FIELDS_BY_ENTITY,
} from "../../utils/tool-helpers.js";

const TOOLS_DIR = fileURLToPath(new URL("../../tools/", import.meta.url));
const SOURCE_FILES = readdirSync(TOOLS_DIR).filter((f) => f.endsWith(".ts"));

// ── 1. browseSchema accepts string numerics ────────────────────────────────────

describe("Phase 11 — browseSchema coerces stringified numerics", () => {
  const schema = z.object(browseSchema);

  it("parses { page: '1', pageSize: '25' } cleanly", () => {
    const parsed = schema.parse({ page: "1", pageSize: "25" });
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
    expect(typeof parsed.page).toBe("number");
    expect(typeof parsed.pageSize).toBe("number");
  });

  it("rejects negative or zero page values", () => {
    expect(() => schema.parse({ page: 0 })).toThrow();
    expect(() => schema.parse({ page: -1 })).toThrow();
  });

  it("rejects pageSize > 500", () => {
    expect(() => schema.parse({ pageSize: 501 })).toThrow();
  });

  it("falls back to defaults when omitted", () => {
    const parsed = schema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
  });
});

// ── 2. Per-tool numeric fields coerce ──────────────────────────────────────────

describe("Phase 11 — every tool source file uses z.coerce.number for numerics", () => {
  it("has zero remaining z.number() calls outside docstrings", () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const path = join(TOOLS_DIR, file);
      const text = readFileSync(path, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        // Strip JS-style line comments before matching so docstrings don't trip us up
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*\*\//g, "");
        if (/\bz\.number\s*\(\s*\)/.test(code)) {
          offenders.push(`${file}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

// ── 3. No tool calls client.post on a /browse path ─────────────────────────────

describe("Phase 11 — every browse tool routes through client.browse()", () => {
  it("has zero client.post(\"/api/v1/<x>/browse\", …) call sites in src/tools", () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const path = join(TOOLS_DIR, file);
      const text = readFileSync(path, "utf8");
      // Match `client.post("/api/v1/<entity>/browse"` with optional whitespace
      const regex = /client\.post\s*\(\s*["'`]\/api\/v1\/[^/"'`]+\/browse/g;
      const matches = text.match(regex);
      if (matches) {
        for (const m of matches) offenders.push(`${file}: ${m}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── 4. Every tool handler is wrapped with withErrorHandling ────────────────────

describe("Phase 11 — every server.tool handler is error-wrapped", () => {
  // Either the 4th arg is `withErrorHandling(...)` (custom handler) or
  // `browseTool(...)` (factory which itself wraps with withErrorHandling).
  it("every tool registration uses an error-wrapped or factory-built handler", () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const path = join(TOOLS_DIR, file);
      const text = readFileSync(path, "utf8");
      // Find every server.tool( ... ) registration and inspect the trailing
      // chunk for either `browseTool(` or `withErrorHandling(` before the
      // matching `);`.
      const pattern = /server\.tool\(([\s\S]*?)\n\s*\);/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const body = match[1];
        if (
          !/withErrorHandling\s*\(/.test(body) &&
          !/browseTool\s*\(/.test(body)
        ) {
          // Capture the tool name (first quoted string in the call) for the report
          const nameMatch = /["']([a-z_]+)["']/.exec(body);
          const toolName = nameMatch ? nameMatch[1] : "(unknown)";
          offenders.push(`${file}: ${toolName}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── 5. BRIEF_FIELDS_BY_ENTITY covers every entity browsed ──────────────────────

describe("Phase 11 — BRIEF_FIELDS_BY_ENTITY covers every browseTool entity", () => {
  it("has a brief preset for every entity passed to browseTool() or client.browse()", () => {
    const referenced = new Set<string>();
    // Match both `browseTool("entity"` and `client.browse("entity"` — the
    // dynamic `browse_settings_entity` tool is excluded because the entity
    // name is supplied at runtime by the caller.
    const pattern = /(?:browseTool|client\.browse)\s*\(\s*["']([a-z]+)["']/g;
    for (const file of SOURCE_FILES) {
      const path = join(TOOLS_DIR, file);
      const text = readFileSync(path, "utf8");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        referenced.add(match[1]);
      }
    }
    expect(referenced.size).toBeGreaterThan(20); // sanity: we found a meaningful number
    const missing = [...referenced].filter((e) => !(e in BRIEF_FIELDS_BY_ENTITY));
    expect(missing).toEqual([]);
  });
});

// ── 6. withErrorHandling preserves arity ───────────────────────────────────────

describe("Phase 11 — withErrorHandling preserves handler arity", () => {
  it("zero-arg handler returns ToolResult on throw", async () => {
    const wrapped = withErrorHandling(async () => {
      throw new Error("boom");
    });
    const result = await wrapped();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("boom");
  });

  it("one-arg handler receives args correctly", async () => {
    const wrapped = withErrorHandling(async (args: { name: string }) => ({
      content: [{ type: "text" as const, text: `hi ${args.name}` }],
    }));
    const result = await wrapped({ name: "world" });
    expect(result.content[0].text).toBe("hi world");
    expect(result.isError).toBeUndefined();
  });

  it("Record Not Found surfaces as informational (no isError)", async () => {
    const wrapped = withErrorHandling(async () => {
      throw new Error("API GET /api/v1/order/X failed: 500 - Order Record Not Found. orderid X");
    });
    const result = await wrapped();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Not found");
  });
});

// ── 8. applyClientFilter supports the operators browseSchema accepts ───────────

describe("Phase 11 — applyClientFilter handles every browseSchema operator", () => {
  // Lazy import to avoid pulling browse-helpers into the test top scope
  // (the file is already imported elsewhere; this keeps imports localized).
  const ops: Array<{ op: string; rows: Array<{ x: unknown }>; value: string; expected: number }> = [
    { op: "like",       rows: [{ x: "Apple" }, { x: "Banana" }], value: "an", expected: 1 },
    { op: "contains",   rows: [{ x: "Apple" }, { x: "Banana" }], value: "an", expected: 1 },
    { op: "startswith", rows: [{ x: "Apple" }, { x: "Avocado" }], value: "Av", expected: 1 },
    { op: "endswith",   rows: [{ x: "Apple" }, { x: "Pear" }],  value: "ar", expected: 1 },
    { op: "=",          rows: [{ x: "A" }, { x: "a" }],         value: "A",  expected: 1 },
    { op: "<>",         rows: [{ x: "A" }, { x: "B" }],          value: "A",  expected: 1 },
    // BL-02 + WR-02: numeric operators must filter, not exclude every row
    { op: ">",          rows: [{ x: 1 }, { x: 5 }, { x: 10 }],   value: "4",  expected: 2 },
    { op: ">=",         rows: [{ x: 1 }, { x: 5 }, { x: 10 }],   value: "5",  expected: 2 },
    { op: "<",          rows: [{ x: 1 }, { x: 5 }, { x: 10 }],   value: "5",  expected: 1 },
    { op: "<=",         rows: [{ x: 1 }, { x: 5 }, { x: 10 }],   value: "5",  expected: 2 },
  ];

  it.each(ops)("$op filters as expected", async ({ op, rows, value, expected }) => {
    const { applyClientFilter } = await import("../../utils/browse-helpers.js");
    const filtered = applyClientFilter(rows as Record<string, unknown>[], "x", value, op);
    expect(filtered).toHaveLength(expected);
  });

  it("numeric operators reject non-numeric field values", async () => {
    const { applyClientFilter } = await import("../../utils/browse-helpers.js");
    const filtered = applyClientFilter(
      [{ x: "not a number" }, { x: 10 }],
      "x",
      "5",
      ">",
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].x).toBe(10);
  });
});

// ── 9. GET fallback produces safe pagination on degenerate API responses ───────

describe("Phase 11 — client.browse() GET fallback survives degenerate responses (BL-01)", () => {
  const REAL_FETCH = global.fetch;

  afterEach(() => {
    global.fetch = REAL_FETCH;
  });

  async function makeClient(getResponse: unknown) {
    const { resetClient, getClient } = await import("../../utils/api-client.js");
    resetClient();
    process.env.RENTALWORKS_BASE_URL = "https://example.test";
    process.env.RENTALWORKS_USERNAME = "u";
    process.env.RENTALWORKS_PASSWORD = "p";
    let call = 0;
    global.fetch = (async (url: unknown) => {
      const u = String(url);
      if (u.endsWith("/api/v1/jwt")) {
        return new Response(JSON.stringify({ access_token: "tk" }), { status: 200 });
      }
      // First post hits /browse and returns the RW Invalid-column error;
      // second call is the GET fallback we're testing.
      if (u.includes("/browse")) {
        return new Response(
          JSON.stringify({ Message: "Invalid column name 'foo'." }),
          { status: 500 },
        );
      }
      call += 1;
      return new Response(JSON.stringify(getResponse), { status: 200 });
    }) as typeof global.fetch;
    void call;
    return getClient();
  }

  it("survives PageSize: 0 in the GET response (no Infinity/NaN)", async () => {
    const client = await makeClient({
      Items: [{ a: 1 }, { a: 2 }],
      TotalItems: 2,
      PageNo: 1,
      PageSize: 0, // degenerate
    });
    const data = await client.browse("foo");
    expect(Number.isFinite(data.TotalPages)).toBe(true);
    expect(data.TotalPages).toBeGreaterThanOrEqual(0);
    expect(data.PageSize).toBeGreaterThan(0);
    expect(data.Rows).toHaveLength(2);
  });

  it("survives missing PageSize/TotalItems (defaults to requested page size)", async () => {
    const client = await makeClient({ Items: [] });
    const data = await client.browse("foo", { pagesize: 5 });
    expect(Number.isFinite(data.TotalPages)).toBe(true);
    expect(data.TotalPages).toBe(0);
    expect(data.PageSize).toBe(5);
    expect(data.Rows).toEqual([]);
    expect(data.TotalRows).toBe(0);
  });
});

// ── 10. Search criteria threaded through to client-side filter (BL-02) ─────────

describe("Phase 11 — client.browse() applies client-side filter on Invalid-column retry (BL-02)", () => {
  const REAL_FETCH = global.fetch;

  afterEach(() => {
    global.fetch = REAL_FETCH;
  });

  it("filters retry results by the search criteria the user supplied", async () => {
    const { resetClient, getClient } = await import("../../utils/api-client.js");
    resetClient();
    process.env.RENTALWORKS_BASE_URL = "https://example.test";
    process.env.RENTALWORKS_USERNAME = "u";
    process.env.RENTALWORKS_PASSWORD = "p";

    let postCount = 0;
    global.fetch = (async (url: unknown) => {
      const u = String(url);
      if (u.endsWith("/api/v1/jwt")) {
        return new Response(JSON.stringify({ access_token: "tk" }), { status: 200 });
      }
      if (u.includes("/browse")) {
        postCount += 1;
        if (postCount === 1) {
          // First POST with search fields → server rejects
          return new Response(
            JSON.stringify({ Message: "Invalid column name 'Description'." }),
            { status: 500 },
          );
        }
        // Retry POST without search fields → returns ALL rows
        return new Response(
          JSON.stringify({
            Rows: [
              { Description: "Apple", Id: 1 },
              { Description: "Banana", Id: 2 },
              { Description: "Apricot", Id: 3 },
            ],
            TotalRows: 3,
            PageNo: 1,
            PageSize: 25,
            TotalPages: 1,
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof global.fetch;

    const client = getClient();
    const data = await client.browse("widget", {
      searchfields: ["Description"],
      searchfieldvalues: ["Ap"],
      searchfieldoperators: ["startswith"],
      searchseparators: [""],
    });

    // Must be filtered to rows starting with "Ap" — Apple + Apricot
    expect(data.Rows).toHaveLength(2);
    expect(data.TotalRows).toBe(2);
    const descriptions = data.Rows.map((r) => r.Description as string).sort();
    expect(descriptions).toEqual(["Apple", "Apricot"]);
  });
});

// ── 7. formatBrowseResult produces keyed output ────────────────────────────────

describe("Phase 11 — formatBrowseResult emits keyed lines, not positional", () => {
  it("renders keyed rows with field names", () => {
    const text = formatBrowseResult({
      PageNo: 1,
      PageSize: 1,
      TotalRows: 1,
      TotalPages: 1,
      Rows: [{ OrderId: "A001", Customer: "ACME", Total: 1234 }],
    });
    expect(text).toContain("OrderId: A001");
    expect(text).toContain("Customer: ACME");
    expect(text).toContain("Total: 1234");
    // Must NOT contain positional-array rendering
    expect(text).not.toMatch(/^\d+: /m);
  });

  it("respects field projection", () => {
    const text = formatBrowseResult(
      {
        PageNo: 1,
        PageSize: 1,
        TotalRows: 1,
        TotalPages: 1,
        Rows: [{ OrderId: "A001", Customer: "ACME", Internal: "secret" }],
      },
      { fields: ["OrderId", "Customer"] }
    );
    expect(text).toContain("OrderId: A001");
    expect(text).toContain("Customer: ACME");
    expect(text).not.toContain("Internal");
    expect(text).not.toContain("secret");
  });
});
