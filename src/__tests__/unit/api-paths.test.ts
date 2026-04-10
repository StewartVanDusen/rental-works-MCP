import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerInventoryTools } from "../../tools/inventory.js";
import { registerOrderTools } from "../../tools/orders.js";
import { registerContractTools } from "../../tools/contracts.js";
import { registerVendorTools } from "../../tools/vendors.js";
import { registerReportTools } from "../../tools/reports.js";
import { registerStorefrontTools } from "../../tools/storefront.js";
import { registerUtilityTools } from "../../tools/utilities.js";
import { resetClient } from "../../utils/api-client.js";

let client: Client;
let capturedUrl: string;
let capturedMethod: string;

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
  registerInventoryTools(server);
  registerOrderTools(server);
  registerContractTools(server);
  registerVendorTools(server);
  registerReportTools(server);
  registerStorefrontTools(server);
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
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/api/v1/jwt")) {
        return new Response(JWT_RESPONSE, { status: 200 });
      }
      capturedUrl = urlStr;
      capturedMethod = init?.method || "GET";
      return new Response(urlStr.includes("/browse") || urlStr.includes("/runreport") || urlStr.includes("/conflicts")
        ? BROWSE_RESPONSE
        : ENTITY_RESPONSE, { status: 200 });
    })
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

describe("API paths", () => {
  it("get_item_by_barcode → GET .../item/bybarcode?barCode=...", async () => {
    await callTool("get_item_by_barcode", { barcode: "BC001" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/item/bybarcode?barCode=BC001");
  });

  it("get_inventory_availability → GET .../rentalinventory/availabilitylegend (no ID)", async () => {
    await callTool("get_inventory_availability", {});
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/rentalinventory/availabilitylegend");
    expect(capturedUrl).not.toMatch(/rentalinventory\/[^a]/);
  });

  it("cancel_order → POST .../order/cancel/...", async () => {
    await callTool("cancel_order", { orderId: "O1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/order/cancel/O1");
  });

  it("create_invoice_from_order → POST .../order/createinvoice", async () => {
    await callTool("create_invoice_from_order", { orderId: "O1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/order/createinvoice");
    expect(capturedUrl).not.toContain("/O1/");
  });

  it("convert_quote_to_order → POST .../quote/createorder", async () => {
    await callTool("convert_quote_to_order", { quoteId: "Q1", locationId: "L1", warehouseId: "W1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/quote/createorder");
    expect(capturedUrl).not.toContain("/Q1/");
  });

  it("apply_order_discount → POST .../order/applybottomlinediscountpercent", async () => {
    await callTool("apply_order_discount", { orderId: "O1", discountPercent: 10 });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/order/applybottomlinediscountpercent");
    expect(capturedUrl).not.toContain("/O1/");
  });

  it("browse_checked_out_items → POST .../checkedoutitem/browse", async () => {
    await callTool("browse_checked_out_items", {});
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/checkedoutitem/browse");
  });

  it("submit_po_for_approval → POST .../purchaseorder/submitforapproval", async () => {
    await callTool("submit_po_for_approval", { purchaseOrderId: "PO1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/purchaseorder/submitforapproval");
    expect(capturedUrl).not.toContain("/PO1/");
  });

  it("approve_purchase_order → POST .../purchaseorder/firstapprove", async () => {
    await callTool("approve_purchase_order", { purchaseOrderId: "PO1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/purchaseorder/firstapprove");
    expect(capturedUrl).not.toContain("/PO1/");
  });

  it("reject_purchase_order → POST .../purchaseorder/reject", async () => {
    await callTool("reject_purchase_order", { purchaseOrderId: "PO1", rejectReasonNote: "Bad" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/purchaseorder/reject");
    expect(capturedUrl).not.toContain("/PO1/");
  });

  it("run_report_data → POST .../{name}/runreport", async () => {
    await callTool("run_report_data", { reportName: "LateReturnsReport" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/latereturnsreport/runreport");
  });

  it("get_availability_conflicts → POST .../availabilityconflicts/conflicts", async () => {
    await callTool("get_availability_conflicts", {});
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/availabilityconflicts/conflicts");
  });

  it("storefront_browse_catalog → GET .../storefront/catalog", async () => {
    await callTool("storefront_browse_catalog", {});
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/storefront/catalog");
  });

  it("storefront_get_product → GET .../storefront/product/{id}/warehouseid/...", async () => {
    await callTool("storefront_get_product", {
      productId: "P1",
      warehouseId: "W1",
      locationId: "L1",
      fromDate: "2025-01-01",
      toDate: "2025-01-31",
    });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/storefront/product/P1/warehouseid/W1/locationid/L1/fromdate/2025-01-01/todate/2025-01-31");
  });

  it("browse_inventory_purchase_sessions → POST .../inventorypurchasesession/browse", async () => {
    await callTool("browse_inventory_purchase_sessions", {});
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/inventorypurchasesession/browse");
  });

  it("change_icode → POST .../changeicodeutility/changeicode", async () => {
    await callTool("change_icode", { InventoryId: "I1", NewICode: "NEW" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/changeicodeutility/changeicode");
  });

  it("assign_barcodes → POST .../assignbarcodes/assignbarcodes", async () => {
    await callTool("assign_barcodes", { InventoryId: "I1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/assignbarcodes/assignbarcodes");
  });

  it("ai_assistant → POST .../aiassistantutility/ask", async () => {
    await callTool("ai_assistant", { query: "hello" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/aiassistantutility/ask");
  });
});
