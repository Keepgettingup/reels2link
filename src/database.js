import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('[Database] FATAL: DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.on('error', (err) => console.error('[Database] Pool error:', err.message));

export { pool };

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res;
  } finally {
    client.release();
  }
}

// Initialize database schema
export async function initDatabase() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ,
        remember_ip TEXT,
        fingerprint TEXT,
        linked_emails TEXT DEFAULT '[]',
        tier TEXT DEFAULT 'free',
        usage_count INTEGER DEFAULT 0,
        usage_date TEXT,
        daily_usage INTEGER DEFAULT 0,
        monthly_usage INTEGER DEFAULT 0,
        monthly_date TEXT,
        country TEXT,
        suspicious_score INTEGER DEFAULT 0,
        subscription_ends_at TIMESTAMPTZ
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS login_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        ip TEXT,
        country TEXT,
        city TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS otp_tokens (
        token TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS conversions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        instagram_url TEXT NOT NULL,
        cdn_url TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        size_mb REAL,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("[Database] Schema initialized");
  } catch (err) {
    console.error("[Database] Schema initialization failed:", err.message);
  }
}

// User operations
export async function getUserByEmail(email) {
  const r = await query("SELECT * FROM users WHERE email = $1", [email ?? null]);
  return r.rows[0] ?? null;
}

export async function getUserByApiKey(apiKey) {
  const r = await query("SELECT * FROM users WHERE api_key = $1", [apiKey ?? null]);
  return r.rows[0] ?? null;
}

export async function getUserByFingerprint(fingerprint) {
  if (!fingerprint) return null;
  const r = await query("SELECT * FROM users WHERE fingerprint = $1", [fingerprint]);
  return r.rows[0] ?? null;
}

export async function addLinkedEmail(userId, email) {
  const r = await query("SELECT linked_emails FROM users WHERE id = $1", [userId]);
  const user = r.rows[0];
  if (!user) return;
  const linked = JSON.parse(user.linked_emails || "[]");
  if (!linked.includes(email)) {
    linked.push(email);
    await query("UPDATE users SET linked_emails = $1 WHERE id = $2", [JSON.stringify(linked), userId]);
  }
}

export async function createUser(email, apiKey, ipAddress, fingerprint = null) {
  await query(
    `INSERT INTO users (email, api_key, remember_ip, fingerprint, last_login) VALUES ($1, $2, $3, $4, NOW())`,
    [email ?? null, apiKey ?? null, ipAddress ?? null, fingerprint ?? null]
  );
  return getUserByEmail(email);
}

export async function updateUserLogin(email, ipAddress, fingerprint = null, country = null) {
  await query(
    `UPDATE users SET last_login = NOW(), remember_ip = $1, fingerprint = COALESCE($2, fingerprint), country = COALESCE($3, country) WHERE email = $4`,
    [ipAddress ?? null, fingerprint ?? null, country ?? null, email ?? null]
  );
  return getUserByEmail(email);
}

export async function recordLoginEvent(userId, ip, country, city) {
  await query(
    `INSERT INTO login_events (user_id, ip, country, city) VALUES ($1, $2, $3, $4)`,
    [userId ?? null, ip ?? null, country ?? null, city ?? null]
  );
}

export async function getRecentCountries(userId, windowMinutes = 60) {
  const r = await query(
    `SELECT DISTINCT country FROM login_events WHERE user_id = $1 AND country IS NOT NULL AND timestamp >= NOW() - ($2 || ' minutes')::INTERVAL`,
    [userId, windowMinutes ?? 60]
  );
  return r.rows.map(row => row.country);
}

export async function incrementSuspiciousScore(userId) {
  await query(`UPDATE users SET suspicious_score = suspicious_score + 1 WHERE id = $1`, [userId]);
}

export async function storeOtpToken(token, apiKey, expiresAt) {
  await query("INSERT INTO otp_tokens (token, api_key, expires_at) VALUES ($1, $2, $3)", [token, apiKey, expiresAt]);
}

export async function getOtpToken(token) {
  const r = await query("SELECT * FROM otp_tokens WHERE token = $1 AND expires_at > $2", [token, Date.now()]);
  return r.rows[0] ?? null;
}

export async function deleteOtpToken(token) {
  await query("DELETE FROM otp_tokens WHERE token = $1", [token]);
}

export async function cleanupExpiredTokens() {
  await query("DELETE FROM otp_tokens WHERE expires_at <= $1", [Date.now()]);
}

export async function updateUserTier(email, tier) {
  await query("UPDATE users SET tier = $1 WHERE email = $2", [tier ?? null, email ?? null]);
  return getUserByEmail(email);
}

export async function getAllUsers() {
  const r = await query("SELECT id, email, tier, usage_count, country, suspicious_score, last_login, created_at FROM users ORDER BY created_at DESC");
  return r.rows;
}

export async function getRecentLoginEvents(limit = 100) {
  const r = await query("SELECT le.*, u.email FROM login_events le LEFT JOIN users u ON le.user_id = u.id ORDER BY le.timestamp DESC LIMIT $1", [limit ?? 100]);
  return r.rows;
}

