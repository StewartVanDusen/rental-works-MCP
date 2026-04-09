/**
 * Settings and Configuration tools
 *
 * Covers: settings-v1 API (1,433 endpoints) - warehouses, categories,
 * crews, discount items, templates, etc.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import {
  browseSchema,
  buildBrowseRequest,
  formatBrowseResult,
  formatEntity,
} from "../utils/tool-helpers.js";

export function registerSettingsTools(server: McpServer) {
  // ── Browse Warehouses ───────────────────────────────────────────────────

  server.tool(
    "browse_warehouses",
    "Browse all warehouses/locations configured in the system.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/warehouse/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Warehouse ───────────────────────────────────────────────────────

  server.tool(
    "get_warehouse",
    "Get details of a specific warehouse.",
    {
      warehouseId: z.string().describe("The warehouse ID"),
    },
    async ({ warehouseId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/warehouse/${warehouseId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Browse Rental Categories ────────────────────────────────────────────

  server.tool(
    "browse_rental_categories",
    "Browse rental inventory categories (e.g. Lighting, Audio, Video, Staging).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/rentalcategory/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Sales Categories ─────────────────────────────────────────────

  server.tool(
    "browse_sales_categories",
    "Browse sales inventory categories.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/salescategory/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Order Types ──────────────────────────────────────────────────

  server.tool(
    "browse_order_types",
    "Browse configured order types (e.g. Rental, Sales, Internal, etc.).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/ordertype/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Crews ────────────────────────────────────────────────────────

  server.tool(
    "browse_crews",
    "Browse crew members (labor/staff that can be assigned to orders).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/crew/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Crew ────────────────────────────────────────────────────────────

  server.tool(
    "get_crew",
    "Get details of a specific crew member.",
    {
      crewId: z.string().describe("The crew member ID"),
    },
    async ({ crewId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/crew/${crewId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Browse Discount Items ───────────────────────────────────────────────

  server.tool(
    "browse_discount_items",
    "Browse discount configurations and templates.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/discountitem/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Templates ────────────────────────────────────────────────────

  server.tool(
    "browse_templates",
    "Browse order templates (pre-configured item lists for common setups).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/template/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Labor Rates ──────────────────────────────────────────────────

  server.tool(
    "browse_labor_rates",
    "Browse configured labor rate categories and their rates.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/laborrate/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get Default Settings ────────────────────────────────────────────────

  server.tool(
    "get_default_settings",
    "Get the system's default settings (default warehouse, office, billing settings, etc.).",
    {},
    async () => {
      const client = getClient();
      const data = await client.get("/api/v1/defaultsettings");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Browse Office Locations ─────────────────────────────────────────────

  server.tool(
    "browse_office_locations",
    "Browse configured office locations.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/officelocation/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse GL Accounts ──────────────────────────────────────────────────

  server.tool(
    "browse_gl_accounts",
    "Browse general ledger accounts configured in the system.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/glaccount/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Generic Settings Browse ─────────────────────────────────────────────

  server.tool(
    "browse_settings_entity",
    `Browse any settings entity by name. Available entities include:
    Crew, DefaultSettings, DiscountItem, DepartmentAccess, StorefrontCatalog,
    RentalCategory, Warehouse, AvailabilitySettings, SalesCategory, PartsCategory,
    LaborCategory, MiscCategory, OrderType, StorageContainer, TaxOption,
    UserAccess, LaborRate, PoApprover, Position, Template, VendorCatalog,
    CrewPosition, DiscountTemplate, GlAccount, OfficeLocation, Building, and more.`,
    {
      entityName: z.string().describe("Settings entity name (e.g. 'crew', 'warehouse', 'rentalcategory')"),
      ...browseSchema,
    },
    async ({ entityName, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post(`/api/v1/${entityName.toLowerCase()}/browse`, request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );
}
