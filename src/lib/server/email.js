import "server-only";
import { createTransport } from "nodemailer";

/**
 * Outgoing email over SMTP, so any provider works: Gmail with an app password, Brevo, Resend, etc.
 * Configured by SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and optionally EMAIL_FROM.
 */

const env = (name) => process.env[name]?.trim() ?? "";

export const isEmailConfigured = () => Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD"));

let transport;

function getTransport() {
  if (!transport) {
    const port = Number(env("SMTP_PORT")) || 465;
    transport = createTransport({
      host: env("SMTP_HOST"),
      port,
      secure: port === 465, // 465 is TLS from the start; 587 upgrades with STARTTLS
      auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
    });
  }
  return transport;
}

export async function sendEmail({ to, subject, text, html }) {
  await getTransport().sendMail({ from: env("EMAIL_FROM") || env("SMTP_USER"), to, subject, text, html });
}

/** Sends a batch without failing the caller; each failure is logged. */
export async function sendEmails(emails) {
  if (!emails.length || !isEmailConfigured()) return;
  const results = await Promise.allSettled(emails.map(sendEmail));
  results.forEach((r, i) => r.status === "rejected" && console.error("[email] to", emails[i].to, r.reason));
}

/** The deployment's own address, taken from the sign-in callback URL (as sign-out does). */
export function appUrl(path = "/") {
  const redirectUri = env("NEXT_PUBLIC_WORKOS_REDIRECT_URI");
  return redirectUri ? new URL(path, redirectUri).href : null;
}
