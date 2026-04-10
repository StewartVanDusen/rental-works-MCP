/**
 * Swagger spec validation — confirms every MCP tool's API path + method
 * exists in the cached Swagger spec.
 *
 * Each test calls a tool, captures the fetch URL, strips the base URL to get
 * the path, and asserts that path+method is found in swagger-cache.json.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerInventoryTools } from "../../tools/inventory.js";
import { registerOrderTools } from "../../tools/orders.js";
import { registerContractTools } from "../../tools/contracts.js";
import { registerCustomerTools } from "../../tools/customers.js";
import { registerBillingTools } from "../../tools/billing.js";
import { registerVendorTools } from "../../tools/vendors.js";
import { registerSettingsTools } from "../../tools/settings.js";
import { registerReportTools } from "../../tools/reports.js";
import { registerAdminTools } from "../../tools/admin.js";
import { registerStorefrontTools } from "../../tools/storefront.js";
import { registerUtilityTools } from "../../tools/utilities.js";
import { resetClient } from "../../utils/api-client.js";

// ── Swagger cache loading ────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache = JSON.parse(
  readFileSync(join(__dirname, "../../../scripts/swagger-cache.json"), "utf8")
);
const specPaths: Array<{ method: string; path: string; spec: string }> = cache.paths;

// ── Path matching utilities ──────────────────────────────────────────────────

/** Convert OpenAPI path template to regex. /api/v1/order/{id} -> /^\/api\/v1\/order\/[^/]+$/ */
function specPathToRegex(specPath: string): RegExp {
  const escaped = specPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\\\{[^}]+\\\}/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
}

/** Check if captured URL path + method exists in the spec */
function urlExistsInSpec(capturedPath: string, capturedMethod: string): boolean {
  const cleanPath = capturedPath.split("?")[0]; // strip query string
  return specPaths.some(
    (entry) => entry.method === capturedMethod && specPathToRegex(entry.path).test(cleanPath)
  );
}

// ── Test fixtures ────────────────────────────────────────────────────────────

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

// ── Server and client ────────────────────────────────────────────────────────

let client: Client;
let capturedUrl: string;
let capturedMethod: string;

beforeAll(async () => {
  process.env.RENTALWORKS_USERNAME = "test";
  process.env.RENTALWORKS_PASSWORD = "test";
  process.env.RENTALWORKS_BASE_URL = "http://test.rentalworks.cloud";

  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerInventoryTools(server);
  registerOrderTools(server);
  registerContractTools(server);
  registerCustomerTools(server);
  registerBillingTools(server);
  registerVendorTools(server);
  registerSettingsTools(server);
  registerReportTools(server);
  registerAdminTools(server);
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
      const isBrowse =
        urlStr.includes("/browse") ||
        urlStr.includes("/runreport") ||
        urlStr.includes("/conflicts") ||
        urlStr.includes("/render") ||
        urlStr.includes("/availabilitylegend");
      return new Response(isBrowse ? BROWSE_RESPONSE : ENTITY_RESPONSE, { status: 200 });
    })
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

