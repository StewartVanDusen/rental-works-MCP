/**
 * Vendor and Purchase Order tools
 *
 * Covers tags: Vendor (38 endpoints), PurchaseOrder (59)
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

export function registerVendorTools(server: McpServer) {
  // ── Browse Vendors ──────────────────────────────────────────────────────

  server.tool(
    "browse_vendors",
    "Search and browse vendors (sub-rental houses, suppliers, service providers).",
    browseSchema,
    browseTool("vendor")
  );

  // ── Get Vendor ──────────────────────────────────────────────────────────

  server.tool(
    "get_vendor",
    "Get full details of a specific vendor.",
    {
      vendorId: z.string().describe("The vendor ID"),
    },
    withErrorHandling(async ({ vendorId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/vendor/${vendorId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Vendor ───────────────────────────────────────────────────────

  server.tool(
    "create_vendor",
    "Create a new vendor record.",
    {
      Vendor: z.string().describe("Vendor name"),
      Address1: z.string().optional().describe("Street address"),
      City: z.string().optional().describe("City"),
      State: z.string().optional().describe("State/province"),
      ZipCode: z.string().optional().describe("Zip/postal code"),
      Phone: z.string().optional().describe("Phone number"),
      Email: z.string().optional().describe("Email address"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/vendor", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Purchase Orders ──────────────────────────────────────────────

  server.tool(
    "browse_purchase_orders",
    "Search and browse purchase orders (sub-rentals and vendor purchases).",
    browseSchema,
    browseTool("purchaseorder")
  );

  // ── Get Purchase Order ──────────────────────────────────────────────────

  server.tool(
    "get_purchase_order",
    "Get full details of a specific purchase order including vendor info and totals.",
    {
      purchaseOrderId: z.string().describe("The purchase order ID"),
    },
    withErrorHandling(async ({ purchaseOrderId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/purchaseorder/${purchaseOrderId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Purchase Order ───────────────────────────────────────────────

  server.tool(
    "create_purchase_order",
    "Create a new purchase order for a vendor.",
    {
      VendorId: z.string().describe("Vendor ID"),
      DealId: z.string().optional().describe("Associated deal ID"),
      OrderId: z.string().optional().describe("Associated order ID"),
      Description: z.string().optional().describe("PO description"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/purchaseorder", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── PO Approval Flow ───────────────────────────────────────────────────

  server.tool(
    "submit_po_for_approval",
    "Submit a purchase order for the approval workflow.",
    {
      purchaseOrderId: z.string().describe("The PO ID to submit"),
    },
    withErrorHandling(async ({ purchaseOrderId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/purchaseorder/submitforapproval", { PurchaseOrderId: purchaseOrderId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  server.tool(
    "approve_purchase_order",
    "First-level approve a purchase order.",
    {
      purchaseOrderId: z.string().describe("The PO ID to approve"),
    },
    withErrorHandling(async ({ purchaseOrderId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/purchaseorder/firstapprove", { PurchaseOrderId: purchaseOrderId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  server.tool(
    "reject_purchase_order",
    "Reject a purchase order in the approval workflow.",
    {
      purchaseOrderId: z.string().describe("The PO ID to reject"),
      rejectReasonNote: z.string().optional().describe("Rejection reason note"),
      rejectReasonId: z.string().optional().describe("Rejection reason ID"),
    },
    withErrorHandling(async ({ purchaseOrderId, rejectReasonNote, rejectReasonId }) => {
      const client = getClient();
      const data = await client.post("/api/v1/purchaseorder/reject", {
        PurchaseOrderId: purchaseOrderId,
        RejectReasonNote: rejectReasonNote,
        ...(rejectReasonId ? { RejectReasonId: rejectReasonId } : {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );
}
