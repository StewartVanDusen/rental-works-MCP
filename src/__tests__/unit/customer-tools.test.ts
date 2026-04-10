import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerCustomerTools } from "../../tools/customers.js";
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
  registerCustomerTools(server);

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

describe("customer tools", () => {
  it("browse_customers → POST /api/v1/customer/browse", async () => {
    await callTool("browse_customers");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/customer/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_customer → GET /api/v1/customer/{id}", async () => {
    await callTool("get_customer", { customerId: "C1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/customer/C1");
  });

  it("create_customer → POST /api/v1/customer with body", async () => {
    await callTool("create_customer", { Customer: "Test Co", Address1: "123 Main" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toMatch(/\/api\/v1\/customer$/);
    expect(capturedBody).toEqual(expect.objectContaining({ Customer: "Test Co", Address1: "123 Main" }));
  });

  it("update_customer → PUT /api/v1/customer/{id} with updates", async () => {
    await callTool("update_customer", { CustomerId: "C1", Customer: "Updated Co" });
    expect(capturedMethod).toBe("PUT");
    expect(capturedUrl).toContain("/api/v1/customer/C1");
    expect(capturedBody).toEqual(expect.objectContaining({ Customer: "Updated Co" }));
  });

  it("browse_contacts → POST /api/v1/contact/browse", async () => {
    await callTool("browse_contacts");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/contact/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_contact → GET /api/v1/contact/{id}", async () => {
    await callTool("get_contact", { contactId: "CT1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/contact/CT1");
  });

  it("create_contact → POST /api/v1/contact with body", async () => {
    await callTool("create_contact", { FirstName: "John", LastName: "Doe", CustomerId: "C1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toMatch(/\/api\/v1\/contact$/);
    expect(capturedBody).toEqual(expect.objectContaining({ FirstName: "John", LastName: "Doe" }));
  });

  it("browse_deals → POST /api/v1/deal/browse", async () => {
    await callTool("browse_deals");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/deal/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_deal → GET /api/v1/deal/{id}", async () => {
    await callTool("get_deal", { dealId: "D1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/deal/D1");
  });

  it("create_deal → POST /api/v1/deal with body", async () => {
    await callTool("create_deal", { Deal: "Test Deal", CustomerId: "C1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toMatch(/\/api\/v1\/deal$/);
    expect(capturedBody).toEqual(expect.objectContaining({ Deal: "Test Deal", CustomerId: "C1" }));
  });

  it("update_deal → PUT /api/v1/deal/{id} with updates", async () => {
    await callTool("update_deal", { DealId: "D1", Deal: "Updated" });
    expect(capturedMethod).toBe("PUT");
    expect(capturedUrl).toContain("/api/v1/deal/D1");
    expect(capturedBody).toEqual(expect.objectContaining({ Deal: "Updated" }));
  });

  it("browse_projects → POST /api/v1/project/browse", async () => {
    await callTool("browse_projects");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/project/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_project → GET /api/v1/project/{id}", async () => {
    await callTool("get_project", { projectId: "P1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/project/P1");
  });
});
