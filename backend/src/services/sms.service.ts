// ─────────────────────────────────────────────────────────────
// R-CPI SMS service — transactional SMS via the Twilio REST API.
// Uses plain fetch + Basic auth (no SDK dependency).
//
// Behaviour:
//   • TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER set
//       → sends through Twilio (Rwanda coverage: +2507XXXXXXXX).
//   • Keys absent (dev) → logs the SMS to the console instead so local
//     flows never block on missing config.
// Sends are best-effort: a failure is logged, never thrown into the
// caller's request flow (same policy as the email service).
// ─────────────────────────────────────────────────────────────
import { env } from '../config/env';

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

/** E.164 sanity check — accepts +250788123456 / 0788123456 / +250788… variants. */
export function normalizeRwandanPhone(input: string): string | null {
  const digits = String(input ?? '').replace(/[^\d+]/g, '');
  if (/^\+2507\d{8}$/.test(digits)) return digits;
  if (/^2507\d{8}$/.test(digits)) return `+${digits}`;
  if (/^07\d{8}$/.test(digits)) return `+250${digits.slice(1)}`;
  return null;
}

export async function sendSMS(input: { to: string; message: string }): Promise<boolean> {
  if (!smsConfigured()) {
    if (env.isDev) {
      console.log(
        `[sms:dev] TWILIO_* not set — SMS logged instead.\n` +
          `  to: ${input.to}\n  message: ${input.message}`
      );
    }
    return false;
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: input.to,
        From: process.env.TWILIO_FROM_NUMBER!,
        Body: input.message.slice(0, 1600),
      }),
    });
    if (!res.ok) {
      console.error('[sms] Twilio API error:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[sms] send failed:', err);
    return false;
  }
}

/**
 * Send the password reset link by SMS. Deliberately minimal: the message
 * never says whether the account exists (anti-enumeration) and the link is
 * the same single-use, 60-minute token used by the email channel.
 */
export async function sendPasswordResetSMS(input: { to: string; resetToken: string }): Promise<boolean> {
  const link = `${env.frontendUrl}/reset-password?token=${input.resetToken}`;
  return sendSMS({
    to: input.to,
    message: `R-CPI: Reset your password within 60 minutes: ${link} If this was not you, ignore this message.`,
  });
}
