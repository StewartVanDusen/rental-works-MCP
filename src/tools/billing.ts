/**
 * Billing and Invoice tools
 *
 * Covers tags: Invoice (61 endpoints), Billing (18), BillingWorksheet (24),
 * Receipt (33), VendorInvoice (32)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  browseTool,
  formatEntity,
  withErrorHandling,
} from "../utils/tool-helpers.js";

export function registerBillingTools(server: McpServer) {
  // ── Browse Invoices ─────────────────────────────────────────────────────

  server.tool(
    "browse_invoices",
    "Search and browse invoices. Filter by date, customer, deal, status, etc.",
    browseSchema,
    browseTool("invoice")
  );

  // ── Get Invoice ─────────────────────────────────────────────────────────

  server.tool(
    "get_invoice",
    "Get full details of a specific invoice including line items and totals.",
    {
      invoiceId: z.string().describe("The invoice ID"),
    },
    withErrorHandling(async ({ invoiceId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/invoice/${invoiceId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Invoice ──────────────────────────────────────────────────────

  server.tool(
    "create_invoice",
    "Create a new invoice manually.",
    {
      DealId: z.string().optional().describe("Deal ID"),
      OrderId: z.string().optional().describe("Order ID"),
      CustomerId: z.string().optional().describe("Customer ID"),
      BillingStartDate: z.string().optional().describe("Billing period start (YYYY-MM-DD)"),
      BillingEndDate: z.string().optional().describe("Billing period end (YYYY-MM-DD)"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/invoice", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Approve Invoice ─────────────────────────────────────────────────────

  server.tool(
    "approve_invoice",
    "Approve an invoice for processing/sending.",
    {
      invoiceId: z.string().describe("The invoice ID to approve"),
    },
    withErrorHandling(async ({ invoiceId }) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>(`/api/v1/invoice/${invoiceId}/approve`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Process Invoice ─────────────────────────────────────────────────────

  server.tool(
    "process_invoice",
    "Process an approved invoice (post to accounting).",
    {
      invoiceId: z.string().describe("The invoice ID to process"),
    },
    withErrorHandling(async ({ invoiceId }) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>(`/api/v1/invoice/${invoiceId}/process`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Void Invoice ────────────────────────────────────────────────────────

  server.tool(
    "void_invoice",
    "Void an invoice. Creates a credit and reverses the billing.",
    {
      invoiceId: z.string().describe("The invoice ID to void"),
    },
    withErrorHandling(async ({ invoiceId }) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>(`/api/v1/invoice/${invoiceId}/void`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Browse Billing ──────────────────────────────────────────────────────

  server.tool(
    "browse_billing",
    "Browse the billing module - shows orders ready for billing with date ranges and amounts.",
    browseSchema,
    browseTool("billing")
  );

  // ── Billing: Create Estimate ────────────────────────────────────────────

  server.tool(
    "create_billing_estimate",
    "Generate a billing estimate/preview for an order before creating the actual invoice.",
    {
      OrderId: z.string().describe("The order ID to estimate billing for"),
      BillingStartDate: z.string().optional().describe("Billing period start"),
      BillingEndDate: z.string().optional().describe("Billing period end"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/billing/createestimate", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Browse Billing Worksheets ───────────────────────────────────────────

  server.tool(
    "browse_billing_worksheets",
    "Browse billing worksheets (pre-invoice review documents for complex billing).",
    browseSchema,
    browseTool("billingworksheet")
  );

  // ── Browse Receipts (Payments) ──────────────────────────────────────────

  server.tool(
    "browse_receipts",
    "Browse payment receipts. Tracks payments received from customers.",
    browseSchema,
    browseTool("receipt")
  );

  // ── Get Receipt ─────────────────────────────────────────────────────────

  server.tool(
    "get_receipt",
    "Get full details of a payment receipt.",
    {
      receiptId: z.string().describe("The receipt ID"),
    },
    withErrorHandling(async ({ receiptId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/receipt/${receiptId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Vendor Invoices ──────────────────────────────────────────────

  server.tool(
    "browse_vendor_invoices",
    "Browse vendor invoices (bills received from vendors/sub-rentals).",
    browseSchema,
    browseTool("vendorinvoice")
  );

  // ── Get Vendor Invoice ──────────────────────────────────────────────────

  server.tool(
    "get_vendor_invoice",
    "Get details of a specific vendor invoice.",
    {
      vendorInvoiceId: z.string().describe("The vendor invoice ID"),
    },
    withErrorHandling(async ({ vendorInvoiceId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/vendorinvoice/${vendorInvoiceId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );
}
