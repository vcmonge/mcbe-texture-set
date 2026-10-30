import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    minify: "esbuild",
    cssMinify: true,
    outDir: "dist",
    emptyOutDir: true,
  },
});
