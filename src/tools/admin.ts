/**
 * Admin and User tools
 *
 * Covers: administrator-v1 API (256 endpoints), Account Services (9 endpoints)
 * Tags: User (31), plus various admin utilities
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

export function registerAdminTools(server: McpServer) {
  // ── Get Session Info ────────────────────────────────────────────────────

  /**
   * The raw `/api/v1/account/session` response can exceed 4 MB — it bundles
   * every warehouse, office location, category, and config blob the user has
   * access to. That makes it unusable in any LLM context. We project to scalar
   * top-level fields only (identity + active scope) and surface object/array
   * keys as a hint that more detail is reachable via dedicated tools.
   */
  server.tool(
    "get_session",
    "Get current authenticated session info — user identity, active office location, warehouse, and a list of nested keys (use the dedicated browse_* tools for warehouses, locations, categories, etc.).",
    {},
    withErrorHandling(async () => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>("/api/v1/account/session");
      const summary: Record<string, unknown> = {};
      const nestedKeys: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined || value === "") continue;
        if (typeof value === "object") {
          nestedKeys.push(key);
        } else {
          summary[key] = value;
        }
      }
      const lines = [formatEntity(summary)];
      if (nestedKeys.length > 0) {
        lines.push("");
        lines.push(`Nested keys (use dedicated tools): ${nestedKeys.sort().join(", ")}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    })
  );

  // ── Get Account Settings ────────────────────────────────────────────────

  server.tool(
    "get_account_settings",
    "Get the current user's account settings and system configuration (scalar fields only — nested config blobs are summarized as keys).",
    {},
    withErrorHandling(async () => {
      const client = getClient();
      const data = await client.post<Record<string, unknown>>("/api/v1/account/getsettings");
      const summary: Record<string, unknown> = {};
      const nestedKeys: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined || value === "") continue;
        if (typeof value === "object") {
          nestedKeys.push(key);
        } else {
          summary[key] = value;
        }
      }
      const lines = [formatEntity(summary)];
      if (nestedKeys.length > 0) {
        lines.push("");
        lines.push(`Nested keys: ${nestedKeys.sort().join(", ")}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    })
  );

  // ── Browse Users ────────────────────────────────────────────────────────

  server.tool(
    "browse_users",
    "Browse system users (staff, agents, admins). Shows name, email, role, and active status.",
    browseSchema,
    browseTool("user")
  );

  // ── Get User ────────────────────────────────────────────────────────────

  server.tool(
    "get_user",
    "Get full details of a specific system user.",
    {
      userId: z.string().describe("The user ID"),
    },
    withErrorHandling(async ({ userId }) => {
      const client = getClient();
      const data = await client.get<Record<string, unknown>>(`/api/v1/user/${userId}`);
      return { content: [{ type: "text", text: formatEntity(data) }] };
    })
  );

  // ── Browse Alerts ───────────────────────────────────────────────────────

  server.tool(
    "browse_alerts",
    "Browse system alerts and notifications.",
    browseSchema,
    browseTool("alert")
  );

}
