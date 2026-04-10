import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.spec.ts"],
    environment: "node",
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
