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
  { name: 'CITIZEN', description: 'Community member who reports problems', isSystem: true },
  { name: 'OFFICER', description: 'Government officer handling reports', isSystem: true },
  { name: 'DISTRICT_ADMIN', description: 'District-level administrator', isSystem: true },
  { name: 'NATIONAL_ADMIN', description: 'National-level administrator', isSystem: true },
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
      firstName: 'Jean',
      lastName: 'Habimana',
      email: 'officer@rcpi.gov.rw',
      phone: '+250788333444',
      password: 'Officer@123',
      roleName: 'OFFICER',
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
      firstName: 'Emmanuel',
      lastName: 'Mugenzi',
      email: 'national-admin@rcpi.gov.rw',
      phone: '+250788444555',
      password: 'National@123',
      roleName: 'NATIONAL_ADMIN',
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
