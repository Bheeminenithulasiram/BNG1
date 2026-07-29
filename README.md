# BrandGen — AI Brand Name Generator

> Generate original, brandable startup names with AI, then instantly check `.com` domain and social handle availability.

---

## ✨ Features

- **AI-Powered Naming** — Uses Groq (LLaMA 3.3 70B) to generate creative, domain-available brand names
- **80/20 Availability Mix** — Results show ~80% available + ~20% taken domains for realistic, useful output
- **Domain Check** — Real-time `.com` availability via RDAP + DNS fallback
- **Social Availability** — Checks X (Twitter), Instagram, and LinkedIn handles
- **Custom Name Check** — Check availability for any name you already have in mind
- **Production-Ready** — Rate limiting, security headers, CORS, and environment validation

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 20+
- A free [Groq API key](https://console.groq.com/)

### Setup

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Create your environment file
cp .env.example .env.local

# 3. Add your Groq API key to .env.local
#    GROQ_API_KEY=gsk_...

# 4. Start the dev server
npm run dev
```

The app runs at **http://localhost:3000** (frontend) and **http://localhost:3001** (API).

---

## 🏗️ Architecture

```
BNG/                          ← Monorepo root (npm workspaces)
├── artifacts/
│   ├── brand-generator/      ← React + Vite + TailwindCSS frontend
│   │   └── src/
│   │       ├── pages/        ← Home.tsx (main UI), not-found.tsx
│   │       ├── components/   ← BrandDetails, NavBar, shadcn/ui
│   │       └── hooks/        ← API hooks (React Query)
│   └── api-server/           ← Express 5 API backend
│       └── src/
│           ├── routes/       ← brands.ts, availability.ts, health.ts
│           └── services/     ← availability.ts (domain + social checks)
├── lib/                      ← Shared types & API client (api-client-react)
├── vercel.json               ← Vercel deployment config
├── .npmrc                    ← legacy-peer-deps=true (for Vercel)
└── dev.js                    ← Dev orchestrator (starts both servers)
```

---

## ☁️ Deploy to Vercel

### 1. Connect the repo
Import `https://github.com/Bheeminenithulasiram/BNG1` in Vercel.

### 2. Set Environment Variables
Go to **Project Settings → Environment Variables** and add:

| Variable | Value | Required |
|---|---|---|
| `GROQ_API_KEY` | `gsk_...` | ✅ Yes |
| `NODE_ENV` | `production` | Recommended |
| `ALLOWED_ORIGINS` | `https://your-domain.vercel.app` | Optional (CORS) |

### 3. Deploy
Vercel auto-detects the `vercel.json` build config. Click **Deploy**.

> The `installCommand` in `vercel.json` is set to `npm install --legacy-peer-deps` to bypass the `esbuild-plugin-pino` peer dependency conflict automatically.

---

## 🔒 Security

| Feature | Details |
|---|---|
| HTTP Security Headers | `helmet` (CSP, X-Frame-Options, XSS Protection, etc.) |
| Rate Limiting | 20 req/min on `/api/brands/generate`, 120 req/min globally |
| Body Size Limit | 50 KB max request body |
| CORS | Configurable via `ALLOWED_ORIGINS` env var |
| Secret Protection | `GROQ_API_KEY` never stored in source code |

---

## 🧪 API Reference

### `POST /api/brands/generate`
Generate AI brand name suggestions.

**Body:**
```json
{
  "description": "A marketplace for vintage film cameras",
  "category": "ecommerce",
  "keywords": "minimalist, retro"
}
```

**Response:** Array of brand suggestions (18 items, ~80% available domains)

---

### `POST /api/brands/availability`
Check domain and social availability for a brand name.

**Body:**
```json
{
  "name": "FrameVault",
  "domain": "framevault.com"
}
```

---

### `GET /api/healthz`
Health check. Returns `{ "status": "ok" }`.

---

## 📦 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both frontend + API in development mode |
| `npm run build` | Build frontend + bundle API for production |
| `npm run typecheck` | Run TypeScript checks across all workspaces |
| `npm run lint` | Alias for typecheck |

---

## 📄 License

MIT
