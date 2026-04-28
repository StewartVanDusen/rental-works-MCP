/**
 * Shared helpers for building MCP tool definitions from RentalWorks patterns.
 *
 * Design notes:
 * - browseSchema uses z.coerce.number() for paging fields. LLM tool calls
 *   commonly stringify numerics ("1" instead of 1); strict z.number() rejects
 *   them with MCP error -32602 before any HTTP call. Coercion keeps the wire
 *   contract "number" while accepting both forms from the transport layer.
 * - browseTool() / errorHandled() are the only sanctioned ways to register
 *   handlers. Both wrap with withErrorHandling so the friendly-error branches
 *   for "Invalid column name", "503", "500 NullReference", and
 *   "Record Not Found" actually fire — they were dead code before.
 */

import { z } from "zod";
import { projectFields } from "./browse-helpers.js";
import { getClient } from "./api-client.js";
import type { BrowseResponse } from "../types/api.js";

// ── Browse input schema ────────────────────────────────────────────────────────

/**
 * Common browse input schema fields used by every browse endpoint.
 *
 * `page` and `pageSize` use z.coerce.number() so MCP transports that pass
 * stringified numerics ("1") still parse — this is the dominant LLM behavior.
 */
export const browseSchema = {
  page: z
    .coerce.number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Page number (default: 1)"),
  pageSize: z
    .coerce.number()
    .int()
    .positive()
    .max(500)
    .optional()
    .default(25)
    .describe("Results per page (default: 25, max: 500)"),
  searchField: z
    .string()
    .optional()
    .describe("Field name to search (e.g. 'Description', 'Customer', 'ICode')"),
  searchValue: z
    .string()
    .optional()
    .describe("Value to search for in the specified field"),
  searchOperator: z
    .enum(["like", "=", "<>", ">", ">=", "<", "<=", "startswith", "endswith", "contains"])
    .optional()
    .default("like")
    .describe("Search comparison operator (default: 'like')"),
  orderBy: z
    .string()
    .optional()
    .describe("Field name to sort by"),
  orderByDirection: z
    .enum(["asc", "desc"])
    .optional()
    .default("asc")
    .describe("Sort direction"),
  warehouseId: z
    .string()
    .optional()
    .describe("Filter by warehouse ID"),
  officeLocationId: z
    .string()
    .optional()
    .describe("Filter by office location ID"),
  fieldPreset: z
    .enum(["summary", "full"])
    .optional()
    .describe("'summary' (default) returns a brief field set; 'full' returns every field"),
  fields: z
    .array(z.string())
    .optional()
    .describe("Override: return only these fields (takes precedence over fieldPreset)"),
};

export type BrowseArgs = {
  page?: number;
  pageSize?: number;
  searchField?: string;
  searchValue?: string;
  searchOperator?: string;
  orderBy?: string;
  orderByDirection?: "asc" | "desc";
  warehouseId?: string;
  officeLocationId?: string;
  fieldPreset?: "summary" | "full";
  fields?: string[];
};

// ── Brief field presets for every browseable entity ────────────────────────────

/**
 * Per-entity "summary" field projections. Without these, browse responses
 * routinely run 100 KB+ per page (RW returns 100+ columns including audit
 * metadata, repeated bill/ship addresses, RGB swatches, etc.) — context-bombing
 * the LLM. Keys must match the RW `entity` slug used in `client.browse(entity)`.
 *
 * Field names match the keys produced by RentalWorksClient.normalizeRows()
 * (i.e. ColumnHeaders[].DataField). Verify with raw_api_browse if drift
 * suspected.
 */
