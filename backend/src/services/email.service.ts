// ─────────────────────────────────────────────────────────────
// R-CPI email service — transactional email via Resend.
// Behaviour:
//   • RESEND_API_KEY set  → sends through the Resend HTTP API.
//   • Key absent (dev)    → logs the email to the console instead so
//                           local flows never block on missing config.
// Sends are best-effort: a failure is logged, never thrown into the
// caller's request flow (same policy as notify()).
// ─────────────────────────────────────────────────────────────
import { env } from '../config/env';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Sender identity; must be a verified domain in Resend. */
  from?: string;
}

function defaultFrom(): string {
  return process.env.RESEND_FROM ?? 'R-CPI <onboarding@resend.dev>';
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  if (!emailConfigured()) {
    if (env.isDev) {
      console.log(
        `[email:dev] RESEND_API_KEY not set — email logged instead.\n` +
          `  to: ${input.to}\n  subject: ${input.subject}\n` +
          `  body: ${input.text ?? input.html.slice(0, 300)}`
      );
    }
    return false;
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from ?? defaultFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
    if (!res.ok) {
      console.error('[email] Resend API error:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}

/** Simple HTML wrapper so all system emails share one layout. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#002B45;padding:20px 24px;color:#fff">
      <strong style="letter-spacing:.12em;font-size:13px;color:#F5C518">RWANDA COMMUNITY PROBLEM INTELLIGENCE</strong>
      <h1 style="margin:6px 0 0;font-size:20px">${title}</h1>
    </div>
    <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">${bodyHtml}</div>
    <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px">
      R-CPI · Rwanda Community Problem Intelligence · This is an automated system message.
    </div>
  </div></body></html>`;
}

/**
 * Send the sign-in credentials to a newly created staff user (or citizen).
 * Called by the admin createUser endpoint. The temporary password is
 * included exactly once; the user must change it at first login.
 */
export async function sendCredentialsEmail(input: {
  to: string;
  firstName: string;
  lastName: string;
  role: string;
  temporaryPassword: string;
  loginUrl?: string;
}): Promise<boolean> {
  const loginUrl = input.loginUrl ?? `${env.frontendUrl}/login`;
  const title = 'Your R-CPI account is ready';
  const body = `
    <p>Bright itegeko, <strong>${input.firstName} ${input.lastName}</strong>,</p>
    <p>An account has been created for you on the Rwanda Community Problem Intelligence platform.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin:16px 0">
      <p style="margin:0 0 6px"><strong>Role:</strong> ${input.role.replace(/_/g, ' ')}</p>
      <p style="margin:0 0 6px"><strong>Email:</strong> ${input.to}</p>
      <p style="margin:0"><strong>Temporary password:</strong> <code style="background:#fee2e2;padding:2px 6px;border-radius:4px">${input.temporaryPassword}</code></p>
    </div>
    <p>
      <a href="${loginUrl}" style="display:inline-block;background:#00A1DE;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Sign in to your dashboard</a>
    </p>
    <p style="color:#b91c1c"><strong>You will be required to set your own password on first sign-in.</strong> Keep this email private and delete it after your first login.</p>`;
  return sendEmail({
    to: input.to,
    subject: 'Your R-CPI account credentials',
    html: emailShell(title, body),
    text: `Your R-CPI account is ready. Email: ${input.to} — Temporary password: ${input.temporaryPassword} — Sign in at ${loginUrl} (you must change the password at first login).`,
  });
}
