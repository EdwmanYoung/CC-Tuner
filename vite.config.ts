import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  server: {
    port: 4322,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
