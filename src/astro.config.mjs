import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  publicDir: "public",
  base: "./",
  devToolbar: {
    enabled: false,
  },
  vite: {
    server: {
      port: 4322,
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
  },
});
