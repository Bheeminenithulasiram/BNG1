import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local first (local overrides), then fall back to standard .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";
import { logger } from "./lib/logger";

// ─── Environment validation ───────────────────────────────────────────────────
const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0 || port > 65535) {
  logger.error({ PORT: rawPort }, "Invalid PORT — must be a number between 1 and 65535");
  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {
  logger.warn(
    "GROQ_API_KEY is not set — brand generation will use the local fallback mode. " +
      "Set GROQ_API_KEY in your environment or .env.local to enable AI-powered generation.",
  );
}

// ─── Start server ─────────────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  app.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "Server listening");
  });
}

export default app;
