import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomBytes } from "crypto";
import geoip from "geoip-lite";
import { convertReel } from "./converter.js";
import { getLink } from "./storage.js";
import { requireApiKey, createApiKey, revokeApiKey, listKeys } from "./keys.js";
import { requestMagicLink, verifyMagicLink } from "./auth.js";
import { createCheckoutSession, handleStripeWebhook, cancelSubscription } from "./billing.js";
import Stripe from "stripe";
import { applyX402, x402Discovery } from "./x402.js";
import { trackView, getLinkStats, getGlobalStats } from "./analytics.js";
import { checkRequest, recordOutcome, getThreatStats } from "./trust.js";
import { getQueueStats, clearQueue } from "./queue.js";
import {
  getGoogleAuthUrl,
  getGitHubAuthUrl,
  exchangeGoogleCode,
  exchangeGitHubCode,
  getGoogleUserInfo,
  getGitHubUserInfo,
  validateState,
  getFingerprintFromState,
} from "./oauth.js";
import { initDatabase, getUserByEmail, createUser, updateUserLogin, getUserByApiKey, getUserByFingerprint, addLinkedEmail, incrementUsage, recordLoginEvent, getRecentCountries, incrementSuspiciousScore, getAllUsers, getRecentLoginEvents, storeOtpToken, getOtpToken, deleteOtpToken, cleanupExpiredTokens, getUsageLimits, updateUserTier, saveConversion, getConversion, incrementConversionViews, getUserConversionStats, getUserConversions, getAllActiveConversions, updateSubscriptionEndsAt } from "./database.js";

async function generateOtpToken(apiKey) {
  const token = "otp_" + randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 5 * 60_000;
  await storeOtpToken(token, apiKey, expiresAt);
  return token;
}

function lookupGeo(ip) {
  const cleanIp = ip?.replace(/^::ffff:/, "") || "";
  const geo = geoip.lookup(cleanIp);
  return { country: geo?.country || null, city: geo?.city || null };
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', exposedHeaders: ['Cross-Origin-Resource-Policy'] }));
app.use(express.static("public"));

const oauthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.query.fp || ipKeyGenerator(req),
  message: { error: "Too many login attempts, try again in an hour" },
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests" },
  validate: { xForwardedForHeader: false },
});

app.use(globalLimiter);

// Initialize database and restore linkRegistry from DB
initDatabase().then(async () => {
  try {
    const active = await getAllActiveConversions();
    for (const conv of active) {
      const key = `reels/${conv.id}.mp4`;
      await saveLink(conv.id, { key, expires: conv.expires_at, sizeMb: conv.size_mb });
    }
    console.log(`[Registry] Restored ${active.length} active links from DB`);
  } catch (err) {
    console.error('[Registry] Restore failed:', err.message);
  }
}).catch(console.error);

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const result = await handleStripeWebhook(req.body, req.headers["stripe-signature"]);
      res.json(result);
    } catch (err) {
      console.error("Stripe webhook error:", err.message);
      res.status(400).json({ error: err.message });
    }
  },
);

app.use(express.json());
applyX402(app);

app.get("/", (req, res) => {
  res.json({
    service: "SPOOL",
    docs: `${process.env.BASE_URL}/docs`,
    auth: {
      humans: "POST /api/auth/request-link with { email }",
      agents: "GET /.well-known/x402 for pay-per-call pricing",
    },
  });
});

app.get("/.well-known/x402", x402Discovery);

