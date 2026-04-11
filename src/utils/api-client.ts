/**
 * RentalWorks API client with JWT authentication
 */

import type {
  BrowseRequest,
  BrowseResponse,
  ColumnHeader,
  HttpMethod,
  JwtRequest,
  JwtResponse,
} from "../types/api.js";
import { withClientSideFallback } from "./browse-helpers.js";

const BASE_URL =
  process.env.RENTALWORKS_BASE_URL ||
  "";

export class RentalWorksClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private username: string;
  private password: string;

  constructor() {
    this.username = process.env.RENTALWORKS_USERNAME || "";
    this.password = process.env.RENTALWORKS_PASSWORD || "";

    if (!this.username || !this.password) {
      console.error(
        "Warning: RENTALWORKS_USERNAME and RENTALWORKS_PASSWORD env vars not set"
      );
    }
  }

  /**
   * Authenticate and get a JWT token
   */
  async authenticate(): Promise<JwtResponse> {
    const body: JwtRequest = {
      UserName: this.username,
      Password: this.password,
    };

    const res = await fetch(`${BASE_URL}/api/v1/jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Authentication failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as JwtResponse;
    this.token = data.access_token;
    // Tokens typically last 4 hours; refresh after 3.5h
    this.tokenExpiry = Date.now() + 3.5 * 60 * 60 * 1000;
    return data;
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureAuth(): Promise<string> {
    if (!this.token || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.token!;
  }

  /**
   * Make an authenticated API request
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.ensureAuth();
    const url = `${BASE_URL}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      // 401/403: clear token, re-authenticate, retry once
      if (res.status === 401 || res.status === 403) {
        this.token = null;
        this.tokenExpiry = 0;
        const retryToken = await this.ensureAuth();
        headers.Authorization = `Bearer ${retryToken}`;
        const retryRes = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retryRes.ok) {
          const retryText = await retryRes.text();
          throw new Error(`API ${method} ${path} failed: ${retryRes.status} - ${retryText}`);
        }
        const retryText = await retryRes.text();
        if (!retryText) return {} as T;
        try {
          return JSON.parse(retryText) as T;
        } catch {
          throw new Error(
            `API ${method} ${path} failed: retry response was not valid JSON. Received: ${retryText.slice(0, 200)}`
          );
        }
      }
      const text = await res.text();
      throw new Error(`API ${method} ${path} failed: ${res.status} - ${text}`);
    }

    // Some endpoints return empty responses
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `API ${method} ${path} failed: response was not valid JSON. Received: ${text.slice(0, 200)}`
      );
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * POST request
   */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * PUT request
   */
  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Normalize a browse response so that Rows are always keyed objects.
   *
   * Some RentalWorks entities (e.g. order, customer, deal) return Rows as
   * arrays of values alongside a ColumnHeaders array that provides the field
   * names. This method zips them together so every row becomes a
   * Record<string, unknown> keyed by the DataField from each column header.
   *
   * If Rows[0] is already an object (or Rows is empty / ColumnHeaders is
   * absent) the response is returned unchanged.
   */
  private normalizeRows<T = Record<string, unknown>>(
    response: BrowseResponse<T>
  ): BrowseResponse<T> {
    const { Rows } = response;
    if (!Rows || Rows.length === 0 || !Array.isArray(Rows[0])) {
      return response;
    }

    // The RW API returns column metadata as either "Columns" (common) or
    // "ColumnHeaders" depending on the endpoint.  Both carry a DataField
    // property we can use to zip arrays into keyed objects.
    const columns: ColumnHeader[] | undefined =
      (response as unknown as Record<string, unknown>).Columns as ColumnHeader[] | undefined ??
      response.ColumnHeaders;

    if (!columns || columns.length === 0) {
      return response;
    }

    const fields = columns.map((h) => h.DataField);
    const normalizedRows = (Rows as unknown as unknown[][]).map((row) => {
      const obj: Record<string, unknown> = {};
      fields.forEach((field, i) => {
        obj[field] = row[i];
      });
      return obj as T;
    });

    return { ...response, Rows: normalizedRows };
  }

  /**
   * Browse an entity with pagination and filtering.
   * Most RentalWorks entities follow the pattern: POST /api/v1/{entity}/browse
   *
   * Handles two known RentalWorks API quirks automatically:
   *   1. "Invalid column name" 500 errors — retries without search fields and
   *      falls back to client-side filtering (via withClientSideFallback).
   *   2. Array-valued rows — normalizes them to keyed objects using the
   *      ColumnHeaders metadata returned by the API.
   */
  async browse<T extends Record<string, unknown> = Record<string, unknown>>(
    entity: string,
    options?: Partial<BrowseRequest>
  ): Promise<BrowseResponse<T>> {
    const body: BrowseRequest = {
      pageno: 1,
      pagesize: 25,
      orderby: "",
      orderbydirection: "asc",
      ...options,
    };

    const fetchFn = (req: Record<string, unknown>) =>
      this.post<BrowseResponse<T>>(`/api/v1/${entity}/browse`, req);

    let result: BrowseResponse<T>;
    try {
      result = await withClientSideFallback<T>(
        fetchFn as (req: Record<string, unknown>) => Promise<BrowseResponse<T>>,
        body as unknown as Record<string, unknown>
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Invalid column name")) {
        throw err;
      }
      // POST browse is fundamentally broken for this entity — fall back to GET
      const params = new URLSearchParams();
      params.set("pageno", String(body.pageno ?? 1));
      params.set("pagesize", String(body.pagesize ?? 25));
      if (body.orderby) {
        const dir = body.orderbydirection || "asc";
        params.set("sort", `${body.orderby}${dir === "desc" ? " desc" : ""}`);
      }
      const raw = await this.get<{
        Items: T[];
        TotalItems: number;
        PageNo: number;
        PageSize: number;
      }>(`/api/v1/${entity}?${params.toString()}`);
      return {
        Rows: raw.Items,
        TotalRows: raw.TotalItems,
        PageNo: raw.PageNo,
        PageSize: raw.PageSize,
        TotalPages: Math.ceil(raw.TotalItems / raw.PageSize),
      };
    }

    return this.normalizeRows(result);
  }

  /**
   * Get a single entity by ID.
   * Pattern: GET /api/v1/{entity}/{id}
   */
  async getById<T = Record<string, unknown>>(
    entity: string,
    id: string
  ): Promise<T> {
    return this.get<T>(`/api/v1/${entity}/${id}`);
  }

  /**
   * Create a new entity.
   * Pattern: POST /api/v1/{entity}
   */
  async create<T = Record<string, unknown>>(
    entity: string,
    data: Record<string, unknown>
  ): Promise<T> {
    return this.post<T>(`/api/v1/${entity}`, data);
  }

  /**
   * Update an entity by ID.
   * Pattern: PUT /api/v1/{entity}/{id}
   */
  async update<T = Record<string, unknown>>(
    entity: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<T> {
    return this.put<T>(`/api/v1/${entity}/${id}`, data);
  }

  /**
   * Delete an entity by ID.
   * Pattern: DELETE /api/v1/{entity}/{id}
   */
  async remove(entity: string, id: string): Promise<void> {
    await this.delete(`/api/v1/${entity}/${id}`);
  }

  /**
   * Export entity data to Excel.
   * Pattern: POST /api/v1/{entity}/exportexcelxlsx
   */
  async exportExcel(
    entity: string,
    options?: Partial<BrowseRequest>
  ): Promise<unknown> {
    return this.post(`/api/v1/${entity}/exportexcelxlsx`, options || {});
  }

  /**
   * Get session info for the authenticated user
   */
  async getSession(): Promise<unknown> {
    return this.get("/api/v1/account/session");
  }

  /**
   * Get office locations
   */
  async getOfficeLocation(): Promise<unknown> {
    return this.get("/api/v1/account/officelocation");
  }
}

// Singleton instance
let client: RentalWorksClient | null = null;

export function getClient(): RentalWorksClient {
  if (!client) {
    client = new RentalWorksClient();
  }
  return client;
}

export function resetClient(): void {
  client = null;
}
