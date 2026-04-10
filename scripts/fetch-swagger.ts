/**
 * Fetch all 12 RentalWorks Swagger sub-specs and write a merged path cache.
 *
 * Run: npx tsx scripts/fetch-swagger.ts
 *
 * Reads RENTALWORKS_BASE_URL env var or falls back to the default instance.
 * Output: scripts/swagger-cache.json (committed to repo for CI offline use).
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL =
  process.env.RENTALWORKS_BASE_URL || "https://modernlighting.rentalworks.cloud";

// All 12 RentalWorks sub-specs in the Swagger UI
const SUB_SPECS = [
  "accountservices-v1",
  "home-v1",
  "warehouse-v1",
  "settings-v1",
  "pages-v1",
  "reports-v1",
  "utilities-v1",
  "administrator-v1",
  "mobile-v1",
  "plugins-v1",
  "integrations-v1",
  "storefront-v1",
] as const;

// Only valid HTTP method keys — skip OpenAPI metadata keys like "parameters"
const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "options", "head"]);

type SpecEntry = { method: string; path: string; spec: string };

const allPaths: SpecEntry[] = [];
const subSpecSummary: Array<{ name: string; pathCount: number }> = [];

for (const specName of SUB_SPECS) {
  const url = `${BASE_URL}/swagger/${specName}/swagger.json`;
  console.log(`Fetching ${specName}...`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`  FAILED (network error): ${err}`);
    continue;
  }

  if (!res.ok) {
    console.error(`  FAILED: ${res.status} ${res.statusText}`);
    continue;
  }

  let data: { paths: Record<string, Record<string, unknown>> };
  try {
    data = (await res.json()) as { paths: Record<string, Record<string, unknown>> };
  } catch (err) {
    console.error(`  FAILED (parse error): ${err}`);
    continue;
  }

  let count = 0;
  for (const [path, methods] of Object.entries(data.paths ?? {})) {
    for (const method of Object.keys(methods)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      allPaths.push({ method: method.toUpperCase(), path, spec: specName });
      count++;
    }
  }

  subSpecSummary.push({ name: specName, pathCount: count });
  console.log(`  OK: ${count} endpoints`);
}

const output = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  subSpecs: subSpecSummary,
  totalPaths: allPaths.length,
  paths: allPaths,
};

const outPath = join(__dirname, "swagger-cache.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`\nWrote ${allPaths.length} total paths from ${subSpecSummary.length} sub-specs to ${outPath}`);
