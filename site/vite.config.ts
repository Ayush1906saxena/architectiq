import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Served by GitHub Pages at https://ayush1906saxena.github.io/architectiq/
export default defineConfig({
  base: "/architectiq/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", chunkSizeWarningLimit: 1000 },
});
