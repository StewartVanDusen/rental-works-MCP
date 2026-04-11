import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAdminTools } from "../../tools/admin.js";
import { resetClient } from "../../utils/api-client.js";

let client: Client;
let capturedUrl: string;
let capturedMethod: string;
let capturedBody: any;

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

const ENTITY_RESPONSE = JSON.stringify({ Id: "123" });

beforeAll(async () => {
  process.env.RENTALWORKS_USERNAME = "test";
  process.env.RENTALWORKS_PASSWORD = "test";

  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerAdminTools(server);

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

afterAll(() => {
  vi.unstubAllGlobals();
});

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

describe("admin tools", () => {
  it("get_session → GET /api/v1/account/session", async () => {
    await callTool("get_session");
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/account/session");
  });

  it("get_account_settings → POST /api/v1/account/getsettings", async () => {
    await callTool("get_account_settings");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/account/getsettings");
  });

  it("browse_users → POST /api/v1/user/browse", async () => {
    await callTool("browse_users");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/user/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_user → GET /api/v1/user/{id}", async () => {
    await callTool("get_user", { userId: "U1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/user/U1");
  });

  it("browse_alerts → POST /api/v1/alert/browse", async () => {
    await callTool("browse_alerts");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/alert/browse");
    expect(capturedBody).not.toBeNull();
  });
});
