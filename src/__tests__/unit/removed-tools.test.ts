import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerInventoryTools } from "../../tools/inventory.js";
import { registerOrderTools } from "../../tools/orders.js";
import { registerCustomerTools } from "../../tools/customers.js";
import { registerContractTools } from "../../tools/contracts.js";
import { registerBillingTools } from "../../tools/billing.js";
import { registerVendorTools } from "../../tools/vendors.js";
import { registerReportTools } from "../../tools/reports.js";
import { registerSettingsTools } from "../../tools/settings.js";
import { registerAdminTools } from "../../tools/admin.js";
import { registerStorefrontTools } from "../../tools/storefront.js";
import { registerUtilityTools } from "../../tools/utilities.js";

let toolNames: string[];

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
  toolNames = result.tools.map((t) => t.name);
});

describe("removed tools", () => {
  it.each([
    "browse_order_status",
    "browse_activity",
    "delete_order",
  ])("does NOT register removed tool: %s", (name) => {
    expect(toolNames).not.toContain(name);
  });
});
