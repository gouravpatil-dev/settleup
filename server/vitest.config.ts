import { defineConfig } from "vitest/config";

process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
});
