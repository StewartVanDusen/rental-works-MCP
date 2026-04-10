/**
 * RentalWorks API client with JWT authentication
 * Base: https://modernlighting.rentalworks.cloud/api/v1
 */

import type {
  BrowseRequest,
  BrowseResponse,
  HttpMethod,
  JwtRequest,
  JwtResponse,
} from "../types/api.js";

const BASE_URL =
  process.env.RENTALWORKS_BASE_URL ||
  "https://modernlighting.rentalworks.cloud";

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
      const text = await res.text();
      throw new Error(`API ${method} ${path} failed: ${res.status} - ${text}`);
    }

    // Some endpoints return empty responses
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
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
   * Browse an entity with pagination and filtering.
   * Most RentalWorks entities follow the pattern: POST /api/v1/{entity}/browse
   */
  async browse<T = Record<string, unknown>>(
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
    return this.post<BrowseResponse<T>>(`/api/v1/${entity}/browse`, body);
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
