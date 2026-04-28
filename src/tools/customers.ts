/**
 * Customer and Contact tools
 *
 * Covers tags: Customer (39 endpoints), Contact (33), Deal (50),
 * Project (37)
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

export function registerCustomerTools(server: McpServer) {
  // ── Browse Customers ────────────────────────────────────────────────────

  server.tool(
    "browse_customers",
    "Search and browse customers. Filter by name, number, city, credit status, etc.",
    browseSchema,
    browseTool("customer")
  );

  // ── Get Customer ────────────────────────────────────────────────────────

  server.tool(
    "get_customer",
    "Get full details of a specific customer including address, credit info, and contacts.",
    {
      customerId: z.string().describe("The customer ID"),
    },
    withErrorHandling(async ({ customerId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/customer/${customerId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Customer ─────────────────────────────────────────────────────

  server.tool(
    "create_customer",
    "Create a new customer record.",
    {
      Customer: z.string().describe("Customer name"),
      Address1: z.string().optional().describe("Street address line 1"),
      Address2: z.string().optional().describe("Street address line 2"),
      City: z.string().optional().describe("City"),
      State: z.string().optional().describe("State/province code"),
      ZipCode: z.string().optional().describe("Zip/postal code"),
      Country: z.string().optional().describe("Country"),
      Phone: z.string().optional().describe("Phone number"),
      Email: z.string().optional().describe("Email address"),
      CreditLimit: z.coerce.number().optional().describe("Credit limit amount"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/customer", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Update Customer ─────────────────────────────────────────────────────

  server.tool(
    "update_customer",
    "Update an existing customer's information.",
    {
      CustomerId: z.string().describe("The customer ID to update"),
      Customer: z.string().optional().describe("Updated name"),
      Address1: z.string().optional(),
      City: z.string().optional(),
      State: z.string().optional(),
      ZipCode: z.string().optional(),
      Phone: z.string().optional(),
      Email: z.string().optional(),
      Inactive: z.coerce.boolean().optional().describe("Set active/inactive"),
    },
    withErrorHandling(async ({ CustomerId, ...updates }) => {
      const client = getClient();
      const data = await client.put<Record<string, unknown>>(`/api/v1/customer/${CustomerId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Contacts ─────────────────────────────────────────────────────

  server.tool(
    "browse_contacts",
    "Search and browse contacts (people associated with customers).",
    browseSchema,
    browseTool("contact")
  );

  // ── Get Contact ─────────────────────────────────────────────────────────

  server.tool(
    "get_contact",
    "Get full details of a specific contact.",
    {
      contactId: z.string().describe("The contact ID"),
    },
    withErrorHandling(async ({ contactId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/contact/${contactId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Contact ──────────────────────────────────────────────────────

  server.tool(
    "create_contact",
    "Create a new contact person linked to a customer.",
    {
      FirstName: z.string().describe("First name"),
      LastName: z.string().describe("Last name"),
      CustomerId: z.string().describe("Customer ID to link to"),
      Title: z.string().optional().describe("Job title"),
      Email: z.string().optional().describe("Email"),
      OfficePhone: z.string().optional().describe("Office phone"),
      MobilePhone: z.string().optional().describe("Mobile phone"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/contact", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Deals ────────────────────────────────────────────────────────

  server.tool(
    "browse_deals",
    "Search and browse deals (events/shows/projects that orders are organized under).",
    browseSchema,
    browseTool("deal")
  );

  // ── Get Deal ────────────────────────────────────────────────────────────

  server.tool(
    "get_deal",
    "Get full details of a specific deal including dates, customer, status, and agent info.",
    {
      dealId: z.string().describe("The deal ID"),
    },
    withErrorHandling(async ({ dealId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/deal/${dealId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Create Deal ─────────────────────────────────────────────────────────

  server.tool(
    "create_deal",
    "Create a new deal (event/show/project container for orders).",
    {
      Deal: z.string().describe("Deal name"),
      CustomerId: z.string().optional().describe("Customer ID"),
      DealTypeId: z.string().optional().describe("Deal type ID"),
      Description: z.string().optional().describe("Description"),
      Location: z.string().optional().describe("Event location"),
      EstimatedStartDate: z.string().optional().describe("Estimated start date"),
      EstimatedEndDate: z.string().optional().describe("Estimated end date"),
      AgentId: z.string().optional().describe("Sales agent ID"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/deal", args);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Update Deal ─────────────────────────────────────────────────────────

  server.tool(
    "update_deal",
    "Update an existing deal's properties.",
    {
      DealId: z.string().describe("The deal ID to update"),
      Deal: z.string().optional().describe("Updated deal name"),
      Description: z.string().optional().describe("Updated description"),
      Location: z.string().optional().describe("Updated location"),
      EstimatedStartDate: z.string().optional(),
      EstimatedEndDate: z.string().optional(),
    },
    withErrorHandling(async ({ DealId, ...updates }) => {
      const client = getClient();
      const data = await client.put<Record<string, unknown>>(`/api/v1/deal/${DealId}`, updates);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Projects ─────────────────────────────────────────────────────

  server.tool(
    "browse_projects",
    "Search and browse projects (larger containers that group multiple deals).",
    browseSchema,
    browseTool("project")
  );

  // ── Get Project ─────────────────────────────────────────────────────────

  server.tool(
    "get_project",
    "Get full details of a specific project.",
    {
      projectId: z.string().describe("The project ID"),
    },
    withErrorHandling(async ({ projectId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/project/${projectId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );
}
