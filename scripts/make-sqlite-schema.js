#!/usr/bin/env node
/**
 * scripts/make-sqlite-schema.js — keep local dev on SQLite automatically.
 *
 * The canonical schema (backend/prisma/schema.prisma) targets MySQL for
 * deployment (Vercel + managed MySQL). SQLite — used for local dev — does not
 * support MySQL native type annotations (@db.VarChar, @db.Text, …), so this
 * script derives backend/prisma/schema.sqlite.prisma from the canonical file:
 *
 *   - datasource provider "mysql" → "sqlite"
 *   - removes the Vercel-only `binaryTargets` line
 *   - strips @db.VarChar/@db.Text/@db.Decimal annotations
 *
 * Everything else (models, relations, indexes, defaults) stays identical, so
 * the two schemas can never drift apart. Zero dependencies.
 *
 * Run automatically by `npm run db:push` (see backend/package.json), or from
 * the repo root:  node scripts/make-sqlite-schema.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(ROOT, 'backend', 'prisma', 'schema.prisma');
const TARGET = path.join(ROOT, 'backend', 'prisma', 'schema.sqlite.prisma');

const HEADER = `// ─────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit.
//
// Derived from prisma/schema.prisma (canonical, MySQL) by
// scripts/make-sqlite-schema.js — runs automatically via \`npm run db:push\`.
// Local dev uses SQLite (backend/prisma/dev.db); deployment uses MySQL.
// ─────────────────────────────────────────────────────────────

`;

if (!fs.existsSync(CANONICAL)) {
  console.error(`✗ Canonical schema not found: ${path.relative(ROOT, CANONICAL)}`);
  process.exit(1);
}

const schema = fs.readFileSync(CANONICAL, 'utf8');

const sqlite = schema
  // mysql → sqlite provider
  .replace(/provider\s*=\s*"mysql"/, 'provider = "sqlite"')
  // drop the Vercel-only binaryTargets line and its explanatory comment
  .replace(/^\s*\/\/ "native" for local dev.*$\n?/m, '')
  .replace(/^\s*binaryTargets\s*=.*$\n?/m, '')
  // strip MySQL native type annotations (unsupported on SQLite)
  .replace(/\s*@db\.VarChar\(\d+\)/g, '')
  .replace(/\s*@db\.Text/g, '')
  .replace(/\s*@db\.Decimal\([^)]*\)/g, '');

fs.writeFileSync(TARGET, HEADER + sqlite);
console.log(`✓ Wrote ${path.relative(ROOT, TARGET)} (derived from schema.prisma, MySQL → SQLite)`);
