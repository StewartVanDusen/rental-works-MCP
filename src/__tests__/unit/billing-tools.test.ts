import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerBillingTools } from "../../tools/billing.js";
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
  registerBillingTools(server);

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

describe("billing tools", () => {
  it("browse_invoices → POST /api/v1/invoice/browse", async () => {
    await callTool("browse_invoices");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/invoice/browse");
    expect(capturedBody).not.toBeNull();
  });

  it("get_invoice → GET /api/v1/invoice/{id}", async () => {
    await callTool("get_invoice", { invoiceId: "INV1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/invoice/INV1");
  });

  it("create_invoice → POST /api/v1/invoice with body fields", async () => {
    await callTool("create_invoice", { DealId: "D1", OrderId: "O1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/invoice");
    expect(capturedUrl).not.toContain("/invoice/browse");
    expect(capturedUrl).not.toContain("/invoice/INV");
    expect(capturedBody).toEqual(expect.objectContaining({ DealId: "D1", OrderId: "O1" }));
  });

  it("approve_invoice → POST /api/v1/invoice/{id}/approve", async () => {
    await callTool("approve_invoice", { invoiceId: "INV1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/invoice/INV1/approve");
  });

  it("process_invoice → POST /api/v1/invoice/{id}/process", async () => {
    await callTool("process_invoice", { invoiceId: "INV1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/invoice/INV1/process");
  });

  it("void_invoice → POST /api/v1/invoice/{id}/void", async () => {
    await callTool("void_invoice", { invoiceId: "INV1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/invoice/INV1/void");
  });

  it("browse_billing → POST /api/v1/billing/browse", async () => {
    await callTool("browse_billing");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/billing/browse");
  });

  it("create_billing_estimate → POST /api/v1/billing/createestimate with { OrderId }", async () => {
    await callTool("create_billing_estimate", { OrderId: "O1" });
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/billing/createestimate");
    expect(capturedBody).toEqual(expect.objectContaining({ OrderId: "O1" }));
  });

  it("browse_billing_worksheets → POST /api/v1/billingworksheet/browse", async () => {
    await callTool("browse_billing_worksheets");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/billingworksheet/browse");
  });

  it("browse_receipts → POST /api/v1/receipt/browse", async () => {
    await callTool("browse_receipts");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/receipt/browse");
  });

  it("get_receipt → GET /api/v1/receipt/{id}", async () => {
    await callTool("get_receipt", { receiptId: "R1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/receipt/R1");
  });

  it("browse_vendor_invoices → POST /api/v1/vendorinvoice/browse", async () => {
    await callTool("browse_vendor_invoices");
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/api/v1/vendorinvoice/browse");
  });

  it("get_vendor_invoice → GET /api/v1/vendorinvoice/{id}", async () => {
    await callTool("get_vendor_invoice", { vendorInvoiceId: "VI1" });
    expect(capturedMethod).toBe("GET");
    expect(capturedUrl).toContain("/api/v1/vendorinvoice/VI1");
  });
});
