import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Rwanda administrative structure (abbreviated but real) ───
const RWANDA_GEO: Record<string, Record<string, string[]>> = {
  Kigali: {
    Gasabo: ['Kacyiru', 'Kimihurura', 'Remera', 'Jabana', 'Gisozi', 'Ndera', 'Rusororo', 'Bumbogo', 'Gikomero', 'Kinyinya'],
    Kicukiro: ['Kicukiro', 'Niboye', 'Gahanga', 'Masaka', 'Nyarugunga', 'Gatenga', 'Kanombe', 'Kigarama', 'Nyanza', 'Rubungo'],
    Nyarugenge: ['Nyamirambo', 'Muhima', 'Kimisagara', 'Rwezamenyo', 'Gitega', 'Kanyinya', 'Mageragere', 'Nyarugenge', 'Kigali', 'Kigali City'],
  },
  Southern: {
    Nyanza: ['Nyanza', 'Busasamana', 'Mukingo', 'Kigoma', 'Cyabakamyi', 'Rwabicuma', 'Muyira', 'Nyagisozi', 'Kibirizi', 'Mbuye'],
    Gisagara: ['Gikonko', 'Kansi', 'Masango', 'Mugombwa', 'Mamba', 'Kibirizi', 'Ndora', 'Nyanza', 'Gisaragara', 'Gisagara'],
    Huye: ['Huye', 'Tumba', 'Ngoma', 'Ruhashya', 'Mbazi', 'Butare', 'Mbuye', 'Muganza', 'Rusatira', 'Simbi'],
    Nyamagabe: ['Nyamagabe', 'Kaduha', 'Kamegeri', 'Mugano', 'Musange', 'Nkomane', 'Tare', 'Gasaka', 'Mata', 'Muganza'],
    Ruhango: ['Ruhango', 'Kinazi', 'Byimana', 'Mwendo', 'Bweramana', 'Mbuye', 'Gisuma', 'Nyarusange', 'Munyana', 'Kigoma'],
    Muhanga: ['Muhanga', 'Nyamabuye', 'Cyeza', 'Kabagari', 'Shyogwe', 'Taba', 'Kiyumba', 'Ruli', 'Buruhukiro', 'Nyarusange'],
    Kamonyi: ['Kamonyi', 'Mugina', 'Karama', 'Kayenzi', 'Rukoma', 'Gacurabwenge', 'Musambira', 'Rugarika', 'Munyana', 'Nyamiyaga'],
  },
  Western: {
    Rubavu: ['Rubavu', 'Gisenyi', 'Nyamyumba', 'Kanzenze', 'Bugeshi', 'Mururu', 'Rwerere', 'Katoyi', 'Mudende', 'Nyaheke', 'Cyanzarwe'],
    Rutsiro: ['Rutsiro', 'Gihango', 'Nyabirasi', 'Tunguru', 'Mushonyi', 'Kigeyo', 'Kivumu', 'Musasa', 'Bweyeye', 'Mubuga', 'Rusebeya'],
    Karongi: ['Karongi', 'Gashari', 'Ruganda', 'Rubengera', 'Bwishyura', 'Gitesi', 'Murundi', 'Kigeyo', 'Mubuga', 'Rucyizuru', 'Kibuye'],
    Nyabihu: ['Nyabihu', 'Jenda', 'Bigogwe', 'Mungaba', 'Rurembo', 'Mubuga', 'Rugera', 'Nduba', 'Gatumba', 'Kibilizi'],
    Ngororero: ['Ngororero', 'Gatwa', 'Kidahwe', 'Muhanda', 'Mubuga', 'Nyange', 'Ruganda', 'Bwira', 'Kabaya', 'Nyaruguru', 'Kagano'],
    Nyamasheke: ['Nyamasheke', 'Kagano', 'Karengera', 'Mashesha', 'Rangiro', 'Bushenge', 'Gihombo', 'Rugabano', 'Mata', 'Karambi', 'Rusenge'],
    Rusizi: ['Rusizi', 'Bugarama', 'Giheke', 'Gikundamvura', 'Nyakabuye', 'Nkungu', 'Nkombo', 'Nyarusanga', 'Muganza', 'Rwimbogo', 'Luhunga'],
  },
  Northern: {
    Burera: ['Burera', 'Gahunga', 'Gisebeya', 'Kinyababa', 'Rwerere', 'Kagogo', 'Butaro', 'Rusiga', 'Cyanika', 'Kinoni', 'Rugengabari'],
    Gakenke: ['Gakenke', 'Busengo', 'Coko', 'Rugeshi', 'Mugunga', 'Rushashi', 'Muzo', 'Nyarusiza', 'Karambo', 'Kivuruga', 'Gakenke Town'],
    Gicumbi: ['Gicumbi', 'Byumba', 'Manyagiro', 'Kigogo', 'Miyove', 'Rukomo', 'Mutete', 'Bukure', 'Bwisige', 'Sakara', 'Icyuzo', 'Murehe'],
    Musanze: ['Musanze', 'Muhoza', 'Cyuve', 'Kimonyi', 'Kinigi', 'Shingiro', 'Busogo', 'Gataraga', 'Rwaza', 'Mikeno'],
    Rulindo: ['Rulindo', 'Base', 'Kinihira', 'Cyungo', 'Kisaro', 'Tumba', 'Munyaga', 'Murambi', 'Masoro', 'Mbuye', 'Gicumbi'],
  },
  Eastern: {
    Bugesera: ['Bugesera', 'Ntarama', 'Ririma', 'Mayange', 'Juru', 'Nyamata', 'Kamabuye', 'Mareba', 'Ngeruka', 'Sovu', 'Kigabiro'],
    Gatsibo: ['Gatsibo', 'Kiziguro', 'Nyarubuye', 'Remera', 'Kabarore', 'Gitoki', 'Rugarama', 'Rwimbogo', 'Nyagatare', 'Mugera', 'Gatsibo Town'],
    Kayonza: ['Kayonza', 'Murama', 'Kabarondo', 'Rukara', 'Muhanga', 'Ruzigajuru', 'Munyagano', 'Mukarange', 'Ndego', 'Kirehe', 'Kayonza Town'],
    Kirehe: ['Kirehe', 'Mahama', 'Nasho', 'Gahara', 'Kigina', 'Musaza', 'Muhura', 'Mushikiri', 'Nyamugali', 'Mumena', 'Kirehe Town'],
    Ngoma: ['Ngoma', 'Rukumberi', 'Sake', 'Kibungo', 'Mugesera', 'Rukomo', 'Ntega', 'Murama', 'Karembo', 'Mugera', 'Murehe'],
    Nyagatare: ['Nyagatare', 'Karangazi', 'Mimuli', 'Tabagwe', 'Gatunda', 'Rukomo', 'Icyanya', 'Kiyombe', 'Rukomo East', 'Nyagatare Town'],
    Rwamagana: ['Rwamagana', 'Gahengeri', 'Kigabiro', 'Munyiginya', 'Muyumbu', 'Nzige', 'Nyakariro', 'Musha', 'Rubona', 'Kiziguro', 'Rwamagana Town'],
  },
};

