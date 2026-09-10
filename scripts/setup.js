#!/usr/bin/env node
/**
 * scripts/setup.js — one-time project setup: `npm run setup` (from repo root).
 *
 * 1. Verifies Node 18+.
 * 2. Installs backend + frontend dependencies.
 * 3. Creates backend/.env from .env.example if missing (then stops so you can
 *    fill in your MySQL password / JWT secrets before the database step).
 * 4. Generates the Prisma client, pushes the schema to MySQL, and seeds demo
 *    data — only if the database is empty (existing data is never wiped).
 *
 * Zero dependencies.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

const c = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

const step = (msg) => console.log(`\n${c.cyan('▸ ' + msg)}`);
const ok = (msg) => console.log(`  ${c.green('✓')} ${msg}`);
const warn = (msg) => console.log(`  ${c.yellow('!')} ${msg}`);
const fail = (msg) => {
  console.error(`  ${c.red('✗')} ${msg}`);
  process.exit(1);
};

function run(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

// 1 ── Node version
step('Checking prerequisites…');
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 18) fail(`Node.js 18+ is required (found ${process.versions.node}).`);
ok(`Node.js ${process.versions.node}`);

// 2 ── Dependencies
step('Installing backend dependencies…');
if (!run('npm install', BACKEND)) fail('backend npm install failed.');
ok('backend dependencies installed');

step('Installing frontend dependencies…');
if (!run('npm install', FRONTEND)) fail('frontend npm install failed.');
ok('frontend dependencies installed');

// 3 ── backend/.env
step('Configuring backend/.env…');
const envPath = path.join(BACKEND, '.env');
const examplePath = path.join(BACKEND, '.env.example');
if (fs.existsSync(envPath)) {
  ok('backend/.env already exists — keeping your values.');
} else {
  if (!fs.existsSync(examplePath)) fail('backend/.env.example is missing.');
  fs.copyFileSync(examplePath, envPath);
  ok('Created backend/.env from .env.example.');
  console.log(`
  ${c.yellow('Next steps:')}
    1. Open ${c.cyan('backend/.env')} and set MYSQL_PASSWORD (and JWT secrets).
       Generate a secret with:
         node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
    2. Re-run ${c.cyan('npm run setup')} to finish database setup.
  `);
  process.exit(0);
}

// 4 ── Prisma client + schema
step('Generating Prisma client…');
if (!run('npx prisma generate', BACKEND)) fail('prisma generate failed.');
ok('Prisma client generated');

step('Syncing database schema (prisma db push)…');
if (!run('npx prisma db push', BACKEND)) {
  fail('prisma db push failed. Check that MySQL is running and the MYSQL_* values in backend/.env are correct.');
}
ok('Database schema is in sync with prisma/schema.prisma');

// 5 ── Seed only if the database has no users yet (never wipes existing data)
step('Checking for existing data…');
const probe = path.join(BACKEND, '.seed-probe.tmp.ts');
fs.writeFileSync(
  probe,
  "import { prisma } from './src/config/db';\n" +
    'prisma.user.count()\n' +
    '  .then((n) => { console.log(n); return prisma.$disconnect(); })\n' +
    '  .catch(() => process.exit(1));\n'
);
let userCount = -1;
try {
  userCount = parseInt(execSync('npx tsx .seed-probe.tmp.ts', { cwd: BACKEND, encoding: 'utf8' }).trim(), 10);
} catch {
  userCount = -1;
}
fs.rmSync(probe, { force: true });

if (userCount > 0) {
  ok(`Database already seeded (${userCount} users found) — existing data preserved.`);
} else {
  step('Seeding demo data…');
  if (!run('npx tsx prisma/seed.ts', BACKEND)) fail('Seeding failed.');
  ok('Demo data seeded (geography, categories, departments, demo users).');
}

console.log(`
  ${c.green('Setup complete!')}

  Start the app:
    ${c.cyan('npm run dev')}        # backend :5000 + frontend :5173

  Demo accounts (also shown on the Login page):
    citizen@rcpi.gov.rw / Citizen@123
    officer@rcpi.gov.rw / Officer@123
    admin@rcpi.gov.rw   / Admin@123
`);