export const BRIEF_FIELDS_BY_ENTITY: Record<string, string[]> = {
  rentalinventory: [
    "InventoryId", "ICode", "Description", "AvailFor", "Category", "SubCategory",
    "Manufacturer", "TrackedBy", "DailyRate", "WeeklyRate", "MonthlyRate",
    "Quantity", "QuantityIn", "QuantityOut", "Warehouse",
  ],
  item: [
    "ItemId", "BarCode", "SerialNumber", "RfId", "ICode", "Description",
    "InventoryId", "Warehouse", "OwnershipStatus", "Condition",
  ],
  salesinventory: ["InventoryId", "ICode", "Description", "Category", "SalesPrice", "Quantity", "Warehouse"],
  partsinventory: ["InventoryId", "ICode", "Description", "Category", "Quantity", "Warehouse"],
  physicalinventory: ["PhysicalInventoryId", "PhysicalInventoryNumber", "Status", "Date", "Warehouse"],

  order: [
    "OrderId", "OrderNumber", "OrderDate", "Status", "Description",
    "DealId", "Deal", "CustomerId", "Customer", "PickDate",
    "EstimatedStartDate", "EstimatedStopDate", "Total",
  ],
  orderitem: ["OrderItemId", "OrderId", "ICode", "Description", "QuantityOrdered", "Rate", "ExtendedTotal"],
  quote: ["QuoteId", "QuoteNumber", "QuoteDate", "Status", "Description", "Customer", "Total"],

  customer: [
    "CustomerId", "CustomerNumber", "Customer", "CustomerType", "CustomerStatus",
    "City", "State", "Country", "Phone", "OfficeLocation",
  ],
  contact: ["ContactId", "FirstName", "LastName", "Title", "Email", "OfficePhone", "Customer"],
  deal: ["DealId", "Deal", "DealNumber", "Customer", "DealType", "EstimatedStartDate", "EstimatedEndDate", "Status"],
  project: ["ProjectId", "Project", "ProjectNumber", "Status", "Customer", "Deal", "Description"],

  contract: ["ContractId", "ContractNumber", "ContractType", "ContractDate", "OrderNumber", "Deal", "Customer", "Warehouse", "PendingItems"],
  checkedoutitem: ["ItemId", "BarCode", "SerialNumber", "ICode", "Description", "OrderNumber", "Customer", "DateOut"],
  transferorder: ["TransferOrderId", "TransferOrderNumber", "Status", "FromWarehouse", "ToWarehouse", "Date"],
  repair: ["RepairId", "RepairNumber", "Status", "BarCode", "ICode", "Description", "DamageType", "Date"],

  invoice: [
    "InvoiceId", "InvoiceNumber", "InvoiceDate", "InvoiceType", "Status",
    "OrderNumber", "Customer", "Total", "Balance", "DueDate",
  ],
  billing: ["BillingId", "BillingNumber", "BillingDate", "Status", "Customer", "Order", "Total"],
  billingworksheet: ["BillingWorksheetId", "Status", "Date", "Customer", "Total"],
  receipt: ["ReceiptId", "ReceiptNumber", "ReceiptDate", "Customer", "Amount", "PaymentMethod"],
  vendorinvoice: ["VendorInvoiceId", "VendorInvoiceNumber", "InvoiceDate", "Vendor", "Total", "Status"],

  vendor: ["VendorId", "Vendor", "VendorNumber", "City", "State", "Country", "Phone", "Inactive"],
  purchaseorder: ["PurchaseOrderId", "PurchaseOrderNumber", "PurchaseOrderDate", "Status", "Vendor", "Description", "Total"],

  warehouse: ["WarehouseId", "Warehouse", "WarehouseCode", "City", "State", "Country", "Inactive"],
  officelocation: ["OfficeLocationId", "OfficeLocation", "City", "State", "Country", "Phone"],
  user: ["UserId", "UserName", "FirstName", "LastName", "Email", "Inactive"],
  alert: ["AlertId", "AlertType", "Subject", "Date", "Status"],

  rentalcategory: ["RentalCategoryId", "RentalCategory", "Description"],
  salescategory: ["SalesCategoryId", "SalesCategory", "Description"],
  ordertype: ["OrderTypeId", "OrderType", "Description"],
  crew: ["CrewId", "CrewName", "Status"],
  discountitem: ["DiscountItemId", "DiscountItem", "DiscountPercent"],
  template: ["TemplateId", "TemplateName", "TemplateType"],
  laborrate: ["LaborRateId", "LaborRate", "Rate", "Department"],
  glaccount: ["GlAccountId", "GlAccountNumber", "Description"],

  address: ["AddressId", "Address1", "Address2", "City", "State", "ZipCode", "Country", "Phone", "Email"],

  inventorypurchasesession: ["InventoryPurchaseSessionId", "Status", "Date", "Vendor"],
  labeldesign: ["LabelDesignId", "LabelDesign", "Description"],

  storefrontcatalog: ["InventoryId", "ICode", "Description", "Category", "DailyRate", "Available"],
};

/**
 * Resolve the field projection for a browse call.
 * Precedence: explicit `fields` > `fieldPreset='full'` (no projection) >
 * `fieldPreset='summary'` or undefined > entity brief fields > no projection.
 */
export function resolveBrowseFields(
  entity: string,
  args: { fields?: string[]; fieldPreset?: "summary" | "full" }
): string[] | undefined {
  if (args.fields && args.fields.length > 0) return args.fields;
  if (args.fieldPreset === "full") return undefined;
  return BRIEF_FIELDS_BY_ENTITY[entity];
}

// ── Browse request building ────────────────────────────────────────────────────

/**
 * Build a BrowseRequest body from common schema args.
 */
export function buildBrowseRequest(args: BrowseArgs): Record<string, unknown> {
  const request: Record<string, unknown> = {
    pageno: args.page ?? 1,
    pagesize: args.pageSize ?? 25,
    orderby: args.orderBy ?? "",
    orderbydirection: args.orderByDirection ?? "asc",
  };

  if (args.searchField && args.searchValue) {
    request.searchfields = [args.searchField];
    request.searchfieldvalues = [args.searchValue];
    request.searchfieldoperators = [args.searchOperator ?? "like"];
    request.searchseparators = [""];
  }

  if (args.warehouseId || args.officeLocationId) {
    const misc: Record<string, string> = {};
    if (args.warehouseId) misc.WarehouseId = args.warehouseId;
    if (args.officeLocationId) misc.OfficeLocationId = args.officeLocationId;
    request.miscfields = misc;
  }

  return request;
}

