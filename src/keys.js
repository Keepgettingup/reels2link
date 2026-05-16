import { randomBytes, createHash } from "crypto";

const keyStore = new Map();
const emailIndex = new Map();
const requestWindows = new Map();
const dailyCounts = new Map();

const TIER_LIMITS = {
  free:  { rpm: 10,   daily: 100,   label: "Free"  },
  pro:   { rpm: 120,  daily: 5000,  label: "Pro"   },
  ultra: { rpm: 600,  daily: 50000, label: "Ultra" },
};

export function createApiKey({ tier = "free", label = "", email = null } = {}) {
  const rawKey = `spool_live_${randomBytes(16).toString("hex")}`;
  const hashed = hashKey(rawKey);
  const meta = {
    id: randomBytes(8).toString("hex"),
    tier, label, email,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    lastUsed: null,
  };
  keyStore.set(hashed, meta);
  if (email) emailIndex.set(email.toLowerCase(), hashed);
  return { key: rawKey, ...meta };
}

export function findKeyByEmail(email) {
  const hashed = emailIndex.get(email.toLowerCase());
  if (!hashed) return null;
  return { hashed, meta: keyStore.get(hashed) };
}

export function upgradeKeyTier(email, newTier) {
  const found = findKeyByEmail(email);
  if (!found) return null;
  found.meta.tier = newTier;
  keyStore.set(found.hashed, found.meta);
  return found.meta;
}

export function revokeApiKey(rawKey) {
  return keyStore.delete(hashKey(rawKey));
}

export function listKeys() {
  return [...keyStore.entries()].map(([hash, meta]) => ({
    hash: hash.slice(0, 8) + "...",
    ...meta,
  }));
}

export function requireApiKey(req, res, next) {
  const rawKey = extractKey(req);
  if (!rawKey) {
    return res.status(401).json({
      error: "Missing API key",
      hint: "Pass your key as Bearer token: Authorization: Bearer spool_live_...",
    });
  }
  const hashed = hashKey(rawKey);
  const meta = keyStore.get(hashed);
  if (!meta) return res.status(401).json({ error: "Invalid API key" });

  const limits = TIER_LIMITS[meta.tier];
  const now = Date.now();
  const window = (requestWindows.get(hashed) || []).filter(t => now - t < 60_000);
  if (window.length >= limits.rpm) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      limit: limits.rpm,
      window: "1 minute",
      tier: meta.tier,
      retry_after: Math.ceil((window[0] + 60_000 - now) / 1000) + "s",
    });
  }
  window.push(now);
  requestWindows.set(hashed, window);

  const dayKey = `${hashed}_${today()}`;
  const dayCount = (dailyCounts.get(dayKey) || 0) + 1;
  if (dayCount > limits.daily) {
    return res.status(429).json({
      error: "Daily limit reached",
      limit: limits.daily,
      tier: meta.tier,
      reset: "midnight UTC",
    });
  }
  dailyCounts.set(dayKey, dayCount);

  meta.usageCount++;
  meta.lastUsed = new Date().toISOString();
  keyStore.set(hashed, meta);

  req.apiKey = { ...meta, usage_today: dayCount, limits };
  res.set({
    "X-RateLimit-Limit": limits.rpm,
    "X-RateLimit-Remaining": limits.rpm - window.length,
    "X-RateLimit-Daily": limits.daily - dayCount,
    "X-Spool-Tier": meta.tier,
  });
  next();
}

function extractKey(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  if (req.query.api_key) return req.query.api_key;
  return null;
}

function hashKey(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

setInterval(() => {
  const t = today();
  for (const k of dailyCounts.keys()) {
    if (!k.endsWith(t)) dailyCounts.delete(k);
  }
}, 60 * 60 * 1000);
