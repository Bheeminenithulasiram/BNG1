import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes/index";
import { logger } from "./lib/logger";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.resolve(__dirname, "../../../public");

const app: Express = express();

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── CORS — restrict to same origin (or specific allowed origins) ──────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl, Vercel SSR, health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-groq-api-key"],
    credentials: false,
  }),
);

// ─── Rate limiting — protect AI generation endpoint ───────────────────────────
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute window
  max: 20,                    // 20 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});

app.use(globalLimiter);
app.use(["/api/brands/generate", "/brands/generate", "/generate"], generateLimiter);

// ─── Logging ──────────────────────────────────────────────────────────────────
const pinoMiddleware =
  typeof pinoHttp === "function"
    ? pinoHttp
    : (pinoHttp as any).pinoHttp || (pinoHttp as any).default;

app.use(
  pinoMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: any) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Body parsing — enforce size limit ────────────────────────────────────────
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api", router);
app.use(router);

// ─── Static frontend assets ───────────────────────────────────────────────────
app.use(express.static(publicPath));

// ─── SPA fallback — serve index.html for all non-API routes ──────────────────
app.get(/.*/, (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/healthz")) {
    return next();
  }
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) next();
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message || "Internal Server Error";
  logger.error({ err }, "Unhandled error");
  res.status(status).json({ error: message });
});

export default app;
