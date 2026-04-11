/**
 * Shared helpers for building MCP tool definitions from RentalWorks patterns
 */

import { z } from "zod";
import { projectFields } from "./browse-helpers.js";

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
 * Format a browse response into a readable text summary.
 * Optionally projects rows to include only specified fields.
 */
export function formatBrowseResult(
  data: {
    TotalRows: number;
    PageNo: number;
    PageSize: number;
    TotalPages: number;
    Rows: Record<string, unknown>[];
  },
  options?: { fields?: string[] }
): string {
  const rows =
    options?.fields && options.fields.length > 0
      ? projectFields(data.Rows, options.fields)
      : data.Rows;

  const lines: string[] = [
    `Results: ${data.TotalRows} total (page ${data.PageNo} of ${data.TotalPages})`,
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

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/**
 * Wrap a tool handler with error handling for known RentalWorks server issues.
 *
 * Known pattern branches (informational — no isError):
 * - "Invalid column name" → known DB column reference issue
 * - "503" → service temporarily unavailable
 * - "500" + "NullReference" → NullReferenceException server bug
 *
 * Generic fallback → returns isError: true
 */
export function withErrorHandling(
  handler: (...handlerArgs: unknown[]) => Promise<ToolResult>
): (...handlerArgs: unknown[]) => Promise<ToolResult> {
  return async (...args: unknown[]): Promise<ToolResult> => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("Invalid column name")) {
        return {
          content: [
            {
              type: "text",
              text: `Note: ${message}\n\nThis is a known issue with the RW server — certain column references are invalid for this entity. Try a different search field or remove the filter.`,
            },
          ],
        };
      }

      if (message.includes("503")) {
        return {
          content: [
            {
              type: "text",
              text: `Service unavailable (503): The RentalWorks API is temporarily unavailable. Please try again in a moment.`,
            },
          ],
        };
      }

      if (message.includes("500") && message.includes("NullReference")) {
        return {
          content: [
            {
              type: "text",
              text: `Server error: The RentalWorks API returned a NullReferenceException. This is a known server-side bug for this operation. Try different parameters or contact RW support.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  };
}
