import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/__tests__/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/__tests__/integration/**/*.test.ts"],
          testTimeout: 15000,
          hookTimeout: 15000,
        },
      },
    ],
  },
});
