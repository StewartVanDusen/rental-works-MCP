import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerOrderTools } from "../tools/orders.js";
import { registerVendorTools } from "../tools/vendors.js";
import { resetClient } from "../utils/api-client.js";

let client: Client;
let capturedBody: any;
let capturedMethod: string;

const JWT_RESPONSE = JSON.stringify({
  statuscode: 200,
  statusmessage: "OK",
  access_token: "test-token",
  webusersid: "u1",
  usersid: "u2",
  fullname: "Test",
});

const ENTITY_RESPONSE = JSON.stringify({ Id: "123" });

beforeAll(async () => {
  process.env.RENTALWORKS_USERNAME = "test";
  process.env.RENTALWORKS_PASSWORD = "test";

  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerOrderTools(server);
  registerVendorTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(clientTransport);
});

beforeEach(() => {
  resetClient();
  capturedBody = null;
  capturedMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/api/v1/jwt")) {
        return new Response(JWT_RESPONSE, { status: 200 });
      }
      capturedMethod = init?.method || "GET";
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string);
      }
      return new Response(ENTITY_RESPONSE, { status: 200 });
    })
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function callTool(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

describe("request bodies", () => {
  it("create_invoice_from_order sends { OrderId }", async () => {
    await callTool("create_invoice_from_order", { orderId: "O1" });
    expect(capturedBody).toEqual({ OrderId: "O1" });
  });

  it("apply_order_discount sends { OrderId, DiscountPercent }", async () => {
    await callTool("apply_order_discount", { orderId: "O1", discountPercent: 15 });
    expect(capturedBody).toEqual({ OrderId: "O1", DiscountPercent: 15 });
  });

  it("convert_quote_to_order sends { QuoteId, LocationId, WarehouseId }", async () => {
    await callTool("convert_quote_to_order", { quoteId: "Q1", locationId: "L1", warehouseId: "W1" });
    expect(capturedBody).toEqual({ QuoteId: "Q1", LocationId: "L1", WarehouseId: "W1" });
  });

  it("submit_po_for_approval sends { PurchaseOrderId }", async () => {
    await callTool("submit_po_for_approval", { purchaseOrderId: "PO1" });
    expect(capturedBody).toEqual({ PurchaseOrderId: "PO1" });
  });

  it("approve_purchase_order sends { PurchaseOrderId }", async () => {
    await callTool("approve_purchase_order", { purchaseOrderId: "PO1" });
    expect(capturedBody).toEqual({ PurchaseOrderId: "PO1" });
  });

  it("reject_purchase_order sends { PurchaseOrderId, RejectReasonNote }", async () => {
    await callTool("reject_purchase_order", { purchaseOrderId: "PO1", rejectReasonNote: "Bad quality" });
    expect(capturedBody).toEqual({ PurchaseOrderId: "PO1", RejectReasonNote: "Bad quality" });
  });

  it("cancel_order uses POST method (not DELETE)", async () => {
    await callTool("cancel_order", { orderId: "O1" });
    expect(capturedMethod).toBe("POST");
  });
});