// Limits configuration
const DAILY_LIMITS = { free: 10, pro: 200, ultra: 999999 };
const MONTHLY_LIMITS = { free: 100, pro: 5000, ultra: 50000 };

export async function incrementUsage(apiKey) {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const r = await query("SELECT usage_date, daily_usage, monthly_date, monthly_usage FROM users WHERE api_key = $1", [apiKey]);
  const user = r.rows[0];
  if (!user) return;
  const dailyReset = user.usage_date !== today;
  const monthlyReset = user.monthly_date !== thisMonth;
  if (dailyReset && monthlyReset) {
    await query("UPDATE users SET usage_date = $1, daily_usage = 1, monthly_date = $2, monthly_usage = 1, usage_count = usage_count + 1 WHERE api_key = $3", [today, thisMonth, apiKey]);
  } else if (dailyReset) {
    await query("UPDATE users SET usage_date = $1, daily_usage = 1, monthly_usage = monthly_usage + 1, usage_count = usage_count + 1 WHERE api_key = $2", [today, apiKey]);
  } else if (monthlyReset) {
    await query("UPDATE users SET monthly_date = $1, monthly_usage = 1, daily_usage = daily_usage + 1, usage_count = usage_count + 1 WHERE api_key = $2", [thisMonth, apiKey]);
  } else {
    await query("UPDATE users SET usage_count = usage_count + 1, daily_usage = daily_usage + 1, monthly_usage = monthly_usage + 1 WHERE api_key = $1", [apiKey]);
  }
}

export async function getDailyUsage(apiKey) {
  const today = new Date().toISOString().split('T')[0];
  const r = await query("SELECT daily_usage, usage_date, tier FROM users WHERE api_key = $1", [apiKey]);
  const user = r.rows[0];
  if (!user) return { allowed: false, daily_usage: 0, limit: 0 };
  const limit = DAILY_LIMITS[user.tier] || DAILY_LIMITS.free;
  const daily_usage = user.usage_date === today ? (user.daily_usage || 0) : 0;
  return { allowed: daily_usage < limit, daily_usage, limit };
}

export async function getMonthlyUsage(apiKey) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const r = await query("SELECT monthly_usage, monthly_date, tier FROM users WHERE api_key = $1", [apiKey]);
  const user = r.rows[0];
  if (!user) return { allowed: false, monthly_usage: 0, limit: 0 };
  const limit = MONTHLY_LIMITS[user.tier] || MONTHLY_LIMITS.free;
  const monthly_usage = user.monthly_date === thisMonth ? (user.monthly_usage || 0) : 0;
  return { allowed: monthly_usage < limit, monthly_usage, limit };
}

export async function getUsageLimits(apiKey) {
  const daily = await getDailyUsage(apiKey);
  const monthly = await getMonthlyUsage(apiKey);
  
  return {
    allowed: daily.allowed && monthly.allowed,
    daily,
    monthly,
    message: !daily.allowed 
      ? `Daily limit reached: ${daily.daily_usage}/${daily.limit}` 
      : !monthly.allowed 
        ? `Monthly limit reached: ${monthly.monthly_usage}/${monthly.limit}` 
        : null
  };
}

export async function saveConversion(id, userId, instagramUrl, cdnUrl, expiresAt, sizeMb) {
  await query(
    `INSERT INTO conversions (id, user_id, instagram_url, cdn_url, expires_at, size_mb) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
    [id ?? null, userId ?? null, instagramUrl ?? null, cdnUrl ?? null, expiresAt ?? null, sizeMb ?? null]
  );
}

export async function getConversion(id) {
  const r = await query('SELECT * FROM conversions WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function incrementConversionViews(id) {
  await query('UPDATE conversions SET views = views + 1 WHERE id = $1', [id]);
}

export async function getUserConversionStats(apiKey) {
  const user = await getUserByApiKey(apiKey);
  if (!user) return null;
  const r = await query('SELECT COUNT(*) as total, SUM(views) as total_views FROM conversions WHERE user_id = $1', [user.id]);
  const row = r.rows[0];
  return { total: parseInt(row?.total) || 0, total_views: parseInt(row?.total_views) || 0, daily: user.daily_usage || 0, monthly: user.monthly_usage || 0 };
}

export async function updateSubscriptionEndsAt(email, endsAt) {
  await query('UPDATE users SET subscription_ends_at = $1 WHERE email = $2', [endsAt ?? null, email ?? null]);
}

export async function getAllActiveConversions() {
  const r = await query("SELECT id, cdn_url, expires_at, size_mb FROM conversions WHERE expires_at IS NULL OR expires_at > NOW()");
  return r.rows;
}

export async function getUserConversions(apiKey, limit = 50) {
  const user = await getUserByApiKey(apiKey);
  if (!user) return null;
  const r = await query('SELECT id, instagram_url, views, size_mb, expires_at, created_at FROM conversions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [user.id, limit ?? 50]);
  return r.rows;
}

export async function closePool() {
  await pool.end();
}
