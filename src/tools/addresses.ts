/**
 * Address management tools
 *
 * Covers: home-v1 Address endpoints
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

export function registerAddressTools(server: McpServer) {
  // ── Browse Addresses ────────────────────────────────────────────────────

  server.tool(
    "browse_addresses",
    "Search and browse address records.",
    browseSchema,
    browseTool("address")
  );

  // ── Get Address ─────────────────────────────────────────────────────────

  server.tool(
    "get_address",
    "Get full details of a specific address.",
    {
      addressId: z.string().describe("The address ID"),
    },
    withErrorHandling(async ({ addressId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/address/${addressId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Address ──────────────────────────────────────────────────────

  server.tool(
    "create_address",
    "Create a new address record.",
    {
      Address1: z.string().describe("Street address line 1"),
      Address2: z.string().optional().describe("Street address line 2"),
      City: z.string().optional().describe("City"),
      State: z.string().optional().describe("State/province code"),
      ZipCode: z.string().optional().describe("Zip/postal code"),
      Country: z.string().optional().describe("Country"),
      Phone: z.string().optional().describe("Phone number"),
      Email: z.string().optional().describe("Email address"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/address", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Update Address ──────────────────────────────────────────────────────

  server.tool(
    "update_address",
    "Update an existing address.",
    {
      AddressId: z.string().describe("The address ID"),
      Address1: z.string().optional().describe("Street address line 1"),
      Address2: z.string().optional().describe("Street address line 2"),
      City: z.string().optional().describe("City"),
      State: z.string().optional().describe("State/province code"),
      ZipCode: z.string().optional().describe("Zip/postal code"),
      Country: z.string().optional().describe("Country"),
      Phone: z.string().optional().describe("Phone number"),
      Email: z.string().optional().describe("Email address"),
    },
    withErrorHandling(async ({ AddressId, ...updates }) => {
      const client = getClient();
      const data = await client.put<Record<string, unknown>>(`/api/v1/address/${AddressId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Delete Address ──────────────────────────────────────────────────────

  server.tool(
    "delete_address",
    "Delete an address record.",
    {
      addressId: z.string().describe("The address ID to delete"),
    },
    withErrorHandling(async ({ addressId }) => {
      const client = getClient();
      await client.delete(`/api/v1/address/${addressId}`);
      return { content: [{ type: "text", text: `Address ${addressId} deleted.` }] };
    })
  );
}
