# R-CPI Frontend

React + Vite + TypeScript + Tailwind CSS frontend for **R-CPI — Rwanda Community Problem Intelligence**.

## Stack

| Layer      | Choice                                        |
| ---------- | --------------------------------------------- |
| Build      | Vite 5                                        |
| UI         | React 18, React Router 6, Tailwind CSS 3      |
| GIS        | Leaflet + OpenStreetMap tiles                 |
| State      | Auth context + per-page data fetching (no heavyweight store needed) |
| API        | `src/lib/api.ts` — typed client with transparent refresh-token rotation |

## Getting started

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:5000` (the backend), so refresh-token
cookies remain first-party. Start the backend first:

```bash
cd ../backend
npm run db:setup   # generate + push + seed (first time)
npm run dev        # API on :5000
```

### Demo accounts (from backend seed)

| Role    | Email                   | Password      |
| ------- | ----------------------- | ------------- |
| Citizen | citizen@rcpi.gov.rw     | `Citizen@123` |
| Officer | officer@rcpi.gov.rw     | `Officer@123` |
| Admin   | admin@rcpi.gov.rw       | `Admin@123`   |

## Structure

```
src/
  lib/
    api.ts          # typed API client, 401 → refresh → retry
    format.tsx      # status badges, date/bytes formatting
  context/
    AuthContext.tsx # session bootstrap, login/register/logout
  components/
    Layout.tsx      # topbar + sidebar, role-based nav, notif bell
    RequireAuth.tsx # auth + role route guards
    ui.tsx          # PageHeader, Spinner, ErrorBox, EmptyState, Pagination, StatCard
  pages/
    Landing, Login, Register
    CitizenDashboard, NewReport, MyReports, ReportDetail, Profile
    Community, CommunityMap, Notifications
    WorkflowDashboard, WorkflowReports, WorkflowReportDetail
    AdminDashboard, AdminUsers, AdminAuditLogs
```

## Roles & routes

| Route                        | Citizen | Officer | Admin |
| ---------------------------- | :-----: | :-----: | :---: |
| `/dashboard`, `/profile`     | ✅      | ✅      | ✅    |
| `/reports/new`, `/my-reports`| ✅      | —       | —     |
| `/map`, `/community`, `/notifications` | ✅ | ✅ | ✅ |
| `/workflow/**`               | —       | ✅      | ✅ (admin roles included) |
| `/admin/**`                  | —       | —       | ✅    |

## Scripts

- `npm run dev` — dev server (proxied API)
- `npm run build` — typecheck + production build
- `npm run typecheck` — TypeScript only
- `npm run preview` — serve the production build