const ROLES = [
  { name: 'CITIZEN', description: 'Level 1 — Community member who reports problems', isSystem: true },
  { name: 'CELL_OFFICER', description: 'Level 2 — Cell-level verification officer', isSystem: true },
  { name: 'SECTOR_OFFICER', description: 'Level 3 — Sector officer: verify, prioritize, assign', isSystem: true },
  { name: 'OFFICER', description: 'Legacy alias for government workflow officer (cell/sector scope)', isSystem: true },
  { name: 'DISTRICT_ADMIN', description: 'Level 4 — District officer / administrator', isSystem: true },
  { name: 'PROVINCE_ADMIN', description: 'Level 5 — Province authority: aggregated districts', isSystem: true },
  { name: 'CITY_ADMIN', description: 'Level 6 — Kigali City / city-level authority', isSystem: true },
  { name: 'NATIONAL_ADMIN', description: 'Level 7 — National institution / ministry-level user', isSystem: true },
  { name: 'EXECUTIVE', description: 'Level 8 — Senior national decision-maker (aggregated strategic data only)', isSystem: true },
  { name: 'SYSTEM_ADMIN', description: 'System administrator', isSystem: true },
  { name: 'ANALYST', description: 'Analytics and decision support user', isSystem: true },
];

const PERMISSIONS = [
  ['users.read', 'View users', 'View user accounts and assignments.'],
  ['users.manage', 'Manage users', 'Create, activate, deactivate and change user roles.'],
  ['roles.manage', 'Manage permissions', 'Grant role permissions to authorized users.'],
  ['reports.read', 'View reports', 'View operational reports within the assigned scope.'],
  ['reports.manage', 'Manage reports', 'Verify, assign, transition and resolve reports.'],
  ['reports.export', 'Export reports', 'Export authorized report data.'],
  ['ai.read', 'View AI intelligence', 'View AI analysis, priority and prediction signals.'],
  ['gis.read', 'View GIS intelligence', 'View maps, geographic statistics and risk layers.'],
  ['catalog.manage', 'Manage catalogs', 'Manage categories and departments.'],
  ['alerts.manage', 'Manage alerts', 'Publish and manage public service alerts.'],
  ['audit.read', 'View audit logs', 'Review accountability and security activity.'],
] as const;

const CATEGORIES = [
  { name: 'Roads', nameRw: 'Imihanda', nameFr: 'Routes', icon: '🚧', color: '#F59E0B', sortOrder: 1 },
  { name: 'Drainage', nameRw: 'Imyanda n\'amazi y\'imvura', nameFr: 'Drainage', icon: '💧', color: '#00A1DE', sortOrder: 2 },
  { name: 'Water', nameRw: 'Amazi', nameFr: 'Eau', icon: '🚰', color: '#0EA5E9', sortOrder: 3 },
  { name: 'Waste', nameRw: 'Imyanda', nameFr: 'Déchets', icon: '🗑️', color: '#84CC16', sortOrder: 4 },
  { name: 'Electricity', nameRw: 'Umuriro', nameFr: 'Électricité', icon: '⚡', color: '#EAB308', sortOrder: 5 },
  { name: 'Environment', nameRw: 'Ibidukikije', nameFr: 'Environnement', icon: '🌳', color: '#20603D', sortOrder: 6 },
  { name: 'Health', nameRw: 'Ubuzima', nameFr: 'Santé', icon: '🏥', color: '#EF4444', sortOrder: 7 },
  { name: 'Education', nameRw: 'Uburezi', nameFr: 'Éducation', icon: '🏫', color: '#8B5CF6', sortOrder: 8 },
  { name: 'Security', nameRw: 'Umutekano', nameFr: 'Sécurité', icon: '🛡️', color: '#64748B', sortOrder: 9 },
  { name: 'Transport', nameRw: 'Umwenduro', nameFr: 'Transport', icon: '🚌', color: '#14B8A6', sortOrder: 10 },
  { name: 'Other', nameRw: 'Ibindi', nameFr: 'Autre', icon: '📌', color: '#94A3B8', sortOrder: 99 },
];

const DEPARTMENTS = [
  { name: 'Infrastructure', nameRw: 'Ibikorwa remezo', nameFr: 'Infrastructure' },
  { name: 'Water & Sanitation', nameRw: 'Amazi n\'isuku', nameFr: 'Eau et Assainissement' },
  { name: 'Health Services', nameRw: 'Serivice z\'ubuzima', nameFr: 'Services de Santé' },
  { name: 'Environment', nameRw: 'Ibidukikije', nameFr: 'Environnement' },
  { name: 'Education', nameRw: 'Uburezi', nameFr: 'Éducation' },
  { name: 'Security & Public Order', nameRw: 'Umutekano', nameFr: 'Sécurité' },
];

