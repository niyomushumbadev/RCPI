# R-CPI — Rwanda Community Problem Intelligence

Full-stack app for citizens to report community problems and for government
officers to triage and resolve them.

## 2. Citizen Application

- Home dashboard
- Report a problem
- Take/upload photo
- Upload video
- GPS location
- Select problem category
- Write description
- Submit report
- My reports
- Report tracking
- Notifications
- Feedback
- Profile

## 3. Problem / Incident Management Component

This component manages the full lifecycle of a citizen-reported problem from submission through verification, assignment, investigation, resolution, closure, and possible reopening.

### Objective

- Create and manage incident reports end-to-end.
- Enforce controlled lifecycle transitions.
- Maintain a full audit trail for every important action.
- Support RBAC, validation, privacy rules, and evidence handling.
- Prepare the platform for future AI, GIS, analytics, and government workflow integrations.

### Report lifecycle

- SUBMITTED
- UNDER_REVIEW
- VERIFIED
- ASSIGNED
- IN_PROGRESS
- RESOLVED
- CLOSED
- REOPENED

Typical flow:

SUBMITTED → UNDER_REVIEW → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED

Alternative paths:

SUBMITTED → REJECTED
CLOSED → REOPENED → IN_PROGRESS

### Core report fields

- Report ID / reference number
- Citizen ID or creator
- Title
- Description
- Category
- Priority / urgency
- District / sector / cell
- Latitude / longitude
- Submission date
- Status
- Assigned officer / department
- Deadline
- Evidence attachments
- Resolution details
- Timeline and history

### Reference number format

RCP-YYYY-XXXXXX

Example: RCP-2026-000145

### RBAC behavior

- CITIZEN: create reports, view own reports, attach evidence, request reopen, submit feedback.
- OFFICER: review and verify reports, assign work, change status, set deadlines, resolve issues.
- DISTRICT_ADMIN: manage reports within district scope, verify, assign, monitor deadlines, close and reopen cases.
- NATIONAL_ADMIN: national oversight, escalate and monitor unresolved incidents, review cross-district operations.
- SYSTEM_ADMIN: full oversight, audit access, security, system configuration.

### API endpoints

- POST /api/v1/reports
- GET /api/v1/reports
- GET /api/v1/reports/:id
- PUT /api/v1/reports/:id
- PATCH /api/v1/reports/:id/verify
- PATCH /api/v1/reports/:id/reject
- PATCH /api/v1/reports/:id/assign
- PATCH /api/v1/reports/:id/status
- PATCH /api/v1/reports/:id/deadline
- PATCH /api/v1/reports/:id/resolve
- PATCH /api/v1/reports/:id/close
- PATCH /api/v1/reports/:id/reopen
- POST /api/v1/reports/:id/evidence
- GET /api/v1/reports/:id/history
- GET /api/v1/reports/overdue
- GET /api/v1/reports/statistics

### Validation rules

- Title and description required
- Category must exist and be active
- Coordinates must be valid
- IDs must exist and be authorized
- Rejection requires a reason
- Reopening requires a reason
- Invalid status transitions must be rejected
- File types and sizes must be validated before upload

### Status transition rules

Examples of valid transitions:

- SUBMITTED → UNDER_REVIEW
- UNDER_REVIEW → VERIFIED
- UNDER_REVIEW → REJECTED
- VERIFIED → ASSIGNED
- ASSIGNED → IN_PROGRESS
- IN_PROGRESS → RESOLVED
- RESOLVED → CLOSED
- CLOSED → REOPENED
- REOPENED → IN_PROGRESS

Invalid state changes must be rejected by the backend service layer, not only by the frontend.

### Evidence handling

- Image, document, and video evidence support
- Evidence metadata: uploader, type, file name, size, upload date
- File validation for MIME type, extension, and safe storage
- Evidence categories such as CITIZEN_EVIDENCE, VERIFICATION_EVIDENCE, RESOLUTION_EVIDENCE

### History and audit

Every important action records a history event:

- report created
- status changed
- assigned
- rejected
- verified
- resolved
- closed
- reopened
- evidence uploaded

