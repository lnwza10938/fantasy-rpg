import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "./",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/dev": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        hub: resolve(__dirname, "hub.html"),
        vault: resolve(__dirname, "vault.html"),
        forge: resolve(__dirname, "forge.html"),
        adventure: resolve(__dirname, "adventure.html"),
        dev: resolve(__dirname, "dev.html"),
        devMapEditor: resolve(__dirname, "dev-map-editor.html"),
        devAssets: resolve(__dirname, "dev-assets.html"),
        devAssetsSlices: resolve(__dirname, "dev-assets-slices.html"),
        devAssetsAudio: resolve(__dirname, "dev-assets-audio.html"),
        devTerrain: resolve(__dirname, "dev-terrain.html"),
      },
    },
  },
});
