import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/__tests__/**/*.spec.ts"],
    environment: "node",
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
