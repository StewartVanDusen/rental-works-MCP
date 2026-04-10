import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerInventoryTools } from "../tools/inventory.js";
import { registerOrderTools } from "../tools/orders.js";
import { registerCustomerTools } from "../tools/customers.js";
import { registerContractTools } from "../tools/contracts.js";
import { registerBillingTools } from "../tools/billing.js";
import { registerVendorTools } from "../tools/vendors.js";
import { registerReportTools } from "../tools/reports.js";
import { registerSettingsTools } from "../tools/settings.js";
import { registerAdminTools } from "../tools/admin.js";
import { registerStorefrontTools } from "../tools/storefront.js";
import { registerUtilityTools } from "../tools/utilities.js";

let tools: Array<{ name: string; description?: string; inputSchema: any }>;

beforeAll(async () => {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerInventoryTools(server);
  registerOrderTools(server);
  registerCustomerTools(server);
  registerContractTools(server);
  registerBillingTools(server);
  registerVendorTools(server);
  registerReportTools(server);
  registerSettingsTools(server);
  registerAdminTools(server);
  registerStorefrontTools(server);
  registerUtilityTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(clientTransport);

  const result = await client.listTools();
  tools = result.tools;
});

describe("tool registration", () => {
  it("registers the expected number of tools", () => {
    expect(tools.length).toBe(114);
  });

  it("has no duplicate tool names", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool has a non-empty description", () => {
    for (const tool of tools) {
      expect(tool.description, `${tool.name} missing description`).toBeTruthy();
    }
  });

  it("every tool has inputSchema.type === 'object'", () => {
    for (const tool of tools) {
      expect(tool.inputSchema?.type, `${tool.name} bad inputSchema`).toBe("object");
    }
  });

  it.each([
    "browse_rental_inventory",
    "get_order",
    "browse_customers",
    "cancel_order",
    "run_report",
    "browse_checked_out_items",
    "run_report_data",
    "storefront_get_product",
    "browse_inventory_purchase_sessions",
  ])("registers key tool: %s", (name) => {
    expect(tools.find((t) => t.name === name)).toBeDefined();
  });
});
