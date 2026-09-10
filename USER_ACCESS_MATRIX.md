# User Access Matrix

## Overview

This matrix defines the roles, user levels, and access rights used by the R-CPI platform. These roles are enforced in the backend using RBAC checks in the route guards and middleware.

## Default users currently seeded

| Level | Role | Name | Email | Password | Access |
| --- | --- | --- | --- | --- | --- |
| 1 | CITIZEN | Aline Mukamana | citizen@rcpi.gov.rw | Citizen@123 | Submit reports, view own dashboard, manage own profile |
| 2 | OFFICER | Jean Habimana | officer@rcpi.gov.rw | Officer@123 | Process reports, workflow updates, status transitions |
| 5 | SYSTEM_ADMIN | Grace Uwase | admin@rcpi.gov.rw | Admin@123 | Full admin access, user management, audit visibility |

## Role hierarchy and permissions

| Level | Role | Description | Permissions |
| --- | --- | --- | --- |
| 1 | CITIZEN | Community member | Report issues, view own dashboard, manage profile, see own report history |
| 2 | OFFICER | Government workflow officer | Review and manage reports, update workflow status, respond to citizens |
| 3 | DISTRICT_ADMIN | District-level administrator | District oversight, management dashboards, limited user administration |
| 4 | NATIONAL_ADMIN | National administrator | Cross-district oversight, strategic governance management |
| 5 | SYSTEM_ADMIN | System administrator | Full platform administration, user creation, activation/deactivation, audit logs |
| 6 | ANALYST | Analytics/decision support | Reporting and data analysis support |

## Permission matrix

| Role | Register | Login | Create report | Workflow actions | Manage users | Audit logs | Full admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CITIZEN | Yes | Yes | Yes | No | No | No | No |
| OFFICER | No | Yes | No | Yes | No | No | No |
| DISTRICT_ADMIN | No | Yes | No | Yes | Yes (district scope) | No | No |
| NATIONAL_ADMIN | No | Yes | No | Yes | Yes | Yes | No |
| SYSTEM_ADMIN | No | Yes | No | Yes | Yes | Yes | Yes |
| ANALYST | No | Yes | No | Limited | No | No | No |

## Route enforcement

The following route groups enforce the role checks:

- Citizen routes: `CITIZEN`
- Workflow routes: `OFFICER`, `DISTRICT_ADMIN`, `NATIONAL_ADMIN`, `SYSTEM_ADMIN`
- Admin routes: `SYSTEM_ADMIN`, `NATIONAL_ADMIN`, `DISTRICT_ADMIN`

## Interface visibility

To see the users in the admin interface:

1. Log in as the system admin account: `admin@rcpi.gov.rw`
2. Open the Admin area.
3. Navigate to User Management.
4. The table should list all users returned by the backend.

If the list is empty, the database has not been seeded yet or the backend is not running. Run the project setup and seed commands before checking the admin table.
