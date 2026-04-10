import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAddressTools } from "../../tools/addresses.js";
import { registerUtilityTools } from "../../tools/utilities.js";
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
  registerAddressTools(server);
  registerUtilityTools(server);

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

describe("address tools", () => {
  it("browse_addresses → POST /api/v1/address/browse", async () => {
    await callTool("browse_addresses");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/address/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_address → GET /api/v1/address/{id}", async () => {
    await callTool("get_address", { addressId: "A1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/address/A1");
  });

  it("create_address → POST /api/v1/address with body", async () => {
    await callTool("create_address", { Address1: "123 Main St" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toMatch(/\/api\/v1\/address$/);
    expect(capturedBody).toEqual(expect.objectContaining({ Address1: "123 Main St" }));
  });

  it("update_address → PUT /api/v1/address/{id} with updates", async () => {
    await callTool("update_address", { AddressId: "A1", City: "Portland" });
    expect(capturedMethod).toBe("PUT");
    expect(capturedUrl).toContain("/api/v1/address/A1");
    expect(capturedBody).toEqual(expect.objectContaining({ City: "Portland" }));
  });

  it("delete_address → DELETE /api/v1/address/{id}", async () => {
    await callTool("delete_address", { addressId: "A1" });
    expect(capturedMethod).toBe("DELETE");
    expect(capturedUrl).toContain("/api/v1/address/A1");
  });
});

describe("change order status tool", () => {
  it("change_order_status → POST /api/v1/changeorderstatus/changestatus", async () => {
    await callTool("change_order_status", { OrderId: "O1", StatusId: "S1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/changeorderstatus/changestatus");
    expect(capturedBody).toEqual(expect.objectContaining({ OrderId: "O1", StatusId: "S1" }));
  });
});