async function main() {
  console.log('🌱 Seeding R-CPI database...');

  // 1. Geography
  const provinceIds: Record<string, number> = {};
  for (const [provinceName, districts] of Object.entries(RWANDA_GEO)) {
    const province = await prisma.province.upsert({
      where: { name: provinceName },
      update: {},
      create: { name: provinceName, code: provinceName.slice(0, 3).toUpperCase() },
    });
    provinceIds[provinceName] = province.id;

    for (const [districtName, sectors] of Object.entries(districts)) {
      const district = await prisma.district.upsert({
        where: { code: `${provinceName.slice(0, 2)}${districtName.slice(0, 3)}`.toUpperCase() },
        update: {},
        create: {
          provinceId: province.id,
          name: districtName,
          code: `${provinceName.slice(0, 2)}${districtName.slice(0, 3)}`.toUpperCase(),
        },
      });

      for (const sectorName of sectors) {
        await prisma.sector.upsert({
          where: { code: `${district.code}${sectorName.slice(0, 2)}`.toUpperCase() },
          update: {},
          create: {
            districtId: district.id,
            name: sectorName,
            code: `${district.code}${sectorName.slice(0, 2)}`.toUpperCase(),
          },
        });
      }
    }
  }
  console.log('✓ Geography: provinces, districts, sectors');

  // 2. Roles
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
  }
  console.log('✓ Roles');

  for (const [code, name, description] of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code }, update: { name, description }, create: { code, name, description } });
  }
  const systemRole = await prisma.role.findUnique({ where: { name: 'SYSTEM_ADMIN' } });
  if (systemRole) {
    const permissions = await prisma.permission.findMany();
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: systemRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: systemRole.id, permissionId: permission.id },
      });
    }
  }
  console.log('✓ Permissions and system-admin grants');

  // 3. Categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({ where: { name: cat.name }, update: cat, create: cat });
  }
  console.log('✓ Categories');

  // 4. Departments
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({ where: { name: dept.name }, update: {}, create: dept });
  }
  console.log('✓ Departments');

  // 5. Department → District routing (Infrastructure serves all districts)
  const infrastructure = await prisma.department.findUnique({ where: { name: 'Infrastructure' } });
  const allDistricts = await prisma.district.findMany();
  if (infrastructure) {
    for (const d of allDistricts) {
      await prisma.departmentDistrict.upsert({
        where: { departmentId_districtId: { departmentId: infrastructure.id, districtId: d.id } },
        update: {},
        create: { departmentId: infrastructure.id, districtId: d.id },
      });
    }
  }
  console.log('✓ Department district routing');

  // 6. Demo users across all RBAC levels so the admin user table shows the full role hierarchy.
  const demoUsers = [
    {
      firstName: 'Aline',
      lastName: 'Mukamana',
      email: 'citizen@rcpi.gov.rw',
      phone: '+250788111222',
      password: 'Citizen@123',
      roleName: 'CITIZEN',
      language: 'rw',
    },
    {
      firstName: 'Eric',
      lastName: 'Cell Officer',
      email: 'cell@rcpi.gov.rw',
      phone: '+250788111223',
      password: 'Cell@12345',
      roleName: 'CELL_OFFICER',
      language: 'rw',
    },
    {
      firstName: 'Jean',
      lastName: 'Habimana',
      email: 'officer@rcpi.gov.rw',
      phone: '+250788333444',
      password: 'Officer@123',
      roleName: 'OFFICER',
      language: 'en',
    },
    {
      firstName: 'Diane',
      lastName: 'Sector Officer',
      email: 'sector@rcpi.gov.rw',
      phone: '+250788333445',
      password: 'Sector@123',
      roleName: 'SECTOR_OFFICER',
      language: 'en',
    },
    {
      firstName: 'Rebecca',
      lastName: 'Niyonsenga',
      email: 'district-admin@rcpi.gov.rw',
      phone: '+250788222333',
      password: 'District@123',
      roleName: 'DISTRICT_ADMIN',
      language: 'en',
    },
    {
      firstName: 'Patrick',
      lastName: 'Province Admin',
      email: 'province@rcpi.gov.rw',
      phone: '+250788222334',
      password: 'Province@123',
      roleName: 'PROVINCE_ADMIN',
      language: 'en',
    },
    {
      firstName: 'Sandrine',
      lastName: 'City Admin',
      email: 'city@rcpi.gov.rw',
      phone: '+250788222335',
      password: 'CityAdmin@123',
      roleName: 'CITY_ADMIN',
      language: 'en',
    },
    {
      firstName: 'Emmanuel',
      lastName: 'Mugenzi',
      email: 'national-admin@rcpi.gov.rw',
      phone: '+250788444555',
      password: 'National@123',
      roleName: 'NATIONAL_ADMIN',
      language: 'en',
    },
    {
      firstName: 'Hon. Executive',
      lastName: 'Dashboard',
      email: 'executive@rcpi.gov.rw',
      phone: '+250788444556',
      password: 'Executive@123',
      roleName: 'EXECUTIVE',
      language: 'en',
    },
    {
      firstName: 'Grace',
      lastName: 'Uwase',
      email: 'admin@rcpi.gov.rw',
      phone: '+250788666777',
      password: 'Admin@123',
      roleName: 'SYSTEM_ADMIN',
      language: 'en',
    },
    {
      firstName: 'Claire',
      lastName: 'Uwingabire',
      email: 'analyst@rcpi.gov.rw',
      phone: '+250788999000',
      password: 'Analyst@123',
      roleName: 'ANALYST',
      language: 'fr',
    },
  ];

  const gasabo = await prisma.district.findFirst({ where: { name: 'Gasabo' } });
  const roleMap = new Map<string, number>();

  for (const role of ROLES) {
    const record = await prisma.role.findUniqueOrThrow({ where: { name: role.name } });
    roleMap.set(role.name, record.id);
  }

  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        passwordHash,
        preferredLanguage: user.language,
        roleId: roleMap.get(user.roleName) ?? roleMap.get('CITIZEN')!,
        provinceId: gasabo?.provinceId,
        districtId: gasabo?.id,
      },
    });
  }
  console.log('✓ Demo user roster loaded for all access levels: CITIZEN, OFFICER, DISTRICT_ADMIN, NATIONAL_ADMIN, SYSTEM_ADMIN, ANALYST');

  // ─────────────────────────────────────────────────────────────
  // 6.5 DEMO REPORTS — realistic Rwanda community problems spanning the
  // full lifecycle so every dashboard, map, queue and chart has data on
  // first run. Guarded: only seeded when the reports table is empty.
  // Clearly demo data — NOT official government statistics.
  // ─────────────────────────────────────────────────────────────
  const reportCount = await prisma.report.count();
  if (reportCount > 0) {
    console.log('↷ Reports table not empty — skipping demo report seed (existing data preserved)');
  } else {
    // Extra demo citizens living in different districts, so reports come
    // from several people and places (not just the main demo citizen).
    const demoReportCitizens: Array<{ firstName: string; lastName: string; email: string; district: string }> = [
      { firstName: 'Jean Bosco', lastName: 'Ntirenganya', email: 'citizen2@rcpi.gov.rw', district: 'Kicukiro' },
      { firstName: 'Claudine', lastName: 'Ingabire', email: 'citizen3@rcpi.gov.rw', district: 'Nyarugenge' },
      { firstName: 'Alphonse', lastName: 'Munyaneza', email: 'citizen4@rcpi.gov.rw', district: 'Huye' },
      { firstName: 'Vestine', lastName: 'Nyirahabimana', email: 'citizen5@rcpi.gov.rw', district: 'Musanze' },
      { firstName: 'Innocent', lastName: 'Bizimana', email: 'citizen6@rcpi.gov.rw', district: 'Rubavu' },
      { firstName: 'Odette', lastName: 'Uwamariya', email: 'citizen7@rcpi.gov.rw', district: 'Rusizi' },
      { firstName: 'Emmanuel', lastName: 'Nkusi', email: 'citizen8@rcpi.gov.rw', district: 'Nyagatare' },
    ];
    const citizenIds: Record<string, number> = {};
    for (const person of demoReportCitizens) {
      const district = await prisma.district.findFirst({ where: { name: person.district } });
      const passwordHash = await bcrypt.hash('Citizen@123', 12);
      const user = await prisma.user.upsert({
        where: { email: person.email },
        update: {},
        create: {
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          phone: '+25078800000' + (demoReportCitizens.indexOf(person) + 1),
          passwordHash,
          preferredLanguage: 'rw',
          roleId: roleMap.get('CITIZEN')!,
          provinceId: district?.provinceId,
          districtId: district?.id,
        },
      });
      citizenIds[person.district] = user.id;
    }
    citizenIds['Gasabo'] = (await prisma.user.findUniqueOrThrow({ where: { email: 'citizen@rcpi.gov.rw' } })).id;

    // Catalog lookups
    const categoryMap = new Map((await prisma.category.findMany()).map((c) => [c.name, c]));
    const departmentMap = new Map((await prisma.department.findMany()).map((d) => [d.name, d]));
    const officer = await prisma.user.findUnique({ where: { email: 'officer@rcpi.gov.rw' } });
    const sectorOfficer = await prisma.user.findUnique({ where: { email: 'sector@rcpi.gov.rw' } });
    const districtAdmin = await prisma.user.findUnique({ where: { email: 'district-admin@rcpi.gov.rw' } });
    const OFFICER_NAME = officer ? `${officer.firstName} ${officer.lastName}` : 'Government Officer';
    const SECTOR_NAME = sectorOfficer ? `${sectorOfficer.firstName} ${sectorOfficer.lastName}` : 'Sector Officer';
    const ADMIN_NAME = districtAdmin ? `${districtAdmin.firstName} ${districtAdmin.lastName}` : 'District Administrator';
    const officerId = officer?.id ?? null;
    const districtAdminId = districtAdmin?.id ?? null;

    interface DemoReportSpec {
      title: string;
      description: string;
      category: string;
      district: string;
      sector: string;
      status: string;
      urgency: 'LOW' | 'MEDIUM' | 'HIGH';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      priorityReason?: string;
      affectedPeople?: number;
      vulnerableGroup?: boolean;
      lat: number;
      lng: number;
      locationDescription: string;
      daysAgo: number;
      department?: string;
      deadlineInDays?: number; // days after creation; if in the past the report shows as overdue
      isPublic?: boolean;
      isAnonymous?: boolean;
      upvotes?: number;
      feedback?: { rating: number; comment: string };
      rejectReason?: string;
    }

    const demoReports: DemoReportSpec[] = [
      // ── Kigali — Gasabo ──
      {
        title: 'Blocked drainage canal flooding houses in Kacyiru',
        description: 'The drainage canal near Kacyiru market is blocked with waste and soil. Since the last two heavy rains, water floods into nearby houses. About 40 families are affected, including elderly residents. Waterborne disease risk is increasing.',
        category: 'Drainage', district: 'Gasabo', sector: 'Kacyiru', status: 'CLOSED',
        urgency: 'HIGH', priority: 'CRITICAL', priorityReason: 'Verified flooding of 40 households with health risk — immediate action required.',
        affectedPeople: 40, vulnerableGroup: true, lat: -1.9355, lng: 30.0902,
        locationDescription: 'Main canal behind Kacyiru market', daysAgo: 34, department: 'Infrastructure', deadlineInDays: 7,
        isPublic: true, upvotes: 27, feedback: { rating: 5, comment: 'The canal was cleared and our houses are safe now. Murakoze!' },
      },
      {
        title: 'Deep potholes on Remera-Kabuga road damaging vehicles',
        description: 'Large potholes have formed along the Remera stretch toward Kabuga. Matatus swerve to avoid them and two moto accidents happened this month. The road section needs resurfacing before the rainy season.',
        category: 'Roads', district: 'Gasabo', sector: 'Remera', status: 'IN_PROGRESS',
        urgency: 'MEDIUM', priority: 'HIGH', priorityReason: 'Recurring traffic accidents reported at this location.',
        affectedPeople: 120, lat: -1.9466, lng: 30.1119,
        locationDescription: 'Remera main road, near Kisimenti', daysAgo: 12, department: 'Infrastructure', deadlineInDays: 5,
        isPublic: true, upvotes: 41,
      },
      {
        title: 'Broken streetlights on Kimihurura pedestrian path',
        description: 'Three streetlights along the walkway from KG 7 Ave to the roundabout have been dark for two weeks. Women and children walking home after dark feel unsafe.',
        category: 'Electricity', district: 'Gasabo', sector: 'Kimihurura', status: 'ASSIGNED',
        urgency: 'MEDIUM', priority: 'MEDIUM', vulnerableGroup: true,
        affectedPeople: 30, lat: -1.9419, lng: 30.0846,
        locationDescription: 'KG 7 Ave pedestrian walkway', daysAgo: 6, department: 'Infrastructure', deadlineInDays: 10,
        isPublic: true, upvotes: 12,
      },
      {
        title: 'Uncollected garbage piling up in Gisozi',
        description: 'Household waste has not been collected in our cell for over a week. Bags are now piling along the roadside and the smell is affecting nearby shops.',
        category: 'Waste', district: 'Gasabo', sector: 'Gisozi', status: 'VERIFIED',
        urgency: 'MEDIUM', affectedPeople: 60, lat: -1.9218, lng: 30.0798,
        locationDescription: 'Gisozi market access road', daysAgo: 4, isPublic: true, upvotes: 18,
      },
      // ── Kigali — Kicukiro ──
      {
        title: 'No clean water in Gatenga for five days',
        description: 'Our taps have been dry for five days in lower Gatenga. Families are buying water at triple the normal price and some are drawing from an unprotected spring.',
        category: 'Water', district: 'Kicukiro', sector: 'Gatenga', status: 'RESOLVED',
        urgency: 'HIGH', priority: 'HIGH', priorityReason: 'Water outage affecting a dense residential area with price exploitation risk.',
        affectedPeople: 90, vulnerableGroup: true, lat: -1.9830, lng: 30.1237,
        locationDescription: 'Lower Gatenga, near the valley road', daysAgo: 21, department: 'Water & Sanitation', deadlineInDays: 5,
        isPublic: true, upvotes: 33, feedback: { rating: 4, comment: 'Water came back after the pipe was repaired. Good response.' },
      },
      {
        title: 'Drainage overflow flooding Kanombe roadside homes',
        description: 'Every heavy rain, the drainage along the airport road overflows into the compounds on the lower side. Malaria cases are rising because of stagnant water.',
        category: 'Drainage', district: 'Kicukiro', sector: 'Kanombe', status: 'ASSIGNED',
        urgency: 'HIGH', priority: 'CRITICAL', priorityReason: 'Public-health emergency signals: stagnant water and rising malaria cases.',
        affectedPeople: 150, vulnerableGroup: true, lat: -1.9687, lng: 30.1395,
        locationDescription: 'Airport road lower side drainage', daysAgo: 8, department: 'Infrastructure', deadlineInDays: 6,
        isPublic: true, upvotes: 22,
      },
      {
        title: 'Illegal dumpsite expanding in Niboye valley',
        description: 'Someone keeps dumping construction debris and household waste in the Niboye wetland buffer. It is blocking the natural water channel.',
        category: 'Waste', district: 'Kicukiro', sector: 'Niboye', status: 'REJECTED',
        urgency: 'LOW', lat: -1.9872, lng: 30.0936,
        locationDescription: 'Niboye valley wetland buffer', daysAgo: 15, rejectReason: 'Verified as a duplicate of an existing enforcement case (RCP handled by district environment office). Please follow the open case.',
      },
      // ── Kigali — Nyarugenge ──
      {
        title: 'Overflowing market waste in Nyamirambo',
        description: 'The collection point behind Nyamirambo market overflows every evening. Wind spreads plastics across the street and into the mosque courtyard.',
        category: 'Waste', district: 'Nyarugenge', sector: 'Nyamirambo', status: 'IN_PROGRESS',
        urgency: 'MEDIUM', affectedPeople: 200, lat: -1.9642, lng: 30.0474,
        locationDescription: 'Behind Nyamirambo main market', daysAgo: 9, department: 'Environment', deadlineInDays: 4,
        isPublic: true, upvotes: 25,
      },
      {
        title: 'Dark street on Muhima hill attracting break-ins',
        description: 'Both streetlight lines on the Muhima hill road have been off for a month. Residents report attempted break-ins at night and moto drivers avoid the route after 9pm.',
        category: 'Security', district: 'Nyarugenge', sector: 'Muhima', status: 'ESCALATED',
        urgency: 'HIGH', priority: 'HIGH', priorityReason: 'Public safety risk with repeated incident reports; needs district-level coordination.',
        affectedPeople: 80, lat: -1.9447, lng: 30.0556,
        locationDescription: 'Muhima hill road, both light lines', daysAgo: 17, department: 'Security & Public Order', deadlineInDays: 3,
        isPublic: true, upvotes: 37,
      },
      {
        title: 'Gitega market drainage channels clogged',
        description: 'The drainage channels around Gitega market are clogged with market residue. Rainwater now crosses into the shops. The problem returned after the earlier repair.',
        category: 'Drainage', district: 'Nyarugenge', sector: 'Gitega', status: 'REOPEN_REQUESTED',
        urgency: 'MEDIUM', affectedPeople: 50, lat: -1.9729, lng: 30.0298,
        locationDescription: 'Gitega market east entrance', daysAgo: 28, department: 'Infrastructure', deadlineInDays: 7,
        isPublic: true, upvotes: 9,
      },
      // ── Southern — Huye ──
      {
        title: 'Bridge culvert washed away on Huye-Butare road',
        description: 'The culvert linking our village to the Huye-Butare road was washed away by floods. Children now cross a temporary log to reach the school on the other side. Two motorcycles have already slipped.',
        category: 'Roads', district: 'Huye', sector: 'Butare', status: 'ASSIGNED',
        urgency: 'HIGH', priority: 'CRITICAL', priorityReason: 'School children crossing a dangerous temporary structure — imminent injury risk.',
        affectedPeople: 70, vulnerableGroup: true, lat: -2.5967, lng: 29.74,
        locationDescription: 'Village access culvert off Huye-Butare road', daysAgo: 11, department: 'Infrastructure', deadlineInDays: 5,
        isPublic: true, upvotes: 44,
      },
      {
        title: 'Tumba primary school classroom roof leaking',
        description: 'Rain leaks through the roof of two classrooms at Tumba primary school. Pupils move desks each time it rains and books are being destroyed.',
        category: 'Education', district: 'Huye', sector: 'Tumba', status: 'SUBMITTED',
        urgency: 'MEDIUM', affectedPeople: 110, vulnerableGroup: true, lat: -2.6233, lng: 29.751,
        locationDescription: 'Tumba primary school, blocks B and C', daysAgo: 3,
      },
      {
        title: 'Health centre incinerator smoke reaching homes',
        description: 'The Huye health centre incinerator releases thick smoke in the evenings toward our houses. Children with asthma are affected.',
        category: 'Health', district: 'Huye', sector: 'Huye', status: 'PENDING_VERIFICATION',
        urgency: 'MEDIUM', affectedPeople: 35, vulnerableGroup: true, lat: -2.58, lng: 29.73,
        locationDescription: '200m east of the health centre fence', daysAgo: 2,
      },
      // ── Northern — Musanze ──
      {
        title: 'Erosion gully threatening Muhoza hillside homes',
        description: 'A large erosion gully is expanding toward the houses on Muhoza hill after each rain. Two gardens have already been taken by the gully.',
        category: 'Environment', district: 'Musanze', sector: 'Muhoza', status: 'ASSIGNED',
        urgency: 'HIGH', priority: 'HIGH', priorityReason: 'Progressive erosion gully approaching residential structures.',
        affectedPeople: 25, lat: -1.4943, lng: 29.6321,
        locationDescription: 'Muhoza hillside above the tea road', daysAgo: 13, department: 'Environment', deadlineInDays: 12,
        isPublic: true, upvotes: 16,
      },
      {
        title: 'Park access road washed out near Kinigi',
        description: 'The road to the gorilla trekking trailhead near Kinigi lost its lower layer in the floods. Tourist vehicles are turning back and local guides lose a day of work each time.',
        category: 'Roads', district: 'Musanze', sector: 'Kinigi', status: 'VERIFIED',
        urgency: 'MEDIUM', affectedPeople: 45, lat: -1.4189, lng: 29.5732,
        locationDescription: 'Trailhead access road, last 800m', daysAgo: 5, isPublic: true, upvotes: 21,
      },
      {
        title: 'Burst water pipe flooding Cyuve roadside',
        description: 'A main pipe burst near the Cyuve trading centre has been leaking for a week. It wastes clean water and floods the roadside drain.',
        category: 'Water', district: 'Musanze', sector: 'Cyuve', status: 'RESOLVED',
        urgency: 'HIGH', priority: 'MEDIUM', priorityReason: 'Continuous loss of treated water on a main line.',
        affectedPeople: 0, lat: -1.4902, lng: 29.6032,
        locationDescription: 'Cyuve trading centre main road', daysAgo: 19, department: 'Water & Sanitation', deadlineInDays: 6,
        isPublic: true, upvotes: 14, feedback: { rating: 5, comment: 'Pipe replaced in three days. Very good work.' },
      },
      // ── Western — Rubavu ──
      {
        title: 'Beach drainage channel blocked in Gisenyi',
        description: 'The drainage channel that carries rainwater from the town to the lake is blocked with sand and waste. After rain, dirty water pools at the public beach entrance.',
        category: 'Drainage', district: 'Rubavu', sector: 'Gisenyi', status: 'IN_PROGRESS',
        urgency: 'MEDIUM', affectedPeople: 100, lat: -1.6988, lng: 29.2561,
        locationDescription: 'Public beach main drainage outflow', daysAgo: 10, department: 'Infrastructure', deadlineInDays: 4,
        isPublic: true, upvotes: 29,
      },
      {
        title: 'Frequent power cuts affecting Rubavu businesses',
        description: 'Our trading centre loses power several hours every day this month. Butcheries and salons are losing stock and income.',
        category: 'Electricity', district: 'Rubavu', sector: 'Rubavu', status: 'SUBMITTED',
        urgency: 'MEDIUM', affectedPeople: 60, lat: -1.671, lng: 29.308,
        locationDescription: 'Rubavu town trading centre', daysAgo: 1,
      },
      {
        title: 'Broken spring protection in Nyamyumba',
        description: 'The protected spring that supplies our village collapsed at the collection point. Water now mixes with surface runoff and children fetch from it anyway because there is no alternative.',
        category: 'Water', district: 'Rubavu', sector: 'Nyamyumba', status: 'PENDING_VERIFICATION',
        urgency: 'HIGH', priority: 'HIGH', priorityReason: 'Protected spring collapsed — direct contamination risk for the whole village.',
        affectedPeople: 85, vulnerableGroup: true, lat: -1.7128, lng: 29.227,
        locationDescription: 'Village spring below the church hill', daysAgo: 3,
      },
      // ── Western — Rusizi ──
      {
        title: 'Stagnant water breeding mosquitoes near Rusizi market',
        description: 'Low areas near the market hold stagnant water for weeks. Malaria cases in our street doubled this season according to the community health worker.',
        category: 'Health', district: 'Rusizi', sector: 'Rusizi', status: 'ASSIGNED',
        urgency: 'HIGH', priority: 'CRITICAL', priorityReason: 'Malaria vector breeding site in a dense market area — public health priority.',
        affectedPeople: 180, vulnerableGroup: true, lat: -2.4833, lng: 28.9,
        locationDescription: 'Low ground behind Rusizi market', daysAgo: 14, department: 'Health Services', deadlineInDays: 5,
        isPublic: true, upvotes: 38,
      },
      {
        title: 'Road section cut off by rain in Bugarama',
        description: 'The weekend rains cut the road between our cell and Bugarama centre. Motorcycles cannot pass and sick people are carried on foot to the main road.',
        category: 'Roads', district: 'Rusizi', sector: 'Bugarama', status: 'ESCALATED',
        urgency: 'HIGH', priority: 'HIGH', priorityReason: 'Community cut off from the health facility access route.',
        affectedPeople: 65, vulnerableGroup: true, lat: -2.5383, lng: 28.8933,
        locationDescription: 'Cell access road, 1.2km from centre', daysAgo: 7, department: 'Infrastructure', deadlineInDays: 8,
        isPublic: true, upvotes: 19,
      },
      // ── Eastern — Nyagatare ──
      {
        title: 'Cattle watering point contaminated in Nyagatare',
        description: 'The shared watering point for cattle has turned muddy and contaminated. Herders now water animals in the stream that passes near our homes.',
        category: 'Water', district: 'Nyagatare', sector: 'Nyagatare', status: 'VERIFIED',
        urgency: 'MEDIUM', affectedPeople: 40, lat: -1.3167, lng: 30.3167,
        locationDescription: 'Communal cattle watering point', daysAgo: 6, isPublic: true, upvotes: 8,
      },
      {
        title: 'Mimuli primary school needs two more classrooms',
        description: 'Pupils in P2 and P3 study under the tree outside because classrooms are full. When it rains, lessons stop completely.',
        category: 'Education', district: 'Nyagatare', sector: 'Mimuli', status: 'SUBMITTED',
        urgency: 'LOW', affectedPeople: 95, vulnerableGroup: true, lat: -1.3622, lng: 30.3324,
        locationDescription: 'Mimuli primary school compound', daysAgo: 2,
      },
    ];

    // Status history chains per final status (master spec §6 lifecycle).
    function chainFor(spec: DemoReportSpec): Array<{ to: string; note: string; actor: string }> {
      const base: Array<{ to: string; note: string; actor: string }> = [
        { to: 'SUBMITTED', note: 'Report submitted. Awaiting review.', actor: 'Citizen' },
        { to: 'AI_ANALYSIS', note: 'AI analysis completed (advisory only). Summary, severity and department suggestion attached.', actor: 'R-CPI System' },
      ];
      const s = spec.status;
      if (s === 'SUBMITTED') return [base[0]];
      if (s === 'PENDING_VERIFICATION') return [...base, { to: 'PENDING_VERIFICATION', note: 'Awaiting officer verification.', actor: 'R-CPI System' }];
      if (s === 'REJECTED') return [...base, { to: 'REJECTED', note: spec.rejectReason ?? 'Rejected after review.', actor: SECTOR_NAME }];
      if (s === 'VERIFIED') return [...base, { to: 'PENDING_VERIFICATION', note: 'Awaiting officer verification.', actor: 'R-CPI System' }, { to: 'VERIFIED', note: 'Verified on site by the field coordinator.', actor: OFFICER_NAME }];
      const throughVerify = [...base, { to: 'PENDING_VERIFICATION', note: 'Awaiting officer verification.', actor: 'R-CPI System' }, { to: 'VERIFIED', note: 'Verified on site by the field coordinator.', actor: OFFICER_NAME }];
      const assignStep = { to: 'ASSIGNED', note: `Assigned to the responsible department (${spec.department ?? 'Infrastructure'}) with a service-standard deadline.`, actor: SECTOR_NAME };
      if (s === 'ASSIGNED') return [...throughVerify, assignStep];
      if (s === 'IN_PROGRESS') return [...throughVerify, assignStep, { to: 'IN_PROGRESS', note: 'Field team deployed; work is underway.', actor: OFFICER_NAME }];
      if (s === 'WAITING_CITIZEN') return [...throughVerify, assignStep, { to: 'WAITING_CITIZEN', note: 'More information requested from the citizen (exact locations and dates).', actor: OFFICER_NAME }];
      if (s === 'ESCALATED') return [...throughVerify, assignStep, { to: 'ESCALATED', note: 'Escalated to the district for additional resources and coordination.', actor: SECTOR_NAME }];
      if (s === 'RESOLVED') return [...throughVerify, assignStep, { to: 'IN_PROGRESS', note: 'Field team deployed; work is underway.', actor: OFFICER_NAME }, { to: 'RESOLVED', note: 'Work completed and inspected on site.', actor: OFFICER_NAME }];
      if (s === 'CLOSED') return [...throughVerify, assignStep, { to: 'IN_PROGRESS', note: 'Field team deployed; work is underway.', actor: OFFICER_NAME }, { to: 'RESOLVED', note: 'Work completed and inspected on site.', actor: OFFICER_NAME }, { to: 'CLOSED', note: 'Closure approved after final inspection.', actor: ADMIN_NAME }];
      if (s === 'REOPEN_REQUESTED') return [...throughVerify, assignStep, { to: 'IN_PROGRESS', note: 'Field team deployed; work is underway.', actor: OFFICER_NAME }, { to: 'RESOLVED', note: 'Work completed and inspected on site.', actor: OFFICER_NAME }, { to: 'CLOSED', note: 'Closure approved after final inspection.', actor: ADMIN_NAME }, { to: 'REOPEN_REQUESTED', note: 'Citizen reports the problem has returned; reopening requested.', actor: 'Citizen' }];
      return base;
    }

    const year = new Date().getFullYear();
    let createdReports = 0;
    for (let i = 0; i < demoReports.length; i++) {
      const spec = demoReports[i];
      const province = await prisma.district.findFirst({ where: { name: spec.district }, include: { province: true } });
      if (!province) continue;
      const sector = (await prisma.sector.findFirst({ where: { districtId: province.id, name: spec.sector } }))
        ?? (await prisma.sector.findFirst({ where: { districtId: province.id } }));
      const category = categoryMap.get(spec.category);
      if (!category) continue;
      const department = spec.department ? departmentMap.get(spec.department) : undefined;
      const citizenId = citizenIds[spec.district] ?? citizenIds['Gasabo'];
      const createdAt = new Date(Date.now() - spec.daysAgo * 86_400_000);
      const reference = `RCP-${year}-${String(100000 + i).padStart(6, '0')}`;

      const isVerifiedPlus = ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CITIZEN', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPEN_REQUESTED'].includes(spec.status);
      const chain = chainFor(spec);
      const stepMs = (spec.daysAgo * 86_400_000 * 0.85) / Math.max(chain.length, 1);
      const lastStepTime = new Date(createdAt.getTime() + stepMs * (chain.length - 1));

      const report = await prisma.report.create({
        data: {
          reference,
          title: spec.title,
          description: spec.description,
          status: spec.status,
          urgency: spec.urgency,
          priority: spec.priority ?? null,
          priorityReason: spec.priorityReason ?? null,
          affectedPeople: spec.affectedPeople ?? null,
          vulnerableGroup: spec.vulnerableGroup ?? false,
          severity: spec.priority ?? null,
          deadline: spec.deadlineInDays ? new Date(createdAt.getTime() + spec.deadlineInDays * 86_400_000) : null,
          deadlineReason: spec.deadlineInDays ? 'Service standard for this category' : null,
          escalatedAt: spec.status === 'ESCALATED' ? lastStepTime : null,
          escalatedTo: spec.status === 'ESCALATED' ? 'DISTRICT' : null,
          escalationNote: spec.status === 'ESCALATED' ? 'Needs district-level coordination and resources.' : null,
          closedAt: ['CLOSED', 'REOPEN_REQUESTED'].includes(spec.status) ? new Date(createdAt.getTime() + stepMs * (chain.length - 2)) : null,
          citizenId,
          categoryId: category.id,
          departmentId: department?.id ?? null,
          assignedOfficerId: isVerifiedPlus && officerId ? officerId : null,
          provinceId: province.provinceId,
          districtId: province.id,
          sectorId: sector?.id ?? null,
          latitude: String(spec.lat),
          longitude: String(spec.lng),
          locationDescription: spec.locationDescription,
          // AI advisory fields — filled as the in-process heuristic would produce
          aiCategory: isVerifiedPlus || spec.status === 'PENDING_VERIFICATION' ? spec.category : null,
          aiConfidence: isVerifiedPlus || spec.status === 'PENDING_VERIFICATION' ? 0.62 + (i % 5) * 0.05 : null,
          aiPriorityScore: isVerifiedPlus || spec.status === 'PENDING_VERIFICATION' ? 0.35 + (i % 7) * 0.08 : null,
          aiSummary: isVerifiedPlus || spec.status === 'PENDING_VERIFICATION'
            ? `Heuristic triage: reported in ${spec.district}; category "${spec.category}"; GPS coordinates provided. Advisory only — officer verification required.`
            : null,
          aiModel: isVerifiedPlus || spec.status === 'PENDING_VERIFICATION' ? 'heuristic-local-v1' : null,
          aiReviewed: isVerifiedPlus,
          aiReviewedBy: isVerifiedPlus ? officerId : null,
          aiReviewedAt: isVerifiedPlus ? lastStepTime : null,
          isAnonymous: spec.isAnonymous ?? false,
          isPublic: spec.isPublic ?? false,
          upvotes: spec.upvotes ?? 0,
          createdAt,
          updatedAt: lastStepTime,
          resolvedAt: ['RESOLVED', 'CLOSED', 'REOPEN_REQUESTED'].includes(spec.status) ? new Date(createdAt.getTime() + stepMs * (chain.length - 2)) : null,
        },
      });
      createdReports++;

      // Immutable status history matching the lifecycle chain
      for (let k = 0; k < chain.length; k++) {
        const step = chain[k];
        await prisma.reportStatusHistory.create({
          data: {
            reportId: report.id,
            fromStatus: k === 0 ? null : chain[k - 1].to,
            toStatus: step.to,
            note: step.note,
            actorName: step.actor,
            actorId: step.actor === OFFICER_NAME ? officerId : step.actor === ADMIN_NAME ? districtAdminId : null,
            createdAt: new Date(createdAt.getTime() + stepMs * k),
          },
        });
      }

      // Citizen-facing progress update for advanced cases
      if (['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED'].includes(spec.status)) {
        await prisma.reportUpdate.create({
          data: {
            reportId: report.id,
            message: spec.status === 'ESCALATED'
              ? 'Your report has been escalated to the district team for faster coordination.'
              : 'Government team is on site / has completed the work. Thank you for reporting.',
            authorName: OFFICER_NAME,
            isPublic: true,
          },
        });
      }

      // Reopen request record for the reopened case
      if (spec.status === 'REOPEN_REQUESTED') {
        await prisma.reportReopenRequest.create({
          data: { reportId: report.id, reason: 'The drainage clogged again two weeks after the repair. Water still enters the shops when it rains.', status: 'PENDING', actorName: 'Citizen' },
        });
      }

      // Feedback where the citizen already rated the resolution
      if (spec.feedback && ['RESOLVED', 'CLOSED'].includes(spec.status)) {
        await prisma.feedback.create({
          data: { reportId: report.id, rating: spec.feedback.rating, comment: spec.feedback.comment, createdAt: lastStepTime },
        });
      }

      // AI advisory records (job + analysis + predictions) for reports whose
      // AI fields are populated, so the AI analysis page and AI dashboard have
      // real rows to display. Advisory only — human review is recorded.
      if (isVerifiedPlus || spec.status === 'PENDING_VERIFICATION') {
        const aiConf = 0.62 + (i % 5) * 0.05;
        const job = await prisma.aIJob.create({
          data: {
            reportId: report.id,
            status: 'COMPLETED',
            attempts: 1,
            startedAt: new Date(createdAt.getTime() + 60_000),
            completedAt: new Date(createdAt.getTime() + 90_000),
          },
        });
        const analysis = await prisma.aIAnalysis.create({
          data: {
            reportId: report.id,
            jobId: job.id,
            language: 'en',
            overallConfidence: aiConf,
            status: 'COMPLETED',
            explanation: `Heuristic triage: reported in ${spec.district}; category "${spec.category}"; GPS coordinates provided. Advisory only — officer verification required.`,
            auditLogs: { create: { event: 'AI_PREDICTION_CREATED', detail: 'Demo seed: heuristic-local-v1 (advisory, human review required)' } },
          },
        });
        await prisma.aIPrediction.createMany({
          data: [
            { analysisId: analysis.id, predictionType: 'CATEGORY', predictionValue: spec.category, confidenceScore: aiConf, modelVersion: 'heuristic-local-v1' },
            { analysisId: analysis.id, predictionType: 'SEVERITY', predictionValue: spec.priority ?? spec.urgency === 'HIGH' ? 'HIGH' : 'MEDIUM', confidenceScore: 0.55, modelVersion: 'heuristic-local-v1' },
            { analysisId: analysis.id, predictionType: 'SPAM_RISK', predictionValue: 'LOW_RISK', confidenceScore: 0.95, modelVersion: 'heuristic-local-v1' },
          ],
        });
        // Officer confirmation of the AI suggestion on advanced reports
        if (isVerifiedPlus && officerId) {
          await prisma.aIAuditLog.create({
            data: { analysisId: analysis.id, event: 'AI_REVIEWED', actorId: officerId, detail: 'Confirmed by officer during verification (demo)', createdAt: lastStepTime },
          });
        }
      }

      // Notifications to the reporting citizen for terminal states
      if (['RESOLVED', 'CLOSED', 'REJECTED', 'REOPEN_REQUESTED'].includes(spec.status)) {
        const nType = spec.status === 'REJECTED' ? 'REPORT_REJECTED' : spec.status === 'REOPEN_REQUESTED' ? 'REPORT_REOPENED' : spec.status === 'CLOSED' ? 'REPORT_CLOSED' : 'REPORT_RESOLVED';
        await prisma.notification.create({
          data: {
            userId: citizenId,
            type: nType,
            title: `Report ${spec.status.replace('_', ' ').toLowerCase()}`,
            message: `Your report ${reference} — ${spec.title.slice(0, 60)}`, 
            reportId: report.id,
            isRead: i % 2 === 0,
          },
        });
      }
    }
    console.log(`✓ ${createdReports} demo reports across ${new Set(demoReports.map((r) => r.district)).size} districts (statuses: SUBMITTED → CLOSED, demo data)`);
  }

  // 7. A sample community alert
  const existingAlert = await prisma.communityAlert.findFirst();
  if (!existingAlert) {
    await prisma.communityAlert.create({
      data: {
        title: 'Heavy rainfall expected in Kigali',
        message: 'Residents are advised to avoid blocked drainage areas and report any flooding through R-CPI. Community safety is a shared responsibility.',
        severity: 'WARNING',
        category: 'Weather-related',
        provinceId: provinceIds['Kigali'] ?? null,
      },
    });
    console.log('✓ Sample community alert');
  }

  console.log('🎉 Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
