#!/usr/bin/env node
/**
 * scripts/prisma-setup.js — env-aware Prisma client generation & schema push.
 *
 * Chooses the right Prisma schema for the current environment:
 *
 *   - DATABASE_URL is a file: URL (or missing → local dev default)
 *       → derives backend/prisma/schema.sqlite.prisma from the canonical
 *         MySQL schema (scripts/make-sqlite-schema.js) and uses it.
 *   - DATABASE_URL is mysql:// (e.g. on Vercel with managed MySQL)
 *       → uses the canonical backend/prisma/schema.prisma directly.
 *
 * Commands:
 *   node scripts/prisma-setup.js generate
 *   node scripts/prisma-setup.js push
 *
 * Used by backend/package.json (prisma:generate, db:push) and therefore by
 * the Vercel build — zero dependencies.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const ENV_FILE = path.join(BACKEND, '.env');

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (fs.existsSync(ENV_FILE)) {
    const line = fs
      .readFileSync(ENV_FILE, 'utf8')
      .split(/\r?\n/)
      .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
    if (line) {
      const value = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
      if (value) return value;
    }
  }
  return null;
}

function useSqlite() {
  const url = readDatabaseUrl();
  if (process.env.VERCEL && !url) {
    console.error(
      '✗ DATABASE_URL is not set for this Vercel build.\n' +
        '  Add it in Vercel → Settings → Environment Variables (a mysql:// URL)\n' +
        '  and redeploy. Refusing to build with the local-dev SQLite schema.'
    );
    process.exit(1);
  }
  return !url || url.startsWith('file:');
}

function schemaArgs() {
  if (!useSqlite()) return ['--schema', 'prisma/schema.prisma'];
  // Freshen the derived SQLite schema, then use it.
  execSync(`node "${path.join(__dirname, 'make-sqlite-schema.js')}"`, { stdio: 'inherit' });
  return ['--schema', 'prisma/schema.sqlite.prisma'];
}

const [command] = process.argv.slice(2);
if (command !== 'generate' && command !== 'push') {
  console.error('Usage: node scripts/prisma-setup.js <generate|push>');
  process.exit(1);
}
// Prisma's CLI command is `db push`, not `push`.
const prismaCommand = command === 'push' ? 'db push' : command;

const target = useSqlite() ? 'SQLite (local dev)' : 'MySQL (managed/production)';
try {
  execSync(`npx prisma ${prismaCommand} ${schemaArgs().join(' ')}`, { cwd: BACKEND, stdio: 'inherit' });
  console.log(`✓ prisma ${command} → ${target}`);
} catch (err) {
  process.exit(err.status ?? 1);
}
