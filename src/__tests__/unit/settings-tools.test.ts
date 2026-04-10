import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerSettingsTools } from "../../tools/settings.js";
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
  registerSettingsTools(server);

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

describe("settings tools", () => {
  it("browse_warehouses → POST /api/v1/warehouse/browse", async () => {
    await callTool("browse_warehouses");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/warehouse/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_warehouse → GET /api/v1/warehouse/{id}", async () => {
    await callTool("get_warehouse", { warehouseId: "W1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/warehouse/W1");
  });

  it("browse_rental_categories → POST /api/v1/rentalcategory/browse", async () => {
    await callTool("browse_rental_categories");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/rentalcategory/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_sales_categories → POST /api/v1/salescategory/browse", async () => {
    await callTool("browse_sales_categories");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/salescategory/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_order_types → POST /api/v1/ordertype/browse", async () => {
    await callTool("browse_order_types");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/ordertype/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_crews → POST /api/v1/crew/browse", async () => {
    await callTool("browse_crews");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/crew/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_crew → GET /api/v1/crew/{id}", async () => {
    await callTool("get_crew", { crewId: "CR1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/crew/CR1");
  });

  it("browse_discount_items → POST /api/v1/discountitem/browse", async () => {
    await callTool("browse_discount_items");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/discountitem/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_templates → POST /api/v1/template/browse", async () => {
    await callTool("browse_templates");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/template/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_labor_rates → POST /api/v1/laborrate/browse", async () => {
    await callTool("browse_labor_rates");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/laborrate/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_default_settings → GET /api/v1/defaultsettings", async () => {
    await callTool("get_default_settings");
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/defaultsettings");
  });

  it("browse_office_locations → POST /api/v1/officelocation/browse", async () => {
    await callTool("browse_office_locations");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/officelocation/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_gl_accounts → POST /api/v1/glaccount/browse", async () => {
    await callTool("browse_gl_accounts");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/glaccount/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("browse_settings_entity → POST /api/v1/{entityName}/browse", async () => {
    await callTool("browse_settings_entity", { entityName: "taxoption" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/taxoption/browse");
    expect(capturedBody).not.toBeNull();
  });
});