// ── Result formatting ──────────────────────────────────────────────────────────

/**
 * Format a browse response into a readable text summary.
 * Optionally projects rows to include only specified fields.
 */
export function formatBrowseResult(
  data: BrowseResponse,
  options?: { fields?: string[] }
): string {
  const sourceRows = (data.Rows ?? []) as Record<string, unknown>[];
  const rows =
    options?.fields && options.fields.length > 0
      ? projectFields(sourceRows, options.fields)
      : sourceRows;

  const lines: string[] = [
    `Results: ${data.TotalRows ?? 0} total (page ${data.PageNo ?? 1} of ${data.TotalPages ?? 1})`,
    `Showing ${rows.length} records:`,
    "",
  ];

  for (const row of rows) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && value !== undefined && value !== "") {
        parts.push(`${key}: ${value}`);
      }
    }
    lines.push(parts.join(" | "));
  }

  return lines.join("\n");
}

/**
 * Format a single entity record for display.
 */
export function formatEntity(data: Record<string, unknown> | null | undefined): string {
  if (!data || typeof data !== "object") return "(no data)";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== "") {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "(empty record)";
}

// ── Error handling ─────────────────────────────────────────────────────────────

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * Wrap a tool handler with error handling for known RentalWorks server issues.
 *
 * Generic-preserving so the wrapped handler keeps its original argument type —
 * call sites don't have to widen to `unknown[]`.
 *
 * Friendly branches (do NOT set isError — these are informational, not crashes):
 *   - "Invalid column name" → known DB column reference issue
 *   - "Record Not Found"    → entity ID didn't resolve
 *   - "503"                 → service temporarily unavailable
 *   - "500" + "NullReference" → known server NRE bug
 * Generic fallback → `isError: true`.
 */
export function withErrorHandling<P extends unknown[]>(
  handler: (...args: P) => Promise<ToolResult>
): (...args: P) => Promise<ToolResult> {
  return async (...args: P): Promise<ToolResult> => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("Invalid column name")) {
        return {
          content: [{
            type: "text",
            text: `Note: ${message}\n\nThis is a known issue with the RW server — certain column references are invalid for this entity. Try a different search field or remove the filter.`,
          }],
        };
      }

      // RW-specific phrasing only — generic 404s pass through as errors so
      // tooling that expects `isError: true` on misrouted requests still gets it.
      if (message.includes("Record Not Found")) {
        return {
          content: [{
            type: "text",
            text: `Not found: ${message}`,
          }],
        };
      }

      if (message.includes("503")) {
        return {
          content: [{
            type: "text",
            text: `Service unavailable (503): The RentalWorks API is temporarily unavailable. Please try again in a moment.`,
          }],
        };
      }

      if (message.includes("500") && message.includes("NullReference")) {
        return {
          content: [{
            type: "text",
            text: `Server error: The RentalWorks API returned a NullReferenceException. This is a known server-side bug for this operation. Try different parameters or contact RW support.`,
          }],
        };
      }

      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}

// ── Browse handler factory ─────────────────────────────────────────────────────

/**
 * Build a browse-tool handler that:
 *   1. Validates input via the supplied schema (caller's `server.tool` does this)
 *   2. Builds a BrowseRequest body via `buildBrowseRequest`
 *   3. Calls `client.browse(entity, body)` — the single sanctioned entrypoint
 *      that handles row normalization (positional-array → keyed-object) and
 *      the GET fallback for "Invalid column name" 500s
 *   4. Projects rows to the entity's brief preset (or caller-supplied `fields`)
 *   5. Wraps everything in `withErrorHandling` so server bugs surface as
 *      friendly messages instead of stack traces
 *
 * Callers can pass `briefFields` to override the entry in BRIEF_FIELDS_BY_ENTITY.
 * Page-size defaults are set on the schema (browseSchema or a per-tool override).
 */
export function browseTool(
  entity: string,
  options: { briefFields?: string[] } = {}
): (args: BrowseArgs & Record<string, unknown>) => Promise<ToolResult> {
  return withErrorHandling(async (args: BrowseArgs & Record<string, unknown>) => {
    const client = getClient();
    const request = buildBrowseRequest(args);
    const data = await client.browse(entity, request);

    const explicit = args.fields && args.fields.length > 0 ? args.fields : undefined;
    const preset = options.briefFields ?? BRIEF_FIELDS_BY_ENTITY[entity];
    const resolvedFields =
      explicit ??
      (args.fieldPreset === "full" ? undefined : preset);

    return {
      content: [{
        type: "text",
        text: formatBrowseResult(data, resolvedFields ? { fields: resolvedFields } : undefined),
      }],
    };
  });
}
