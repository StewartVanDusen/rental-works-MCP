/**
 * Shared helpers for building MCP tool definitions from RentalWorks patterns
 */

import { z } from "zod";

/**
 * Common browse input schema fields used by most browse endpoints
 */
export const browseSchema = {
  page: z
    .number()
    .optional()
    .default(1)
    .describe("Page number (default: 1)"),
  pageSize: z
    .number()
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
};

/**
 * Build a BrowseRequest from common schema args
 */
export function buildBrowseRequest(args: {
  page?: number;
  pageSize?: number;
  searchField?: string;
  searchValue?: string;
  searchOperator?: string;
  orderBy?: string;
  orderByDirection?: "asc" | "desc";
  warehouseId?: string;
  officeLocationId?: string;
}) {
  const request: Record<string, unknown> = {
    pageno: args.page || 1,
    pagesize: args.pageSize || 25,
    orderby: args.orderBy || "",
    orderbydirection: args.orderByDirection || "asc",
  };

  if (args.searchField && args.searchValue) {
    request.searchfields = [args.searchField];
    request.searchfieldvalues = [args.searchValue];
    request.searchfieldoperators = [args.searchOperator || "like"];
    request.searchseparators = [""];
  }

  if (args.warehouseId || args.officeLocationId) {
    request.miscfields = {};
    if (args.warehouseId) {
      (request.miscfields as Record<string, string>).WarehouseId = args.warehouseId;
    }
    if (args.officeLocationId) {
      (request.miscfields as Record<string, string>).OfficeLocationId = args.officeLocationId;
    }
  }

  return request;
}

/**
 * Format a browse response into a readable text summary
 */
export function formatBrowseResult(data: {
  TotalRows: number;
  PageNo: number;
  PageSize: number;
  TotalPages: number;
  Rows: Record<string, unknown>[];
}): string {
  const lines: string[] = [
    `Results: ${data.TotalRows} total (page ${data.PageNo} of ${data.TotalPages})`,
    `Showing ${data.Rows.length} records:`,
    "",
  ];

  for (const row of data.Rows) {
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
 * Format a single entity record for display
 */
export function formatEntity(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== "") {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}
