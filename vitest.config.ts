import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.spec.ts"],
    exclude: ["tests/e2e/**", "node_modules"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["electron/services/**/*.ts", "electron/ipc/**/*.ts"],
      exclude: ["electron/main.ts", "electron/preload.ts"],
    },
  },
});
