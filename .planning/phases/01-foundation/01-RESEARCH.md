# Phase 1: Foundation - Research

**Researched:** 2026-04-09
**Domain:** Node.js package dependencies, Vitest multi-project configuration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — infrastructure phase.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | `zod` added to package.json dependencies (not just devDependencies) | MCP SDK lists zod as a non-optional peer dep; source imports zod directly — must be an explicit dep |
| FOUND-02 | `@vitest/coverage-v8` added to devDependencies | Not currently installed; current vitest is 3.2.4 so matching version is 3.2.4 |
| FOUND-03 | Test files reorganized into `src/__tests__/unit/` and `src/__tests__/integration/` directories | All 5 existing tests confirmed pure unit tests; all use relative imports that need depth adjustment |
| FOUND-04 | `vitest.config.ts` configured with separate test projects (unit, integration) | Vitest 3.x supports inline `projects` array inside `test:` config object |
</phase_requirements>

## Summary

Phase 1 establishes the two preconditions everything else depends on: a clean dependency graph and a test suite that can be filtered by type. Both problems are small in scope but precise in execution — wrong package versions or wrong import paths after file relocation will silently break later phases.

The current state is healthy: `npm ci` succeeds, all 49 tests pass, and the code already works with Zod 4.3.6 (installed as a transitive dep of the MCP SDK). The two gaps are (1) zod is not declared as a direct dependency despite being imported directly in 12 source files, and (2) the vitest config has no project separation, so `vitest --project unit` would fail.

**Primary recommendation:** Add `zod` and `@vitest/coverage-v8` to package.json, move all 5 test files to `src/__tests__/unit/` with updated relative import paths, and add a `projects` array to `vitest.config.ts`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | `^4.3.6` | Schema validation — already used in all 12 source files | Non-optional peer dep of MCP SDK; imported directly in source |
| @vitest/coverage-v8 | `3.2.4` | Code coverage reporting | Must match installed vitest version exactly |

**Version verification:** [VERIFIED: npm registry via `npm view`]

- `zod` latest: 4.3.6 (2026-04-09)
- `@vitest/coverage-v8` latest: 3.2.4 (matches installed `vitest@3.2.4`)
- `vitest` installed: 3.2.4 (package.json specifies `^3.1.0`, resolved to 3.2.4)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod ^4.3.6 | zod ^3.25 | MCP SDK accepts `^3.25 || ^4.0`; v4 is already installed and compatible — no reason to downgrade |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | v8 is built into Node.js, zero extra deps; istanbul requires babel transform |

**Installation:**
```bash
npm install zod
npm install --save-dev @vitest/coverage-v8
```

> Note: Use `npm install zod` (not `--save-dev`) since zod is a runtime dependency (imported in production tool files, not just tests).

## Architecture Patterns

### Recommended Directory Structure

After phase completion:

```
src/
└── __tests__/
    ├── unit/           # All 5 existing tests move here
    │   ├── api-paths.test.ts
    │   ├── removed-tools.test.ts
    │   ├── request-bodies.test.ts
    │   ├── tool-helpers.test.ts
    │   └── tool-registration.test.ts
    └── integration/    # Empty directory; future home of INTG-* tests
```

### Pattern 1: Vitest Projects Configuration

**What:** Inline `projects` array inside the `test` config object in `vitest.config.ts`. No separate workspace file needed.

**When to use:** When you need `vitest --project unit` to run only unit tests and `vitest --project integration` to run only integration tests.

**Example:**
```typescript
// Source: https://vitest.dev/guide/projects
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/__tests__/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/__tests__/integration/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
```

> `extends: true` inherits root-level vitest config (environment, plugins, etc.).
> The root `root: "src"` option from the current config should be removed when using projects with explicit `include` paths — mixing root-relative includes with a `root` override causes path confusion. [VERIFIED: local testing against installed vitest 3.2.4]

### Pattern 2: Import Path Depth Adjustment on Relocation

**What:** All 5 test files use `../tools/` and `../utils/` relative imports. Moving them one level deeper (`unit/`) requires changing all `../` to `../../`.