History is immutable and must be retained for accountability and audit purposes.

### Database design

Use the existing reports table and extend it with supporting tables such as:

- report_assignments
- report_verifications
- report_deadlines
- report_resolutions
- report_media
- report_status_history
- audit_logs

### Frontend deliverables

- Report list and search
- Create report page
- Report details page
- Edit report page
- Verification / rejection UI
- Assignment UI
- Deadline controls
- Resolution / close / reopen actions
- Evidence gallery
- Timeline display
- Filters and pagination
- Officer dashboard and district monitoring views

### Security principles

- JWT authentication required
- RBAC enforced in backend
- No trust in frontend-only permission checks
- Private report data protected by visibility rules
- Secure file upload validation
- Database transactions for critical actions
- Consistent error responses and audit logging

### Expected result

The system must behave like a real incident-management workflow rather than a simple CRUD screen.

Example:

Citizen submits report → officer reviews → verification or rejection → assignment → investigation → resolution → closure → possible reopening.

# 🤖 4. AI Intelligence Component

This is one of the most important components.

### AI functions

- Automatic problem classification
- Image recognition
- Text analysis
- Severity prediction
- Duplicate detection
- Similarity detection
- Fraud/spam detection
- Trend detection
- Risk prediction
- Recommendation engine
- Confidence scoring

Example:

Photo + description → AI → "Blocked Drainage, 94% confidence"

| Piece    | Tech                                                        | Dev port |
| -------- | ----------------------------------------------------------- | -------- |
| Backend  | Node.js, Express, TypeScript, Prisma, MySQL                 | `5000`   |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Leaflet, Recharts | `5173`   |

The Vite dev server proxies `/api/*` to the backend
(`frontend/vite.config.ts`), so the browser only ever talks to
`http://localhost:5173` and the refresh-token cookie stays first-party.

## Project structure

The codebase is organized around the R-CPI role hierarchy
(Citizen → Cell → Sector → District → Province/City → National → Executive):

```
backend/
  prisma/schema.prisma        # 25+ models: geography, users, reports, AI, audit
  prisma/seed.ts              # Rwanda geography + demo users for all 11 roles
  src/
    index.ts / app.ts         # server entry, security, routing, /api/v1
    routes/                   # authRoutes, citizenRoutes, workflowRoutes,
                              # reportRoutes, intelligence.routes, ai.routes,
                              # adminRoutes, supportRoutes
    controllers/              # one controller per route group
    services/                 # report lifecycle, status matrix, priority engine,
                              # AI service (OpenAI → service → heuristic fallback),
                              # notifications, audit
    middleware/               # auth (JWT+RBAC), security (helmet, rate limit), validation
frontend/
  src/
    pages/auth/               # login, register, forgot/reset password, verify
    pages/public/             # landing, presentation, forbidden
    pages/citizen/            # Level 1 — citizen portal (L1)
    pages/workflow/           # Levels 2–7 — government report workflow
    pages/intelligence/       # Levels 5–8 — GIS, AI dashboards, executive strategy
    pages/admin/              # Levels 4–7 — administration
    pages/community/          # shared community map & insights
    components/ lib/ context/ # shell/UI, API client, auth
scripts/
  dev.js / setup.js           # run both servers; first-time setup
  e2e-workflow-test.ts        # 37-check end-to-end workflow test (§22)
```

---

## Quick start

Prerequisites: **Node.js 18+** and a running **MySQL 8** server.

```bash
npm run setup     # installs deps, creates backend/.env, syncs + seeds the DB
npm run dev       # starts backend (:5000) and frontend (:5173) together
```

Then open **http://localhost:5173**.

### `npm run setup` — what it does

1. Checks Node 18+.
2. Runs `npm install` in `backend/` and `frontend/`.
3. Creates `backend/.env` from `backend/.env.example` if it doesn't exist —
   then **stops** so you can edit it (see below). Re-run afterwards.
4. Generates the Prisma client and pushes the schema to MySQL.
5. Seeds demo data **only if the database has no users yet** — existing data
   is never wiped.

