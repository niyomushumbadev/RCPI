/**
 * One-off codemod: convert emoji icons to Font Awesome across frontend pages.
 * Run: node scripts/convert-icons.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'frontend/src';

// Simple emoji → FA name conversions used in string/JSX contexts.
const MAP = {
  '📋': 'fa-clipboard-list', '📥': 'fa-inbox', '🙋': 'fa-user-check', '👥': 'fa-users',
  '✅': 'fa-circle-check', '✔️': 'fa-circle-check', '✔': 'fa-circle-check', '✓': 'fa-check',
  '🗂️': 'fa-box-archive', '🗂': 'fa-box-archive', '🗃️': 'fa-box-archive',
  '🏛️': 'fa-landmark', '🏛': 'fa-landmark', '📌': 'fa-thumbtack',
  '⚠️': 'fa-triangle-exclamation', '⚠': 'fa-triangle-exclamation',
  '🚫': 'fa-ban', '🚨': 'fa-triangle-exclamation', '🔴': 'fa-circle text-red-600',
  '🟡': 'fa-circle text-amber-500', '🟢': 'fa-circle text-emerald-600',
  '🔍': 'fa-magnifying-glass', '🔧': 'fa-screwdriver-wrench', '📦': 'fa-boxes-stacked',
  '🔁': 'fa-rotate', '🎉': 'fa-champagne-glasses', '📭': 'fa-inbox', '📬': 'fa-envelope',
  '🔕': 'fa-bell-slash', '🔔': 'fa-bell', '🗺️': 'fa-map-location-dot', '🗺': 'fa-map-location-dot',
  '🌍': 'fa-globe', '📝': 'fa-file-pen', '📷': 'fa-camera', '🎥': 'fa-video',
  '📍': 'fa-location-dot', '🤖': 'fa-robot', '👤': 'fa-user', '❓': 'fa-circle-question',
  '🏠': 'fa-house', '👋': 'fa-hand', '✍️': 'fa-pen-nib', '🔓': 'fa-lock-open',
  '📈': 'fa-arrow-trend-up', '⏱️': 'fa-stopwatch', '⏱': 'fa-stopwatch', '⏰': 'fa-clock',
  '🔒': 'fa-lock', '🔐': 'fa-user-lock', '🕵️': 'fa-user-secret', '🕶️': 'fa-user-secret',
  '📎': 'fa-paperclip', '🖼️': 'fa-image', '🖼': 'fa-image', '📄': 'fa-file-lines',
  '🤝': 'fa-handshake', '🌟': 'fa-star', '⭐': 'fa-star', '★': 'fa-star',
  '☆': 'fa-regular fa-star', '🚰': 'fa-faucet-drip', '🛣️': 'fa-road', '🛣': 'fa-road',
  '🧭': 'fa-compass', '🛡️': 'fa-shield-halved', '🛡': 'fa-shield-halved',
  '⚙️': 'fa-gears', '⚙': 'fa-gears', '🛠️': 'fa-screwdriver-wrench', '🛠': 'fa-screwdriver-wrench',
  '🆕': 'fa-seedling', '🌱': 'fa-seedling', '✈️': 'fa-plane', '🌍→': 'fa-globe',
  '🎓': 'fa-graduation-cap', '💼': 'fa-briefcase', '📞': 'fa-phone', '✉️': 'fa-envelope',
  '❌': 'fa-circle-xmark', '❎': 'fa-square-xmark', '💬': 'fa-comment-dots',
  '🗨️': 'fa-comments', '🔄': 'fa-rotate', '📊': 'fa-chart-column', '📊→': 'fa-chart-column',
  '💡': 'fa-lightbulb', '🏆': 'fa-trophy', '🥇': 'fa-medal', '🧾': 'fa-receipt',
  '🕘': 'fa-clock', '⌛': 'fa-hourglass-half', '🧹': 'fa-broom', '🚮': 'fa-trash-can',
  '🚮️': 'fa-trash-can', '🌏': 'fa-earth-asia', '🌎': 'fa-earth-americas',
  '😀': 'fa-face-smile', '🙂': 'fa-face-smile', '😡': 'fa-face-angry', '🔒️': 'fa-lock',
  '🔓️': 'fa-lock-open', '🖥️': 'fa-desktop', '🖨️': 'fa-print', '📱': 'fa-mobile-screen',
  '🌧️': 'fa-cloud-rain', '☀️': 'fa-sun', '💡→': 'fa-lightbulb',
  '🚧': 'fa-cone-striping', '🚑': 'fa-truck-medical', '🚒': 'fa-fire-flame-curved',
};

const STAT_CARD_RE = /icon="([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}])(\uFE0F)?"/gu;
const EMPTY_RE = /icon="([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}])(\uFE0F)?"/gu;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx') && !p.includes('icons.tsx')) out.push(p);
    else if (p.endsWith('.ts') && !p.includes('format')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let out = src;

  // 1. JSX icon="emoji" props (StatCard, EmptyState, etc.) → icon="fa-name"
  out = out.replace(/icon="([^"]*)"/gu, (m, inner) => {
    if (MAP[inner]) return `icon="${MAP[inner]}"`;
    return m;
  });

  // 2. Free-standing emoji inside JSX text or strings: emoji → FA <i> tag
  const emojiRe = /([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}])(\uFE0F)?/gu;
  out = out.replace(emojiRe, (m) => {
    const fa = MAP[m];
    if (!fa) return m; // leave unknown emojis untouched (will catch in review)
    return `{/* icon */}<i className="fa-solid ${fa}" aria-hidden="true" />{/* /icon */}`;
  });

  // 3. Clean the marker comments for readability
  out = out.replace(/\{\/\* icon \*\/\}/g, '').replace(/\{\/\* \/icon \*\/\}/g, '');

  // 4. Collapse duplicated FA tags created by adjacent replacements
  out = out.replace(/(<i className="fa-solid fa-[^"]*" aria-hidden="true" \/>)\s*<i className="fa-solid (fa-[^"]*)"[^>]*\/>/gu, '$1');

  if (out !== src) {
    writeFileSync(file, out, 'utf8');
    changed++;
    console.log('updated', file);
  }
}
console.log(`done — ${changed} file(s) updated`);
