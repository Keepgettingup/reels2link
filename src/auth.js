import { randomBytes, createHash } from "crypto";
import { createApiKey, findKeyByEmail } from "./keys.js";

const pendingTokens = new Map();
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export async function requestMagicLink(email) {
  if (!isValidEmail(email)) throw new Error("Invalid email address");
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  pendingTokens.set(tokenHash, {
    email: email.toLowerCase(),
    expires: Date.now() + MAGIC_LINK_TTL_MS,
  });
  const link = `${process.env.BASE_URL}/auth/verify?token=${token}`;
  await sendEmail(email, "Your SPOOL sign-in link", buildEmailBody(link));
  return { sent: true, expires_in: "15m" };
}

export function verifyMagicLink(token) {
  const tokenHash = hashToken(token);
  const pending = pendingTokens.get(tokenHash);
  if (!pending) throw new Error("Invalid or already-used token");
  if (pending.expires < Date.now()) {
    pendingTokens.delete(tokenHash);
    throw new Error("Token expired — request a new link");
  }
  pendingTokens.delete(tokenHash);
  const existing = findKeyByEmail(pending.email);
  if (existing) {
    return {
      email: pending.email,
      message: "You already have a key. Use it from the original signup, or revoke and create a new one in your dashboard.",
      tier: existing.meta.tier,
    };
  }
  return createApiKey({
    email: pending.email,
    tier: "free",
    label: "Created via magic link",
  });
}

async function sendEmail(to, subject, html) {
  if (process.env.NODE_ENV !== "production") {
    console.log("\nMagic link email (dev mode):");
    console.log(`   To: ${to}`);
    console.log(`   ${html.match(/href="([^"]+)"/)?.[1]}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SPOOL <auth@spool.link>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Email failed: ${await res.text()}`);
}

function buildEmailBody(link) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="margin: 0 0 8px;">SPOOL</h2>
      <p>Click the link below to sign in. It expires in 15 minutes.</p>
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">Sign in</a>
      <p style="font-size: 12px; color: #888;">Didn't request this? Just ignore the email — no action needed.</p>
    </div>
  `;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

setInterval(() => {
  const now = Date.now();
  for (const [hash, t] of pendingTokens.entries()) {
    if (t.expires < now) pendingTokens.delete(hash);
  }
}, 60 * 60 * 1000);
