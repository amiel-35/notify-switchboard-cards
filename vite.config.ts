/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const entry = fileURLToPath(new URL("./src/index.ts", import.meta.url));

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

export default defineConfig({
  define: {
    // Consumed by src/version.ts for the load banner.
    __CARD_VERSION__: JSON.stringify(pkg.version),
  },
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
