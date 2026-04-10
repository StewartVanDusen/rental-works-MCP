import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerInventoryTools } from "../../tools/inventory.js";
import { resetClient } from "../../utils/api-client.js";
import { withErrorHandling } from "../../utils/tool-helpers.js";

let client: Client;

const JWT_RESPONSE = JSON.stringify({
  statuscode: 200,
  statusmessage: "OK",
  access_token: "test-token",
  webusersid: "u1",
  usersid: "u2",
  fullname: "Test",
});

const BROWSE_RESPONSE = JSON.stringify({
  TotalRows: 0,
  PageNo: 1,
  PageSize: 25,
  TotalPages: 0,
  Rows: [],
});

beforeAll(async () => {
  process.env.RENTALWORKS_USERNAME = "test";
  process.env.RENTALWORKS_PASSWORD = "test";

  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerInventoryTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(clientTransport);
});

beforeEach(() => {
  resetClient();
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

// ── TEST-06: API Status Codes ──────────────────────────────────────────────

describe("Error Handling — API Status Codes (TEST-06)", () => {
  it("returns user-friendly message on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      })
    );

    const result = await callTool("browse_rental_inventory");
    const text = (result.content[0] as { type: string; text: string }).text;
    // MCP propagates thrown errors; message contains the status code and is user-readable
    expect(text).toContain("404");
    expect(result.isError).toBe(true);
  });

  it("returns user-friendly message on 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        return new Response("Internal Server Error", { status: 500 });
      })
    );

    const result = await callTool("browse_rental_inventory");
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("500");
    expect(result.isError).toBe(true);
  });

  it("returns user-friendly message on 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        return new Response("Validation failed", { status: 422 });
      })
    );

    const result = await callTool("browse_rental_inventory");
    const text = (result.content[0] as { type: string; text: string }).text;
    // User-readable error message containing the status code
    expect(text).toContain("422");
    expect(result.isError).toBe(true);
  });
});

// ── TEST-07: 401 Re-authentication ─────────────────────────────────────────

describe("Error Handling — 401 Re-authentication (TEST-07)", () => {
  it("re-authenticates on 401 and retries the request", async () => {
    // Expected sequence:
    // 1. jwt (initial auth)      → 200 OK
    // 2. api call (first)        → 401 Unauthorized
    // 3. jwt (re-auth)           → 200 OK
    // 4. api call (retry)        → 200 BROWSE_RESPONSE
    let fetchCallCount = 0;
    let apiCallCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        fetchCallCount++;

        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }

        // Non-JWT API call
        apiCallCount++;
        if (apiCallCount === 1) {
          return new Response("Unauthorized", { status: 401 });
        }
        return new Response(BROWSE_RESPONSE, { status: 200 });
      })
    );

    const result = await callTool("browse_rental_inventory");
    expect(result.isError).toBeFalsy();
    // jwt + api(401) + jwt-reauth + api-retry = 4 fetch calls
    expect(fetchCallCount).toBe(4);
  });

  it("returns error if retry also fails with 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        // API always returns 401
        return new Response("Unauthorized", { status: 401 });
      })
    );

    const result = await callTool("browse_rental_inventory");
    const text = (result.content[0] as { type: string; text: string }).text;
    // User-readable error message containing the status code
    expect(text).toContain("401");
    expect(result.isError).toBe(true);
  });
});

// ── TEST-08: Malformed Responses ───────────────────────────────────────────

describe("Error Handling — Malformed Responses (TEST-08)", () => {
  it("handles HTML error page with status 200 without crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        return new Response("<html><body>Service Error</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      })
    );

    // Should not throw — any result is acceptable as long as it doesn't crash
    const result = await callTool("browse_rental_inventory");
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/not valid JSON|Error/i);
  });

  it("handles empty response body gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        return new Response("", { status: 200 });
      })
    );

    // Empty body returns {} from api-client; the tool attempt to format it does not crash
    // (the MCP server catches any downstream error and returns isError: true rather than throwing)
    const result = await callTool("browse_rental_inventory");
    // The key assertion: the process does not crash/throw unhandled — a result is always returned
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });

  it("handles response with invalid JSON gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/api/v1/jwt")) {
          return new Response(JWT_RESPONSE, { status: 200 });
        }
        return new Response("{{malformed json", { status: 200 });
      })
    );

    const result = await callTool("browse_rental_inventory");
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/not valid JSON|Error/i);
  });
});

// ── TEST-09: Known RW Pattern Detection ───────────────────────────────────

describe("Error Handling — Known RW Pattern Detection (TEST-09)", () => {
  it("detects 'Invalid column name' and returns informational message", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("Invalid column name 'FooBar'");
    });

    const result = await handler();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("FooBar");
    expect(text).toContain("known issue with the RW server");
    // Known patterns are informational — isError must be absent/undefined
    expect(result.isError).toBeUndefined();
  });

  it("detects '503' and returns service unavailable message", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("503 Service Unavailable");
    });

    const result = await handler();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("Service unavailable (503)");
    expect(result.isError).toBeUndefined();
  });

  it("detects '500 NullReference' and returns server error message", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("API POST /foo/bar failed: 500 NullReference");
    });

    const result = await handler();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("NullReferenceException");
    expect(result.isError).toBeUndefined();
  });

  it("returns generic error with isError: true for unknown errors", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("Something unexpected happened");
    });

    const result = await handler();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("Something unexpected happened");
    expect(result.isError).toBe(true);
  });
});