/** Strip base URL and return just the path portion */
function capturePath(): string {
  return capturedUrl.replace("http://test.rentalworks.cloud", "");
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("swagger spec validation", () => {
  it("covers all registered tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBe(114);
  });

  // ── Inventory (12 tools) ─────────────────────────────────────────────────

  describe("inventory (12 tools)", () => {
    it("browse_rental_inventory → POST /api/v1/rentalinventory/browse", async () => {
      await callTool("browse_rental_inventory", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_rental_inventory → GET /api/v1/rentalinventory/{id}", async () => {
      await callTool("get_rental_inventory", { inventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_rental_inventory → POST /api/v1/rentalinventory", async () => {
      await callTool("create_rental_inventory", { ICode: "TST", Description: "Test" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("update_rental_inventory → PUT /api/v1/rentalinventory/{id}", async () => {
      await callTool("update_rental_inventory", { InventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("delete_rental_inventory → DELETE /api/v1/rentalinventory/{id}", async () => {
      await callTool("delete_rental_inventory", { inventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_sales_inventory → POST /api/v1/salesinventory/browse", async () => {
      await callTool("browse_sales_inventory", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_sales_inventory → GET /api/v1/salesinventory/{id}", async () => {
      await callTool("get_sales_inventory", { inventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_parts_inventory → POST /api/v1/partsinventory/browse", async () => {
      await callTool("browse_parts_inventory", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_items → POST /api/v1/item/browse", async () => {
      await callTool("browse_items", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_item_by_barcode → GET /api/v1/item/bybarcode", async () => {
      await callTool("get_item_by_barcode", { barcode: "BC001" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_inventory_availability → GET /api/v1/rentalinventory/availabilitylegend", async () => {
      await callTool("get_inventory_availability", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_physical_inventory → POST /api/v1/physicalinventory/browse", async () => {
      await callTool("browse_physical_inventory", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("copy_rental_inventory → POST /api/v1/rentalinventory/{id}/copy", async () => {
      await callTool("copy_rental_inventory", { inventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Orders (12 tools) ────────────────────────────────────────────────────

  describe("orders (12 tools)", () => {
    it("browse_orders → POST /api/v1/order/browse", async () => {
      await callTool("browse_orders", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_order → GET /api/v1/order/{id}", async () => {
      await callTool("get_order", { orderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_order_details → GET /api/v1/order/{id}/orderdetails", async () => {
      await callTool("get_order_details", { orderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_order → POST /api/v1/order", async () => {
      await callTool("create_order", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("update_order → PUT /api/v1/order/{id}", async () => {
      await callTool("update_order", { OrderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("cancel_order → POST /api/v1/order/cancel/{id}", async () => {
      await callTool("cancel_order", { orderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_order_items → POST /api/v1/orderitem/browse", async () => {
      await callTool("browse_order_items", { orderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("add_order_item → POST /api/v1/orderitem", async () => {
      await callTool("add_order_item", { OrderId: "O1", InventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_invoice_from_order → POST /api/v1/order/createinvoice", async () => {
      await callTool("create_invoice_from_order", { orderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("copy_order → POST /api/v1/order/{id}/copytoorder", async () => {
      await callTool("copy_order", { orderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_quotes → POST /api/v1/quote/browse", async () => {
      await callTool("browse_quotes", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_quote → GET /api/v1/quote/{id}", async () => {
      await callTool("get_quote", { quoteId: "Q1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_quote → POST /api/v1/quote", async () => {
      await callTool("create_quote", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("convert_quote_to_order → POST /api/v1/quote/createorder", async () => {
      await callTool("convert_quote_to_order", { quoteId: "Q1", locationId: "L1", warehouseId: "W1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("apply_order_discount → POST /api/v1/order/applybottomlinediscountpercent", async () => {
      await callTool("apply_order_discount", { orderId: "O1", discountPercent: 10 });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Contracts/Checkout/Checkin (12 tools) ───────────────────────────────

  describe("contracts (12 tools)", () => {
    it("browse_contracts → POST /api/v1/contract/browse", async () => {
      await callTool("browse_contracts", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_contract → GET /api/v1/contract/{id}", async () => {
      await callTool("get_contract", { contractId: "C1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_contract_details → GET /api/v1/contract/{id}/contractdetails", async () => {
      await callTool("get_contract_details", { contractId: "C1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("checkout_start_session → POST /api/v1/checkout/startcheckoutcontract", async () => {
      await callTool("checkout_start_session", { OrderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("checkout_stage_item → POST /api/v1/checkout/stageitem", async () => {
      await callTool("checkout_stage_item", { SessionId: "S1", Code: "BC001" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("checkout_stage_all → POST /api/v1/checkout/checkoutallstaged", async () => {
      await callTool("checkout_stage_all", { SessionId: "S1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("checkout_complete → POST /api/v1/checkout/completecheckoutcontract", async () => {
      await callTool("checkout_complete", { SessionId: "S1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_checked_out_items → POST /api/v1/checkedoutitem/browse", async () => {
      await callTool("browse_checked_out_items", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("checkin_start_session → POST /api/v1/checkin/startsession", async () => {
      await callTool("checkin_start_session", { ContractId: "C1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("checkin_item → POST /api/v1/checkin/checkinitem", async () => {
      await callTool("checkin_item", { SessionId: "S1", Code: "BC001" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_transfer_orders → POST /api/v1/transferorder/browse", async () => {
      await callTool("browse_transfer_orders", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_transfer_order → GET /api/v1/transferorder/{id}", async () => {
      await callTool("get_transfer_order", { transferOrderId: "T1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_repairs → POST /api/v1/repair/browse", async () => {
      await callTool("browse_repairs", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_repair → GET /api/v1/repair/{id}", async () => {
      await callTool("get_repair", { repairId: "R1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Customers (11 tools) ─────────────────────────────────────────────────

  describe("customers (11 tools)", () => {
    it("browse_customers → POST /api/v1/customer/browse", async () => {
      await callTool("browse_customers", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_customer → GET /api/v1/customer/{id}", async () => {
      await callTool("get_customer", { customerId: "CU1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_customer → POST /api/v1/customer", async () => {
      await callTool("create_customer", { Customer: "Test Co" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("update_customer → PUT /api/v1/customer/{id}", async () => {
      await callTool("update_customer", { CustomerId: "CU1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_contacts → POST /api/v1/contact/browse", async () => {
      await callTool("browse_contacts", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_contact → GET /api/v1/contact/{id}", async () => {
      await callTool("get_contact", { contactId: "CO1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_contact → POST /api/v1/contact", async () => {
      await callTool("create_contact", { FirstName: "Jane", LastName: "Doe", CustomerId: "CU1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_deals → POST /api/v1/deal/browse", async () => {
      await callTool("browse_deals", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_deal → GET /api/v1/deal/{id}", async () => {
      await callTool("get_deal", { dealId: "D1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_deal → POST /api/v1/deal", async () => {
      await callTool("create_deal", { Deal: "Test Deal" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("update_deal → PUT /api/v1/deal/{id}", async () => {
      await callTool("update_deal", { DealId: "D1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_projects → POST /api/v1/project/browse", async () => {
      await callTool("browse_projects", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_project → GET /api/v1/project/{id}", async () => {
      await callTool("get_project", { projectId: "P1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Billing (11 tools) ───────────────────────────────────────────────────

  describe("billing (11 tools)", () => {
    it("browse_invoices → POST /api/v1/invoice/browse", async () => {
      await callTool("browse_invoices", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_invoice → GET /api/v1/invoice/{id}", async () => {
      await callTool("get_invoice", { invoiceId: "INV1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_invoice → POST /api/v1/invoice", async () => {
      await callTool("create_invoice", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("approve_invoice → POST /api/v1/invoice/{id}/approve", async () => {
      await callTool("approve_invoice", { invoiceId: "INV1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("process_invoice → POST /api/v1/invoice/{id}/process", async () => {
      await callTool("process_invoice", { invoiceId: "INV1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("void_invoice → POST /api/v1/invoice/{id}/void", async () => {
      await callTool("void_invoice", { invoiceId: "INV1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_billing → POST /api/v1/billing/browse", async () => {
      await callTool("browse_billing", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_billing_estimate → POST /api/v1/billing/createestimate", async () => {
      await callTool("create_billing_estimate", { OrderId: "O1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_billing_worksheets → POST /api/v1/billingworksheet/browse", async () => {
      await callTool("browse_billing_worksheets", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_receipts → POST /api/v1/receipt/browse", async () => {
      await callTool("browse_receipts", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_receipt → GET /api/v1/receipt/{id}", async () => {
      await callTool("get_receipt", { receiptId: "REC1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_vendor_invoices → POST /api/v1/vendorinvoice/browse", async () => {
      await callTool("browse_vendor_invoices", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_vendor_invoice → GET /api/v1/vendorinvoice/{id}", async () => {
      await callTool("get_vendor_invoice", { vendorInvoiceId: "VI1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Vendors (7 tools) ────────────────────────────────────────────────────

  describe("vendors (7 tools)", () => {
    it("browse_vendors → POST /api/v1/vendor/browse", async () => {
      await callTool("browse_vendors", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_vendor → GET /api/v1/vendor/{id}", async () => {
      await callTool("get_vendor", { vendorId: "V1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_vendor → POST /api/v1/vendor", async () => {
      await callTool("create_vendor", { Vendor: "Test Vendor" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_purchase_orders → POST /api/v1/purchaseorder/browse", async () => {
      await callTool("browse_purchase_orders", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_purchase_order → GET /api/v1/purchaseorder/{id}", async () => {
      await callTool("get_purchase_order", { purchaseOrderId: "PO1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("create_purchase_order → POST /api/v1/purchaseorder", async () => {
      await callTool("create_purchase_order", { VendorId: "V1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("submit_po_for_approval → POST /api/v1/purchaseorder/submitforapproval", async () => {
      await callTool("submit_po_for_approval", { purchaseOrderId: "PO1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("approve_purchase_order → POST /api/v1/purchaseorder/firstapprove", async () => {
      await callTool("approve_purchase_order", { purchaseOrderId: "PO1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("reject_purchase_order → POST /api/v1/purchaseorder/reject", async () => {
      await callTool("reject_purchase_order", { purchaseOrderId: "PO1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Settings (13 tools) ──────────────────────────────────────────────────

  describe("settings (13 tools)", () => {
    it("browse_warehouses → POST /api/v1/warehouse/browse", async () => {
      await callTool("browse_warehouses", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_warehouse → GET /api/v1/warehouse/{id}", async () => {
      await callTool("get_warehouse", { warehouseId: "W1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_rental_categories → POST /api/v1/rentalcategory/browse", async () => {
      await callTool("browse_rental_categories", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_sales_categories → POST /api/v1/salescategory/browse", async () => {
      await callTool("browse_sales_categories", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_order_types → POST /api/v1/ordertype/browse", async () => {
      await callTool("browse_order_types", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_crews → POST /api/v1/crew/browse", async () => {
      await callTool("browse_crews", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_crew → GET /api/v1/crew/{id}", async () => {
      await callTool("get_crew", { crewId: "CR1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_discount_items → POST /api/v1/discountitem/browse", async () => {
      await callTool("browse_discount_items", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_templates → POST /api/v1/template/browse", async () => {
      await callTool("browse_templates", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_labor_rates → POST /api/v1/laborrate/browse", async () => {
      await callTool("browse_labor_rates", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_default_settings → GET /api/v1/defaultsettings", async () => {
      await callTool("get_default_settings", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_office_locations → POST /api/v1/officelocation/browse", async () => {
      await callTool("browse_office_locations", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_gl_accounts → POST /api/v1/glaccount/browse", async () => {
      await callTool("browse_gl_accounts", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_settings_entity → POST /api/v1/warehouse/browse (generic entity)", async () => {
      await callTool("browse_settings_entity", { entityName: "warehouse" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Reports (7 tools) ────────────────────────────────────────────────────

  describe("reports (7 tools)", () => {
    it("run_report → POST /api/v1/{name}/render", async () => {
      await callTool("run_report", { reportName: "LateReturnsReport" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("run_report_data → POST /api/v1/{name}/runreport", async () => {
      await callTool("run_report_data", { reportName: "LateReturnsReport" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("export_report_excel → POST /api/v1/{name}/exportexcelxlsx", async () => {
      await callTool("export_report_excel", { reportName: "LateReturnsReport" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_ar_aging → POST /api/v1/aragingreport/render", async () => {
      await callTool("get_ar_aging", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_late_returns → POST /api/v1/latereturnsreport/render", async () => {
      await callTool("get_late_returns", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_availability_conflicts → POST /api/v1/availabilityconflicts/conflicts", async () => {
      await callTool("get_availability_conflicts", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Admin (5 tools) ──────────────────────────────────────────────────────

  describe("admin (5 tools)", () => {
    it("get_session → GET /api/v1/account/session", async () => {
      await callTool("get_session", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_account_settings → POST /api/v1/account/getsettings", async () => {
      await callTool("get_account_settings", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_users → POST /api/v1/user/browse", async () => {
      await callTool("browse_users", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("get_user → GET /api/v1/user/{id}", async () => {
      await callTool("get_user", { userId: "U1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_alerts → POST /api/v1/alert/browse", async () => {
      await callTool("browse_alerts", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Storefront (3 tools) ─────────────────────────────────────────────────

  describe("storefront (3 tools)", () => {
    it("storefront_browse_catalog → GET /api/v1/storefront/catalog", async () => {
      await callTool("storefront_browse_catalog", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("storefront_get_product → GET /api/v1/storefront/product/{id}/...", async () => {
      await callTool("storefront_get_product", {
        productId: "P1",
        warehouseId: "W1",
        locationId: "L1",
        fromDate: "2025-01-01",
        toDate: "2025-01-31",
      });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("storefront_browse_categories → POST /api/v1/storefrontcatalog/browse", async () => {
      await callTool("storefront_browse_categories", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });

  // ── Utilities (9 tools) ──────────────────────────────────────────────────

  describe("utilities (9 tools)", () => {
    it("browse_inventory_purchase_sessions → POST /api/v1/inventorypurchasesession/browse", async () => {
      await callTool("browse_inventory_purchase_sessions", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("change_icode → POST /api/v1/changeicodeutility/changeicode", async () => {
      await callTool("change_icode", { InventoryId: "I1", NewICode: "NEW" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("assign_barcodes → POST /api/v1/assignbarcodes/assignbarcodes", async () => {
      await callTool("assign_barcodes", { InventoryId: "I1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("browse_label_designs → POST /api/v1/labeldesign/browse", async () => {
      await callTool("browse_label_designs", {});
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("ai_assistant → POST /api/v1/aiassistantutility/ask", async () => {
      await callTool("ai_assistant", { query: "hello" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("raw_api_browse → POST /api/v1/order/browse (passthrough)", async () => {
      await callTool("raw_api_browse", { entity: "order" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("raw_api_get → GET /api/v1/order/{id} (passthrough)", async () => {
      await callTool("raw_api_get", { path: "/api/v1/order/X1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("raw_api_post → POST /api/v1/order/browse (passthrough)", async () => {
      await callTool("raw_api_post", { path: "/api/v1/order/browse", body: "{}" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });

    it("sync_to_quickbooks → POST /api/v1/{entity}/synctoqbo", async () => {
      await callTool("sync_to_quickbooks", { entityType: "customer", entityId: "CU1" });
      expect(urlExistsInSpec(capturePath(), capturedMethod)).toBe(true);
    });
  });
});
