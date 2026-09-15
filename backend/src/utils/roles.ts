// ─────────────────────────────────────────────────────────────
// R-CPI role hierarchy (master spec §3, levels 1-8 + admin/analyst)
// Level 1 CITIZEN → 2 CELL_OFFICER → 3 SECTOR_OFFICER → 4 DISTRICT_ADMIN
// → 5 PROVINCE_ADMIN → 6 CITY_ADMIN → 7 NATIONAL_ADMIN → 8 EXECUTIVE
// OFFICER = legacy alias (cell/sector scope). SYSTEM_ADMIN + ANALYST remain.
// ─────────────────────────────────────────────────────────────
export const ROLE_LEVELS: Record<string, number> = {
  CITIZEN: 1,
  CELL_OFFICER: 2,
  SECTOR_OFFICER: 3,
  OFFICER: 3,
  DISTRICT_ADMIN: 4,
  PROVINCE_ADMIN: 5,
  CITY_ADMIN: 6,
  NATIONAL_ADMIN: 7,
  EXECUTIVE: 8,
  ANALYST: 7,
  SYSTEM_ADMIN: 99,
};

export const GOVERNMENT_ROLES = [
  'CELL_OFFICER',
  'SECTOR_OFFICER',
  'OFFICER',
  'DISTRICT_ADMIN',
  'PROVINCE_ADMIN',
  'CITY_ADMIN',
  'NATIONAL_ADMIN',
  'EXECUTIVE',
  'SYSTEM_ADMIN',
  'ANALYST',
] as const;

export const WORKFLOW_VIEWERS = [
  'CELL_OFFICER',
  'SECTOR_OFFICER',
  'OFFICER',
  'DISTRICT_ADMIN',
  'PROVINCE_ADMIN',
  'CITY_ADMIN',
  'NATIONAL_ADMIN',
  'SYSTEM_ADMIN',
  'EXECUTIVE',
  'ANALYST',
] as const;

export const WORKFLOW_STAFF = [
  'CELL_OFFICER',
  'SECTOR_OFFICER',
  'OFFICER',
  'DISTRICT_ADMIN',
  'PROVINCE_ADMIN',
  'CITY_ADMIN',
  'NATIONAL_ADMIN',
  'SYSTEM_ADMIN',
] as const;

export const ADMIN_ROLES = ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] as const;

export const VERIFY_ROLES = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] as const;

export function roleLevel(role?: string | null): number {
  if (!role) return 0;
  return ROLE_LEVELS[role] ?? 0;
}

export function canAccessScope(viewerRole: string, viewerLevel: number, targetLevel: number): boolean {
  void viewerLevel;
  void targetLevel;
  // Higher levels see aggregated data of lower levels; same level sees own scope.
  // Enforcement of geographic scope happens in controllers (district/province/cell).
  return GOVERNMENT_ROLES.includes(viewerRole as never);
}
