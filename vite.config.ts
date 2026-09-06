/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = fileURLToPath(new URL("./src/index.ts", import.meta.url));

export default defineConfig({
  build: {
    target: "es2021",
    sourcemap: true,
    minify: "esbuild",
    lib: {
      entry,
      formats: ["es"],
      fileName: () => "notify-switchboard-cards.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },
});
