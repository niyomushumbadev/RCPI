/**
 * R-CPI icon system — Font Awesome (solid) across the entire app.
 *
 * Usage:
 *   <Icon name="clipboard-list" />       → <i className="fa-solid fa-clipboard-list" />
 *   <CategoryIcon name="Drainage" />     → maps a problem category to its icon
 *   faIcon(categoryName, dbIcon)         → FA classes for DB-sourced icons
 */
import type { CSSProperties } from 'react';

/** Render a Font Awesome solid icon by name. */
export function Icon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
  const cls = name.startsWith('fa-') ? name : `fa-solid fa-${name}`;
  return <i className={`${cls} ${className}`.trim()} style={style} aria-hidden="true" />;
}

/** Problem-category → FA icon (matches the seeded category catalogue). */
const CATEGORY_FA: Record<string, string> = {
  drainage: 'fa-water',
  roads: 'fa-road',
  road: 'fa-road',
  water: 'fa-droplet',
  'water & sanitation': 'fa-droplet',
  sanitation: 'fa-droplet',
  waste: 'fa-trash-can',
  'waste management': 'fa-trash-can',
  electricity: 'fa-bolt',
  'electricity & lighting': 'fa-bolt',
  lighting: 'fa-lightbulb',
  environment: 'fa-leaf',
  health: 'fa-heart-pulse',
  'public health': 'fa-heart-pulse',
  education: 'fa-graduation-cap',
  agriculture: 'fa-wheat-awn',
  safety: 'fa-shield-halved',
  'public safety': 'fa-shield-halved',
  transport: 'fa-bus',
  infrastructure: 'fa-helmet-safety',
  housing: 'fa-house-chimney',
  flooding: 'fa-house-flood-water',
  other: 'fa-circle-question',
};

/** Seeded DB emoji → FA icon, for any category the name map misses. */
const EMOJI_FA: Record<string, string> = {
  '💧': 'fa-droplet',
  '🛣️': 'fa-road',
  '🚧': 'fa-cone-striping',
  '🗑️': 'fa-trash-can',
  '⚡': 'fa-bolt',
  '🔌': 'fa-plug',
  '🌿': 'fa-leaf',
  '🌳': 'fa-tree',
  '🏥': 'fa-hospital',
  '💉': 'fa-syringe',
  '🏫': 'fa-school',
  '🎓': 'fa-graduation-cap',
  '🌾': 'fa-wheat-awn',
  '🛡️': 'fa-shield-halved',
  '🚨': 'fa-triangle-exclamation',
  '🚌': 'fa-bus',
  '🚰': 'fa-faucet-drip',
  '🏗️': 'fa-helmet-safety',
  '🏠': 'fa-house-chimney',
  '🌊': 'fa-water',
  '❓': 'fa-circle-question',
};

/** Resolve a DB-sourced icon (emoji or raw name) + category name → FA class list. */
export function faIcon(categoryName?: string | null, dbIcon?: string | null, fallback = 'fa-circle-question'): string {
  const key = (categoryName ?? '').trim().toLowerCase();
  if (key && CATEGORY_FA[key]) return `fa-solid ${CATEGORY_FA[key]}`;
  if (dbIcon) {
    const trimmed = dbIcon.trim();
    if (EMOJI_FA[trimmed]) return `fa-solid ${EMOJI_FA[trimmed]}`;
    if (trimmed.startsWith('fa-')) return trimmed.startsWith('fa-solid') ? trimmed : `fa-solid ${trimmed}`;
  }
  return `fa-solid ${fallback}`;
}

/** Category icon as a component — preferred usage in JSX. */
export function CategoryIcon({ name, dbIcon, className = '' }: { name?: string | null; dbIcon?: string | null; className?: string }) {
  return <Icon name={faIcon(name, dbIcon)} className={className} />;
}

/** Status → FA icon for badges and timelines. */
export function statusFa(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'fa-pencil',
    SUBMITTED: 'fa-paper-plane',
    RECEIVED: 'fa-inbox',
    AI_ANALYSIS: 'fa-wand-magic-sparkles',
    PENDING_VERIFICATION: 'fa-hourglass-half',
    UNDER_REVIEW: 'fa-magnifying-glass',
    VERIFIED: 'fa-circle-check',
    REJECTED: 'fa-ban',
    ASSIGNED: 'fa-user-plus',
    IN_PROGRESS: 'fa-screwdriver-wrench',
    WAITING_CITIZEN: 'fa-comment-dots',
    WAITING_DEPARTMENT: 'fa-building-flag',
    ESCALATED: 'fa-angles-up',
    RESOLVED: 'fa-circle-check',
    PENDING_CLOSURE: 'fa-stamp',
    CLOSED: 'fa-clipboard-check',
    REOPEN_REQUESTED: 'fa-rotate-left',
    REOPENED: 'fa-door-open',
    ARCHIVED: 'fa-box-archive',
  };
  return `fa-solid ${map[status] ?? 'fa-tag'}`;
}

/** Urgency → FA icon. */
export function urgencyFa(urgency: string): string {
  return urgency === 'HIGH' ? 'fa-solid fa-circle-exclamation' : urgency === 'MEDIUM' ? 'fa-solid fa-circle-half-stroke' : 'fa-solid fa-circle';
}