**Current (from `src/__tests__/*.test.ts`):**
```typescript
import { buildBrowseRequest } from "../utils/tool-helpers.js";
import { registerInventoryTools } from "../tools/inventory.js";
import { resetClient } from "../utils/api-client.js";
```

**After relocation (from `src/__tests__/unit/*.test.ts`):**
```typescript
import { buildBrowseRequest } from "../../utils/tool-helpers.js";
import { registerInventoryTools } from "../../tools/inventory.js";
import { resetClient } from "../../utils/api-client.js";
```

> The `.js` extension must be kept — project uses `"type": "module"` ESM and `moduleResolution: "Node16"`. [VERIFIED: package.json + tsconfig.json]

### Anti-Patterns to Avoid

- **Pinning exact zod version** (`"zod": "4.3.6"` not `"^4.3.6"`): Use semver range to allow patch updates.
- **Adding `@vitest/coverage-v8` with a mismatched version**: The coverage plugin must match the vitest version exactly (`3.2.4`). Using `^3.1.0` is fine — it resolves to the same as vitest.
- **Keeping `root: "src"` in vitest config with projects using absolute-from-root includes**: The `root` option shifts all relative paths. When using `include` in project configs, use paths relative to the repo root (e.g., `src/__tests__/unit/**`) and remove the global `root: "src"`.
- **Using `defineWorkspace`** (the deprecated API): Vitest 3.x deprecated this in favor of inline `projects` inside `defineConfig`. [VERIFIED: local node_modules type declarations]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test project isolation | Custom test runner scripts | Vitest `projects` array | Built-in, CLI-filterable, zero overhead |
| Code coverage | Manual instrumentation | `@vitest/coverage-v8` | Node.js V8 native coverage, zero babel deps |

## Common Pitfalls

### Pitfall 1: `root: "src"` conflicts with projects `include` patterns

**What goes wrong:** The current `vitest.config.ts` sets `root: "src"`. When you add a `projects` array with `include: ["src/__tests__/unit/**"]`, Vitest resolves includes relative to `root`, making the path `src/src/__tests__/unit/**` — tests not found.

**Why it happens:** `root` shifts the base for all relative paths in the config.

**How to avoid:** Remove `root: "src"` when switching to projects with explicit `include` glob patterns. The `include` patterns should be repo-root-relative: `src/__tests__/unit/**/*.test.ts`.

**Warning signs:** Vitest reports "No test files found" after config change.

### Pitfall 2: Zod peer dependency warning vs. resolution failure

**What goes wrong:** Without `zod` in `dependencies`, `npm ci` on a fresh machine may emit peer dep warnings (npm 7+) or fail depending on npm version and `legacy-peer-deps` setting. On some npm versions, an unsatisfied non-optional peer dep causes install failure.

**Why it happens:** MCP SDK declares `zod` as a non-optional peer dependency (`"optional": false` in `peerDependenciesMeta`). The package is installed transitively but not declared by the consuming project.

**How to avoid:** Add `"zod": "^4.0"` to `dependencies` in package.json. This makes the declaration explicit and version-range clear.

**Warning signs:** `npm ci` prints "peer dep unmet" or exits non-zero on a CI machine.

### Pitfall 3: Forgetting the `integration/` directory

**What goes wrong:** FOUND-04 requires both `unit` and `integration` project configs. If the `integration/` directory doesn't exist, `vitest --project integration` errors with "No test files found." Some vitest versions treat this as an error, not an empty pass.

**Why it happens:** An include glob that matches no files may be treated as a configuration error.

**How to avoid:** Create `src/__tests__/integration/.gitkeep` as a placeholder. The directory must exist even though it is empty in Phase 1.

**Warning signs:** `vitest --project integration` exits with error code instead of "0 tests passed."

### Pitfall 4: Import paths not updated after file relocation

**What goes wrong:** Moving test files without updating `../tools/` to `../../tools/` causes TypeScript compilation errors and test failures.

**Why it happens:** Relative imports are depth-sensitive.

**How to avoid:** Update every import in each of the 5 test files. Imports affected: `../tools/*`, `../utils/*`.

