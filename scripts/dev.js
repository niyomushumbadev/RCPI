#!/usr/bin/env node
/**
 * scripts/dev.js — launch backend + frontend together for development.
 *
 * - Starts backend (port 5000) and frontend (vite, port 5173).
 * - Color-codes and prefixes each line: [api] / [web].
 * - Ctrl+C (SIGINT) shuts BOTH processes down cleanly — no orphans left
 *   holding the ports (the exact problem that causes "Unexpected server
 *   response" or "Port 5173 is in use" on the next run).
 * - If a child dies on its own, the other one is stopped and the script exits,
 *   so a crashed backend never leaves you staring at a dead frontend.
 *
 * Zero dependencies. Run from the repo root:  npm run dev
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const COLORS = {
  api: '\x1b[36m', // cyan
  web: '\x1b[35m', // magenta
  sys: '\x1b[33m', // yellow
};
const RESET = '\x1b[0m';

function log(tag, line) {
  const color = COLORS[tag] ?? '';
  process.stdout.write(`${color}[${tag}]${RESET} ${line}\n`);
}

function parsePort(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Ports must match frontend/vite.config.ts (proxy target) and backend/.env
const API_PORT = parsePort(process.env.PORT, 5000);
const WEB_PORT = parsePort(process.env.VITE_PORT, 5173);
const AI_PORT = parsePort(process.env.AI_PORT, 8000);

const children = [];
let shuttingDown = false;

function start(name, command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: process.platform === 'win32', // npm needs the shell on Windows
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const forward = (stream, target) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.trim()) log(name, line.replace(/\s+$/, ''));
      }
    });
    stream.on('end', () => {
      if (buffer.trim()) target.write(buffer); // flush a trailing partial line
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      log('sys', `${name} exited (code=${code ?? 'null'}${signal ? `, signal=${signal}` : ''}) — shutting everything down.`);
      shutdown(1);
    }
  });

  children.push(child);
  return child;
}

function freePortNow(port, label) {
  const pids = pidsOnPort(port);
  if (pids.length) {
    log('sys', `Port ${port} (${label}) is busy — freeing it (pids: ${pids.join(', ')})…`);
    killPids(pids);
  }
}

// Refuse to start on top of stale servers from a previous session — the #1
// cause of "Unexpected server response" and proxy errors.
freePortNow(API_PORT, 'API');
freePortNow(WEB_PORT, 'web');
freePortNow(AI_PORT, 'AI');

function pidsOnPort(port) {
  try {
    // netstat works on Windows and (with -tlnp semantics) similar on unix;
    // we parse output in JS so no grep is needed under cmd.exe.
    const out = require('child_process').execSync('netstat -ano', { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const cols = line.trim().split(/\s+/);
      // TCP    0.0.0.0:5000    0.0.0.0:0    LISTENING    1234
      if (cols.length >= 5 && cols[3] === 'LISTENING' && cols[1].endsWith(`:${port}`)) {
        const pid = Number(cols[4]);
        if (Number.isFinite(pid) && pid !== process.pid) pids.add(String(pid));
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync(`taskkill /pid ${pid} /t /f`, { stdio: 'ignore' });
      } else {
        process.kill(Number(pid), 'SIGKILL');
      }
    } catch {
      /* already gone */
    }
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('sys', 'Stopping dev servers…');

  for (const child of children) {
    if (child.exitCode !== null) continue;
    // Kill the whole process tree: npm→node→tsx/vite on Windows needs taskkill
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }

  // Belt-and-braces: make sure the ports are actually free, whatever survived
  // (deep tsx/vite children are not always covered by the tree kill).
  setTimeout(() => {
    const stragglers = [...pidsOnPort(API_PORT), ...pidsOnPort(WEB_PORT)];
    if (stragglers.length) {
      log('sys', `Freeing ports ${API_PORT}/${WEB_PORT} (pids: ${stragglers.join(', ')})…`);
      killPids(stragglers);
    }
    process.exit(exitCode);
  }, 1500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

log('sys', `Starting R-CPI dev environment (API :${API_PORT} · web :${WEB_PORT} · AI :${AI_PORT})`);
log('sys', 'Press Ctrl+C to stop both servers.');

start('api', 'npm', ['run', 'dev'], path.join(ROOT, 'backend'));
start('web', 'npm', ['run', 'dev'], path.join(ROOT, 'frontend'), { PORT: String(WEB_PORT) });
start('ai', 'python', ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(AI_PORT)], path.join(ROOT, 'ai-service'));
