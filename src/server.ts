import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import devRoutes from "./api/gameRoutes.js";
import gameplayRoutes from "./api/gameplayRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from /dist (Production build)
app.use(express.static(path.join(__dirname, "..", "dist")));

// API routes
app.use("/dev", devRoutes); // Developer content panel
app.use("/api", gameplayRoutes); // Game loop API

// Root redirects to game UI
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.get("/vault", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "vault.html"));
});

app.get("/dev-panel", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "dev.html"));
});

app.get("/dev-assets", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "dev-assets.html"));
});

app.get("/dev-assets/slices", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "dev-assets-slices.html"));
});

app.get("/dev-assets/audio", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "dev-assets-audio.html"));
});

app.get("/dev-terrain", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "dev-terrain.html"));
});

app.get("/hub", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "hub.html"));
});

app.get("/forge", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "forge.html"));
});

app.get("/adventure", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "adventure.html"));
});

app.get("/map", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "adventure.html"));
});

export default app;

// Only listen locally if not deployed on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🎮 RPG Engine Server running at http://localhost:${PORT}`);
    console.log(`🕹  Game UI:   http://localhost:${PORT}/`);
    console.log(`🛠  Dev Panel: http://localhost:${PORT}/dev-panel`);
    console.log(`🧩 Assets:    http://localhost:${PORT}/dev-assets`);
  });
}