**Warning signs:** `vitest run` after relocation fails with "Cannot find module '../tools/inventory.js'".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `defineWorkspace()` (separate workspace file) | Inline `projects` array in `defineConfig` | Vitest 3.x | No separate workspace file needed |
| Zod v3 as transitive dep | Zod v4 as direct dep | MCP SDK 1.29.0 now accepts `^3.25 \|\| ^4.0` | Pin v4 directly |

**Deprecated/outdated:**
- `defineWorkspace`: Deprecated in Vitest 3.x — use `projects` inside `defineConfig` instead. [VERIFIED: local type declarations show `@deprecated` annotation]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vitest --project integration` with no matching files will error, not pass empty | Pitfall 3 | If it passes empty, the `.gitkeep` placeholder is unnecessary but harmless |

## Open Questions

1. **Should `npm test` run all projects or just unit?**
   - What we know: Current `"test": "vitest run"` runs everything. After adding projects, `vitest run` with no `--project` flag runs all projects.
   - What's unclear: Whether the team wants `npm test` to default to unit-only (fast) or all (thorough).
   - Recommendation: Keep `npm test` running all projects for now (simpler). Add separate `"test:unit"` and `"test:integration"` scripts for targeted execution.

## Environment Availability

Step 2.6: SKIPPED (no external runtime dependencies — all changes are package.json and config file edits)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (to be updated) |
| Quick run command | `vitest run --project unit` |
| Full suite command | `vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `zod` in package.json dependencies | manual inspect | `node -e "const p=require('./package.json'); console.assert(p.dependencies.zod)"` | N/A |
| FOUND-02 | `@vitest/coverage-v8` in devDependencies | manual inspect | `node -e "const p=require('./package.json'); console.assert(p.devDependencies['@vitest/coverage-v8'])"` | N/A |
| FOUND-03 | 5 test files under `src/__tests__/unit/` pass | unit | `vitest run --project unit` | ❌ Wave 0 (files must be relocated) |
| FOUND-04 | `vitest --project unit` and `vitest --project integration` both work | smoke | `vitest run --project unit && vitest run --project integration` | ❌ Wave 0 (config must be updated) |

### Sampling Rate

- **Per task commit:** `npm test` (runs all projects, confirms nothing broken)
- **Per wave merge:** `npm test`
- **Phase gate:** All 49 unit tests pass under `--project unit`; `--project integration` completes without error

### Wave 0 Gaps

- [ ] `src/__tests__/unit/` directory — must exist before test files can be relocated
- [ ] `src/__tests__/integration/.gitkeep` — placeholder so `--project integration` doesn't fail on empty glob
- [ ] `vitest.config.ts` — must be updated before relocated tests can run

## Security Domain

Step skipped — this phase contains no user-facing code, authentication, input handling, or data access. It is purely package.json and config file changes. Security controls are not applicable.

## Sources

### Primary (HIGH confidence)

- Local `node_modules/vitest/dist/config.d.ts` — confirmed `defineWorkspace` is `@deprecated`, `defineProject` available, `projects` field exists in config
- Local `package.json` — confirmed zod not in `dependencies`; MCP SDK is `^1.12.1` (resolved to 1.29.0)
- `npm ls zod` — confirmed zod 4.3.6 installed as transitive dep of MCP SDK 1.29.0
- `npm view zod version` — confirmed 4.3.6 is current latest [VERIFIED: npm registry]
- `npm view @vitest/coverage-v8 version` — confirmed 3.2.4 is current latest [VERIFIED: npm registry]
- Local MCP SDK `package.json` — confirmed `zod` is a non-optional peer dep with range `^3.25 || ^4.0`
- `npm run test` — confirmed all 49 existing tests pass [VERIFIED: live execution]
- `npm ci` — confirmed clean install succeeds [VERIFIED: live execution]

### Secondary (MEDIUM confidence)

- https://vitest.dev/guide/projects — confirmed `projects` array syntax, `extends: true`, `--project` CLI flag

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry and local node_modules
- Architecture: HIGH — vitest projects API confirmed from official docs and local type declarations
- Pitfalls: HIGH — root/include conflict and import path depth verified from direct code inspection

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable tooling, 30-day window appropriate)