### `backend/.env`

At minimum, set:

- `MYSQL_PASSWORD` — password of the MySQL account in `MYSQL_USER`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — generate each with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

### Demo accounts (also on the Login page)

| Role | Name             | Email                       | Password          |
| ------ | ---------------- | --------------------------- | ----------------- |
| Citizen | Aline Mukamana   | citizen@rcpi.gov.rw         | `Citizen@123`     |
| Cell officer | Eric Cell Officer | cell@rcpi.gov.rw      | `Cell@12345`      |
| Officer | Jean Habimana    | officer@rcpi.gov.rw         | `Officer@123`     |
| Sector officer | Diane Sector Officer | sector@rcpi.gov.rw | `Sector@123`      |
| District | Rebecca Niyonsenga | district-admin@rcpi.gov.rw | `District@123`  |
| Province | Patrick Province Admin | province@rcpi.gov.rw  | `Province@123`    |
| Kigali City | Sandrine City Admin | city@rcpi.gov.rw       | `CityAdmin@123`   |
| National | Emmanuel Mugenzi | national-admin@rcpi.gov.rw  | `National@123`    |
| Executive | Hon. Executive  | executive@rcpi.gov.rw       | `Executive@123`   |
| System admin | Grace Uwase  | admin@rcpi.gov.rw           | `Admin@123`       |
| Analyst | Claire Uwingabire | analyst@rcpi.gov.rw        | `Analyst@123`     |
| Demo citizens (7) | Jean Bosco, Claudine, … | citizen2@ … citizen8@rcpi.gov.rw | `Citizen@123` |

### Demo data