app.post("/api/auth/request-link", async (req, res) => {
  try {
    const result = await requestMagicLink(req.body.email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/auth/verify", (req, res) => {
  try {
    const result = verifyMagicLink(req.query.token);
    res.json({
      success: true,
      apiKey: result.key,
      email: result.email,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// OAuth Routes
app.get("/auth/google", oauthLimiter, (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/auth/google/callback`;
  const authUrl = getGoogleAuthUrl(redirectUri, req.query.fp);
  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const stateData = validateState(state);
    if (!stateData) {
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    const redirectUri = `${process.env.BASE_URL}/auth/google/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const userInfo = await getGoogleUserInfo(tokens.access_token);
    console.log('[DEBUG] Google userInfo:', JSON.stringify(userInfo, null, 2));
    const ipAddress = req.ip;
    const fp = stateData.fp || null;

    // 1. Look up by email
    let user = await getUserByEmail(userInfo.email);
    console.log('[DEBUG] Step 1 - user lookup by email:', userInfo.email, 'result:', user);
    if (user) {
      console.log('[DEBUG] Step 1b - existing user, updating...');
      user = await updateUserLogin(userInfo.email, ipAddress, fp);
      console.log('[DEBUG] Step 1c - after update:', user);
    } else {
      // 2. Look up by fingerprint
      const fpUser = await getUserByFingerprint(fp);
      console.log('[DEBUG] Step 2 - fingerprint lookup:', fp, 'result:', fpUser);
      if (fpUser) {
        await addLinkedEmail(fpUser.id, userInfo.email);
        user = await updateUserLogin(fpUser.email, ipAddress, fp);
        console.log('[DEBUG] Step 2b - after linking:', user);
      } else {
        // 3. New user
        console.log('[DEBUG] Step 3 - userInfo.email:', userInfo.email, 'ip:', ipAddress, 'fp:', fp);
        const apiKey = createApiKey({ tier: "free", label: `Google OAuth: ${userInfo.email}`, email: userInfo.email });
        console.log('[DEBUG] Step 3a - apiKey:', apiKey?.key);
        try {
          user = await createUser(userInfo.email, apiKey.key, ipAddress, fp);
          console.log('[DEBUG] Step 3b - after createUser success:', user);
        } catch (err) {
          console.log('[DEBUG] Step 3c - createUser ERROR:', err.message);
          throw err;
        }
      }
    }
    const { country, city } = lookupGeo(ipAddress);
    console.log('[DEBUG] Step 4 - before final update, user:', user);
    user = await updateUserLogin(userInfo.email, ipAddress, fp, country);
    if (user?.id) {
      await recordLoginEvent(user.id, ipAddress, country, city);
      const recentCountries = await getRecentCountries(user.id, 60);
      if (recentCountries.length > 2) await incrementSuspiciousScore(user.id);
    }

    console.log('[DEBUG] user object:', user);
    console.log('[DEBUG] user keys:', Object.keys(user || {}));
    console.log('[DEBUG] user.api_key:', user?.api_key);
    if (!user?.api_key) {
      console.error('[DEBUG] ERROR: user.api_key is missing! User:', user);
      return res.status(500).json({ error: 'User api_key missing after creation' });
    }
    const token = await generateOtpToken(user.api_key);
    const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL;
    res.redirect(`${frontendUrl}/app?token=${token}`);
  } catch (err) {
    console.error('[DEBUG] Full error:', err);
    const errorMsg = err?.message || String(err);
    res.status(500).json({ error: `Google OAuth failed: ${errorMsg}` });
  }
});

app.get("/auth/github", oauthLimiter, (req, res) => {
  const redirectUri = `${process.env.BASE_URL}/auth/github/callback`;
  const authUrl = getGitHubAuthUrl(redirectUri, req.query.fp);
  res.redirect(authUrl);
});

app.get("/auth/github/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const stateData = validateState(state);
    if (!stateData) {
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    const redirectUri = `${process.env.BASE_URL}/auth/github/callback`;
    const tokens = await exchangeGitHubCode(code, redirectUri);
    const userInfo = await getGitHubUserInfo(tokens.access_token);
    const ipAddress = req.ip;
    const fp = stateData.fp || null;

    // 1. Look up by email
    let user = await getUserByEmail(userInfo.email);
    if (user) {
      user = await updateUserLogin(userInfo.email, ipAddress, fp);
    } else {
      // 2. Look up by fingerprint
      const fpUser = await getUserByFingerprint(fp);
      if (fpUser) {
        await addLinkedEmail(fpUser.id, userInfo.email);
        user = await updateUserLogin(fpUser.email, ipAddress, fp);
      } else {
        // 3. New user
        const apiKey = createApiKey({ tier: "free", label: `GitHub OAuth: ${userInfo.login}`, email: userInfo.email });
        user = await createUser(userInfo.email, apiKey.key, ipAddress, fp);
      }
    }
    const { country, city } = lookupGeo(ipAddress);
    user = await updateUserLogin(userInfo.email, ipAddress, fp, country);
    if (user?.id) {
      await recordLoginEvent(user.id, ipAddress, country, city);
      const recentCountries = await getRecentCountries(user.id, 60);
      if (recentCountries.length > 2) await incrementSuspiciousScore(user.id);
    }

    const token = await generateOtpToken(user.api_key);
    const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL;
    res.redirect(`${frontendUrl}/app?token=${token}`);
  } catch (err) {
    res.status(500).json({ error: `GitHub OAuth failed: ${err.message}` });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const users = await getAllUsers();
  const logins = await getRecentLoginEvents(100);
  const suspicious = users.filter(u => u.suspicious_score > 0);
  const countryBreakdown = users.reduce((acc, u) => {
    if (u.country) acc[u.country] = (acc[u.country] || 0) + 1;
    return acc;
  }, {});
  res.json({
    total_users: users.length,
    tiers: { free: users.filter(u => u.tier === 'free').length, pro: users.filter(u => u.tier === 'pro').length, ultra: users.filter(u => u.tier === 'ultra').length },
    suspicious_users: suspicious.length,
    country_breakdown: countryBreakdown,
    users,
    recent_logins: logins,
  });
});

app.get("/auth/redeem", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Missing token" });
  const entry = await getOtpToken(token);
  if (!entry) return res.status(401).json({ error: "Invalid token" });
  await deleteOtpToken(token);
  res.json({ apiKey: entry.api_key });
});

app.get("/api/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }
  const user = await getUserByApiKey(authHeader.slice(7));
  if (!user) return res.status(401).json({ error: "Invalid API key" });
  res.json({ email: user.email, tier: user.tier || 'free', subscription_ends_at: user.subscription_ends_at || null });
});

app.post("/api/billing/checkout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }
  const apiKey = authHeader.slice(7);
  const user = await getUserByApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  const { tier } = req.body;
  if (!user.email) {
    return res.status(400).json({ error: "Your key has no email — sign up via magic link first" });
  }
  try {
    const session = await createCheckoutSession({ email: user.email, tier });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/billing/cancel", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }
  const apiKey = authHeader.slice(7);
  const user = await getUserByApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  if (!user.email) {
    return res.status(400).json({ error: "Your key has no email" });
  }
  try {
    const result = await cancelSubscription(user.email);
    if (result.current_period_end) {
      const endsAt = new Date(result.current_period_end * 1000).toISOString();
      await updateSubscriptionEndsAt(user.email, endsAt);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/convert", async (req, res) => {
  const { url, ttl = "30d" } = req.body;
  if (!url || !isValidInstagramUrl(url)) {
    return res.status(400).json({ error: "Invalid Instagram URL" });
  }
  
  // Get API key from header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }
  
  const apiKey = authHeader.slice(7);
  
  // Look up user in database
  const user = await getUserByApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  
  // Check usage limits (daily + monthly)
  const usageLimits = await getUsageLimits(apiKey);
  if (!usageLimits.allowed) {
    return res.status(429).json({ 
      error: "Usage limit reached", 
      daily_usage: usageLimits.daily.daily_usage, 
      daily_limit: usageLimits.daily.limit,
      monthly_usage: usageLimits.monthly.monthly_usage,
      monthly_limit: usageLimits.monthly.limit,
      tier: user.tier,
      message: usageLimits.message
    });
  }
  
  // Increment usage
  await incrementUsage(apiKey);
  
  // Trust check (using user data instead of in-memory keyStore)
  const trustCheck = checkRequest({ tier: user.tier, usage_today: user.usage_count }, req);
  if (!trustCheck.allowed) {
    return res.status(429).json(trustCheck);
  }
  if (trustCheck.delay_ms > 0) {
    await new Promise(r => setTimeout(r, trustCheck.delay_ms));
  }
  
  try {
    const result = await convertReel(url, ttl);
    recordOutcome({ tier: user.tier, usage_today: user.usage_count }, req, "success");
    // Extract short ID from link (format: BASE_URL/v/SHORTID)
    const cdnId = result.link?.split('/v/').pop() || randomBytes(6).toString('hex');
    // Build public CDN video URL using pull zone if configured, else storage URL
    const bunnyBase = process.env.BUNNY_CDN_URL || process.env.BUNNY_STORAGE_ENDPOINT || 'http://localhost:3000';
    const publicVideoUrl = `${bunnyBase.replace(/\/$/, '')}/reels/${cdnId}.mp4`;
    await saveConversion(cdnId, user.id, url, publicVideoUrl, result.expires, result.size_mb);
    const viewerUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/v/${cdnId}`;
    res.json({ ...result, viewer_url: viewerUrl, conversion_id: cdnId, tier: user.tier, usage_today: user.usage_count });
  } catch (err) {
    recordOutcome({ tier: user.tier, usage_today: user.usage_count }, req, "error");
    res.status(500).json({ error: "Conversion failed", detail: err.message });
  }
});

app.get("/api/v/:id", async (req, res) => {
  const conv = await getConversion(req.params.id);
  if (!conv) return res.status(404).json({ error: "Not found" });
  await incrementConversionViews(req.params.id);
  res.json({ id: conv.id, instagram_url: conv.instagram_url, cdn_url: conv.cdn_url, expires_at: conv.expires_at, size_mb: conv.size_mb, views: conv.views + 1, created_at: conv.created_at });
});

app.get("/api/stats", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing API key" });
  const apiKey = authHeader.slice(7);
  const stats = await getUserConversionStats(apiKey);
  if (!stats) return res.status(401).json({ error: "Invalid API key" });
  res.json(stats);
});

app.get("/api/my-conversions", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Missing API key" });
  const apiKey = authHeader.slice(7);
  const user = await getUserByApiKey(apiKey);
  if (!user) return res.status(401).json({ error: "Invalid API key" });
  const conversions = await getUserConversions(apiKey);
  res.json(conversions || []);
});

app.get("/api/status/:id", async (req, res) => {
  const link = await getLink(req.params.id);
  if (!link) return res.status(404).json({ error: "Not found" });
  res.json({ id: req.params.id, expires: link.expires, size_mb: link.sizeMb });
});

app.delete("/api/keys", requireApiKey, (req, res) => {
  const raw = req.headers.authorization?.slice(7);
  revokeApiKey(raw);
  res.json({ message: "Key revoked" });
});

app.get("/v/:id", async (req, res) => {
  const link = await getLink(req.params.id);
  if (!link) return res.status(404).json({ error: "Link not found or expired" });
  trackView(req.params.id, req);
  
  // Fetch from Bunny with AccessKey header
  const bunnyResponse = await fetch(link.signedUrl, {
    headers: {
      "AccessKey": process.env.BUNNY_STORAGE_SECRET_KEY,
    },
  });
  
  if (!bunnyResponse.ok) {
    return res.status(502).json({ error: "Failed to fetch video from storage" });
  }
  
  // Get buffer and send
  const buffer = await bunnyResponse.arrayBuffer();
  res.setHeader("Content-Type", "video/mp4");
  res.send(Buffer.from(buffer));
});

app.get("/api/stats/:id", requireApiKey, async (req, res) => {
  const stats = await getLinkStats(req.params.id);
  if (!stats) return res.status(404).json({ error: "Link not found" });
  res.json(stats);
});

app.get("/admin/stats", requireAdmin, (req, res) => {
  res.json({ ...getGlobalStats(), threat: getThreatStats() });
});

// Debug endpoint to verify Stripe configuration
app.get("/api/debug/stripe", async (req, res) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const prices = await stripe.prices.list({ limit: 10 });
    const products = await stripe.products.list({ limit: 10 });
    res.json({
      secretKeyPrefix: process.env.STRIPE_SECRET_KEY?.slice(0, 10),
      priceIds: prices.data.map(p => ({ id: p.id, product: p.product })),
      products: products.data.map(p => ({ id: p.id, name: p.name })),
      expectedPro: process.env.STRIPE_PRICE_PRO,
      expectedUltra: process.env.STRIPE_PRICE_ULTRA,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/keys", requireAdmin, (req, res) => res.json(listKeys()));

app.get("/admin/queue", requireAdmin, (req, res) => res.json(getQueueStats()));
app.post("/admin/queue/clear", requireAdmin, (req, res) => {
  clearQueue();
  res.json({ message: "Queue cleared" });
});

app.post("/api/dev/set-tier", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint not available in production" });
  }
  const { email, tier } = req.body;
  if (!email || !tier) return res.status(400).json({ error: "email and tier required" });
  const user = await updateUserTier(email, tier);
  res.json({ ok: true, user });
});

app.post("/api/dev/create-key", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev endpoint not available in production" });
  }
  const key = createApiKey({ tier: "free", label: "Dev test key" });
  res.json(key);
});

function requireAdmin(req, res, next) {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function isValidInstagramUrl(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace(/^www\./, '');
    if (hostname !== "instagram.com") return false;
    // Accept /reel/, /reels/, /p/, /tv/ or anything containing "reel"
    return u.pathname.includes('/reel') || u.pathname.includes('/p/') || u.pathname.includes('/tv/');
  } catch {
    return false;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SPOOL running on :${PORT}`);
  console.log(`  humans:  POST /api/auth/request-link`);
  console.log(`  bots:    Authorization: Bearer spool_live_...`);
  console.log(`  agents:  GET /.well-known/x402`);
  // Cleanup expired tokens every 5 minutes
  setInterval(() => cleanupExpiredTokens().catch(() => {}), 5 * 60 * 1000);
});
