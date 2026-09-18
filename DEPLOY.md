# Deploying R-CPI to Vercel

One Vercel project serves both the React SPA and the Express API:

- **Frontend** — `frontend/dist` (static build, SPA fallback rewrites)
- **API** — the Express app in `backend/` served by a single Vercel Function
  (Fluid compute) via `api/index.ts`, reachable at `/api/v1/*` on the same
  origin as the frontend — no CORS exposure in practice, though a trusted
  origin list is still enforced for defense in depth.
- **Python AI microservice (`ai-service/`)** — **not deployed**. The Node
  backend already has an in-process heuristic fallback, and `OPENAI_API_KEY`
  enables full AI analysis. To run it separately later, host it on any
  Python-capable platform and point `AI_SERVICE_URL`/`AI_SERVICE_TOKEN` at it.

---

## 1. Provision a managed MySQL database

The Prisma schema is MySQL. Any managed MySQL works; PlanetScale (Vitess-based)
is a good serverless-friendly fit. From your provider's dashboard:

1. Create a database (e.g. `rcpi`).
2. Create a user and copy the **connection string**:
   `mysql://USER:PASSWORD@HOST:3306/rcpi`
   - PlanetScale: use the branch URL, e.g. `mysql://user:pass@aws.connect.psdb.cloud/rcpi?sslaccept=strict`
   - Railway/other hosts: append `?connection_limit=5&pool_timeout=10` to keep
     the per-instance pool small for serverless.
3. Apply the schema from your machine (one-time, idempotent):
   ```bash
   cd backend
   # point DATABASE_URL at the managed MySQL first
   npx prisma db push
   npx tsx prisma/seed.ts        # optional demo data
   ```
4. Allowlist Vercel outbound IPs if your provider requires it (most don't).

> **PlanetScale note:** `prisma db push` works on the `main` branch. If your
> plan requires the Deploy Request workflow, generate schema changes with
> `prisma migrate diff` instead of `db push`.

## 2. Import the repo into Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. vercel.com/new → import the repository. Vercel reads the root `vercel.json`
   (build commands, `api/index.ts` function, rewrites, cron).
3. Framework preset: **Other**.

## 3. Set environment variables

Project → Settings → Environment Variables (Production, Preview, Development):

| Variable | Example / notes |
| --- | --- |
| `DATABASE_URL` | `mysql://user:pass@host:3306/rcpi?connection_limit=5&pool_timeout=10` |
| `FRONTEND_URL` | `https://yourdomain.com,https://www.yourdomain.com` (comma-separated, no trailing slashes; add `https://your-app.vercel.app` too if you'll use it) |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 64` |
| `CRON_SECRET` | `openssl rand -hex 32` (protects `/api/v1/cron/deadline-scan`) |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | optional — enables full AI triage (heuristic fallback otherwise) |
| `OPENAI_MODEL` | optional (default `gpt-4o-mini`) |
| `RESEND_API_KEY` / `RESEND_FROM` | optional — real emails |
| `TWILIO_*` | optional — real SMS |
| `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` | optional — only if you later deploy `ai-service/` |

> Do **not** set `PORT` — Vercel injects it. Local dev continues to use 5000.

## 4. Deploy

```bash
npm run deploy:vercel        # or: vercel --prod
```

Or push to your production branch — Git integration deploys automatically.

## 5. Verify

```bash
curl https://<your-app>.vercel.app/health              # {"success":true,...}
curl https://<your-app>.vercel.app/api/v1/health/ready # checks the DB connection
```

Then open the app and log in.

## 6. Serverless constraints to know about

- **Evidence uploads** go to `/tmp` (the only writable path on Vercel) and are
  **ephemeral per function instance**. Files disappear between invocations and
  are not shared across instances — fine for testing, not for production
  record-keeping. For durable storage, swap `multer.diskStorage` for an
  S3/R2-compatible driver in `backend/src/controllers/report-evidence.controller.ts`.
- **Deadline scheduler** — the in-process 30-minute `setInterval` in
  `backend/src/index.ts` doesn't tick reliably on serverless. Vercel Cron now
  calls `GET /api/v1/cron/deadline-scan` daily at 03:00 UTC (see `vercel.json`);
  the route requires `Authorization: Bearer $CRON_SECRET`. Admins can still
  trigger scans manually from the admin panel. Want tighter deadline
  monitoring? Add more cron entries or move the scan to an external scheduler
  (e.g. GitHub Actions, cron-job.org).
- **Long requests** — the function has a 60s `maxDuration`. All current
  endpoints are far below that; just avoid streaming huge exports.
- **Cold starts** — the first request after idle warms the function (~1–3s
  typical). Fluid compute keeps instances warm under traffic.
- **Local dev is unchanged**: `npm run dev` at the repo root still runs
  backend (5000) + frontend (5173) + AI service with the Vite proxy.

## 7. Custom domain

Add it in Vercel → Settings → Domains, then append every domain variant you
serve (`https://example.com`, `https://www.example.com`) to `FRONTEND_URL` and
redeploy — otherwise CORS will reject the extra origin.