First-time seeding creates a realistic demo dataset (clearly demo — not official
statistics): 23 community problem reports across 8 districts (Kigali's 3,
Huye, Musanze, Rubavu, Rusizi, Nyagatare) spanning the full lifecycle —
SUBMITTED → AI analysis → VERIFIED → ASSIGNED → IN_PROGRESS → RESOLVED →
CLOSED, plus ESCALATED, REJECTED and a reopen request — with status history,
department assignments, deadlines, AI advisory records, citizen feedback and
notifications. The public map, community insights, officer queues, district
and executive dashboards all show data on first run. Geo-scoped roles see
their own district (e.g. the officer sees Gasabo's reports); SYSTEM_ADMIN
and EXECUTIVE see nationwide aggregates.

> Re-seeding is safe: demo reports are only added when the reports table is empty.
> To rebuild from scratch: `npx prisma db push --force-reset && npx tsx prisma/seed.ts`
> (in `backend/`, ⚠️ wipes all data).

### Testing

```bash
npm run test        # backend contract tests (status matrix, validation)
npm run test:e2e    # 37-check citizen→officer→resolve→close→analytics E2E test
                    # (requires the API running on :5000)
npm run verify:demo # 29-check demo-data verification (map, queues, dashboards)
```

### User access matrix

| Level | Role | Users in system | Core permissions | Interface access |
| ----- | ---- | --------------- | --------------- | ---------------- |
| 1 | CITIZEN | Aline Mukamana | submit reports, view own dashboard, manage own profile, track report status | Citizen dashboard and profile pages |
| 2 | OFFICER | Jean Habimana | review reports, update workflow status, assign departments, communicate with citizens | Workflow dashboard and report queue |
| 3 | DISTRICT_ADMIN | District-level administrators | district oversight, admin dashboard, user management for district scope | Admin dashboard and user management |
| 4 | NATIONAL_ADMIN | National administrators | cross-district oversight, higher-level governance controls | Admin dashboard and national operations |
| 5 | SYSTEM_ADMIN | Grace Uwase | full system administration, user creation/deactivation, audit logs, full platform control | Full admin access |
| 6 | ANALYST | Optional analytics users | analysis and decision-support review | Reporting/analysis views |

### Role permissions summary

| Role | Can register | Can log in | Can create reports | Can manage workflow | Can manage users | Can view audit logs | Can full-admin |
| ---- | ------------ | --------- | ------------------ | ------------------ | ---------------- | ---------------- | -------------- |
| CITIZEN | Yes | Yes | Yes | No | No | No | No |
| OFFICER | No | Yes | No | Yes | No | No | No |
| DISTRICT_ADMIN | No | Yes | No | Yes | Yes (district scope) | No | No |
| NATIONAL_ADMIN | No | Yes | No | Yes | Yes | Yes | No |
| SYSTEM_ADMIN | No | Yes | No | Yes | Yes | Yes | Yes |
| ANALYST | No | Yes | No | Limited analytics | No | No | No |

> The app enforces these rules in the backend using RBAC checks in the auth middleware and route guards. To view the actual user list in the interface, log in as a system admin and open the User Management screen in the admin area.

---

## All scripts

Run from the repo root unless noted.

| Command                  | What it does                                                     |
| ------------------------ | ---------------------------------------------------------------- |
| `npm run setup`          | First-time setup (deps, `.env`, Prisma, seed)                    |
| `npm run dev`            | Backend **and** frontend together, prefixed `[api]` / `[web]`    |
| `npm run dev:backend`    | Backend only (in `backend/`)                                     |
| `npm run dev:frontend`   | Frontend only (in `frontend/`)                                   |
| `npm run typecheck`      | TypeScript check for backend + frontend                          |
| `npm run db:reset`       | `prisma db push` in `backend/` (sync schema, keep data)          |
| `npm run db:seed`        | Seed demo data (in `backend/`)                                   |
| `npm run dev` (backend)  | `tsx watch src/index.ts` — auto-restarts on code changes         |
| `npm run db:setup` (backend) | `prisma generate && prisma db push && seed`                  |

`npm run dev` shuts **both** servers down on Ctrl+C — no orphan processes
left holding ports.

---

## Troubleshooting

### "Cannot reach the server…" / "Unexpected server response" on login

The backend isn't running (or crashed). The frontend proxies `/api/*` to
`http://localhost:5000`; when nothing is listening, the proxy returns a
non-JSON error page and the UI shows a network error.

1. Check the backend: `curl http://localhost:5000/health` → should return JSON.
2. If it's down, start it: `npm run dev` (or `npm run dev:backend`).
3. If the backend log shows Prisma errors, see the next section.

### Prisma error P2022 — "The column … does not exist in the current database"

The Prisma schema changed but the database wasn't updated.

```bash
npm run db:reset        # in backend/: prisma db push
```

If `db push` refuses because existing rows lack new required columns, the
database holds data from an older schema version. For local development you
can reset and re-seed (⚠️ deletes all data in `r_cpi_db`):

```bash
cd backend
npx prisma db push --force-reset
npx tsx prisma/seed.ts
```

### "Port 5173 is in use" / "Port 5000 is in use"

A previous dev server is still running (e.g. started in another terminal).

- Prefer `npm run dev` from the root, which cleans up both processes on exit.
- Otherwise kill the stale process:
  ```bash
  netstat -ano | findstr :5173     # find the PID (Windows)
  taskkill /PID <pid> /T /F
  ```

### MySQL connection refused

Make sure the MySQL service is running and the `MYSQL_*` values in
`backend/.env` are correct. Test with:

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p -e "SELECT 1;"
```

---

## Project layout

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # DB schema (MySQL)
│   │   └── seed.ts            # demo geography, users, categories…
│   └── src/
│       ├── index.ts           # server entry (port 5000)
│       ├── app.ts             # express app + /api/v1 routes
│       ├── config/            # env, db (prisma client)
│       ├── controllers/       # auth, citizen, workflow, admin, support
│       ├── middleware/        # security, rate limiting, auth
│       ├── routes/
│       ├── services/
│       └── utils/
├── frontend/
│   ├── vite.config.ts         # /api proxy → localhost:5000
│   └── src/
│       ├── lib/api.ts         # API client (auth, refresh, error handling)
│       ├── context/           # AuthContext
│       ├── pages/             # Login, Register, dashboards, reports…
│       └── components/
└── scripts/
    ├── dev.js                 # runs backend + frontend together
    └── setup.js               # first-time setup
```
