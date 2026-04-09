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
  buildBrowseRequest,
  formatBrowseResult,
  formatEntity,
} from "../utils/tool-helpers.js";

export function registerAdminTools(server: McpServer) {
  // ── Get Session Info ────────────────────────────────────────────────────

  server.tool(
    "get_session",
    "Get current authenticated session info - user details, office location, warehouse, and permissions.",
    {},
    async () => {
      const client = getClient();
      const data = await client.get("/api/v1/account/session");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Get Account Settings ────────────────────────────────────────────────

  server.tool(
    "get_account_settings",
    "Get the current user's account settings and system configuration.",
    {},
    async () => {
      const client = getClient();
      const data = await client.post("/api/v1/account/getsettings");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── Browse Users ────────────────────────────────────────────────────────

  server.tool(
    "browse_users",
    "Browse system users (staff, agents, admins). Shows name, email, role, and active status.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/user/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Get User ────────────────────────────────────────────────────────────

  server.tool(
    "get_user",
    "Get full details of a specific system user.",
    {
      userId: z.string().describe("The user ID"),
    },
    async ({ userId }) => {
      const client = getClient();
      const data = await client.get(`/api/v1/user/${userId}`);
      return { content: [{ type: "text", text: formatEntity(data as any) }] };
    }
  );

  // ── Browse Alerts ───────────────────────────────────────────────────────

  server.tool(
    "browse_alerts",
    "Browse system alerts and notifications.",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/alert/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );

  // ── Browse Activity Log ─────────────────────────────────────────────────

  server.tool(
    "browse_activity",
    "Browse system activity log entries (audit trail of user actions).",
    browseSchema,
    async (args) => {
      const client = getClient();
      const request = buildBrowseRequest(args);
      const data = await client.post("/api/v1/activity/browse", request);
      return { content: [{ type: "text", text: formatBrowseResult(data as any) }] };
    }
  );
}
