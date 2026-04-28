/**
 * Reports tools - Accessing RentalWorks reporting system
 *
 * Covers: reports-v1 API (1,515 endpoints across ~100+ report types)
 * Reports follow a common pattern: browse, render, export
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/api-client.js";
import type { BrowseResponse } from "../types/api.js";
import {
  browseSchema,
  buildBrowseRequest,
  formatBrowseResult,
  withErrorHandling,
} from "../utils/tool-helpers.js";

export function registerReportTools(server: McpServer) {
  // ── Generic Report Runner ───────────────────────────────────────────────

  server.tool(
    "run_report",
    `Run any RentalWorks report by name. Common reports include:
    - DealOutstandingItemsReport: Items still out on a deal
    - LateReturnsReport: Overdue equipment returns
    - OrderConflictReport: Scheduling conflicts
    - ArAgingReport: Accounts receivable aging
    - BillingProgressReport: Billing status overview
    - InventoryReceiptDetailsReport: Receiving details
    - BillingAnalysisReport: Revenue analysis
    - AssetShelfLifeExpirationReport: Expiring assets
    - AvailabilityConflicts: Equipment double-bookings
    Pass the exact report name (case-sensitive).`,
    {
      reportName: z.string().describe("Exact report module name (e.g. 'DealOutstandingItemsReport')"),
      DealId: z.string().optional().describe("Filter by deal ID"),
      OrderId: z.string().optional().describe("Filter by order ID"),
      CustomerId: z.string().optional().describe("Filter by customer ID"),
      WarehouseId: z.string().optional().describe("Filter by warehouse ID"),
      OfficeLocationId: z.string().optional().describe("Filter by office location ID"),
      FromDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
      ToDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      IncludeSubHeadingsAndSubTotals: z.coerce.boolean().optional().default(true).describe("Include sub-headings"),
    },
    withErrorHandling(async ({ reportName, ...params }) => {
      const client = getClient();
      const endpoint = `/api/v1/${reportName.toLowerCase()}`;
      // Most reports use POST to render with parameters
      const data = await client.post<Record<string, unknown>>(`${endpoint}/render`, params);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Browse Report Data ──────────────────────────────────────────────────

  server.tool(
    "run_report_data",
    "Run a report and get its data output. Returns tabular data with pagination.",
    {
      reportName: z.string().describe("Report module name (e.g. 'DealOutstandingItemsReport')"),
      ...browseSchema,
    },
    withErrorHandling(async ({ reportName, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const endpoint = `/api/v1/${reportName.toLowerCase()}/runreport`;
      const data = await client.post<Record<string, unknown>>(endpoint, request);
      return { content: [{ type: "text", text: formatBrowseResult(data as unknown as BrowseResponse) }] };
    })
  );

  // ── Export Report to Excel ──────────────────────────────────────────────

  server.tool(
    "export_report_excel",
    "Export a report's data to Excel format.",
    {
      reportName: z.string().describe("Report module name"),
      ...browseSchema,
    },
    withErrorHandling(async ({ reportName, ...args }) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const endpoint = `/api/v1/${reportName.toLowerCase()}/exportexcelxlsx`;
      const data = await client.post<Record<string, unknown>>(endpoint, request);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── AR Aging Report ─────────────────────────────────────────────────────

  server.tool(
    "get_ar_aging",
    "Run the Accounts Receivable Aging report. Shows outstanding customer balances by age bucket.",
    {
      OfficeLocationId: z.string().optional().describe("Filter by office location"),
      CustomerId: z.string().optional().describe("Filter by specific customer"),
      AsOfDate: z.string().optional().describe("Aging as-of date (YYYY-MM-DD, default: today)"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/aragingreport/render", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Late Returns Report ─────────────────────────────────────────────────

  server.tool(
    "get_late_returns",
    "Run the Late Returns report showing overdue equipment that should have been returned.",
    {
      WarehouseId: z.string().optional().describe("Filter by warehouse"),
      OfficeLocationId: z.string().optional().describe("Filter by office location"),
      AsOfDate: z.string().optional().describe("Check late as-of date (YYYY-MM-DD)"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/latereturnsreport/render", args);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    })
  );

  // ── Availability Conflicts ──────────────────────────────────────────────

  server.tool(
    "get_availability_conflicts",
    "Check for equipment availability conflicts (double-bookings) across orders.",
    {
      ...browseSchema,
      FromDate: z.string().optional().describe("Start date range"),
      ToDate: z.string().optional().describe("End date range"),
    },
    withErrorHandling(async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post<Record<string, unknown>>("/api/v1/availabilityconflicts/conflicts", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as unknown as BrowseResponse) }] };
    })
  );
}
