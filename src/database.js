import Database from "better-sqlite3";
import "dotenv/config";

const dbPath = process.env.DB_PATH || "./spool.db";
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// Initialize database schema
export async function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
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
        suspicious_score INTEGER DEFAULT 0
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        ip TEXT,
        country TEXT,
        city TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS otp_tokens (
        token TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        instagram_url TEXT NOT NULL,
        cdn_url TEXT NOT NULL,
        expires_at TEXT,
        size_mb REAL,
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add columns if upgrading existing DB
    try { db.exec("ALTER TABLE users ADD COLUMN fingerprint TEXT"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN linked_emails TEXT DEFAULT '[]'"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN country TEXT"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN suspicious_score INTEGER DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN subscription_ends_at TEXT"); } catch {}
    console.log("[Database] Schema initialized");
  } catch (err) {
    console.error("[Database] Schema initialization failed:", err.message);
  }
}

function saveDatabase() {
  // No-op: better-sqlite3 writes to disk automatically
}

// User operations
export async function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email ?? null) ?? null;
}

export async function getUserByApiKey(apiKey) {
  return db.prepare("SELECT * FROM users WHERE api_key = ?").get(apiKey ?? null) ?? null;
}

export async function getUserByFingerprint(fingerprint) {
  if (!fingerprint) return null;
  return db.prepare("SELECT * FROM users WHERE fingerprint = ?").get(fingerprint ?? null) ?? null;
}

export async function addLinkedEmail(userId, email) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId ?? null);
  if (!user) return;
  const linked = JSON.parse(user.linked_emails || "[]");
  if (!linked.includes(email)) {
    linked.push(email);
    db.prepare("UPDATE users SET linked_emails = ? WHERE id = ?").run(JSON.stringify(linked), userId ?? null);
  }
}

export async function createUser(email, apiKey, ipAddress, fingerprint = null) {
  db.prepare(`
    INSERT INTO users (email, api_key, remember_ip, fingerprint, last_login) 
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(email ?? null, apiKey ?? null, ipAddress ?? null, fingerprint ?? null);
  return getUserByEmail(email);
}

export async function updateUserLogin(email, ipAddress, fingerprint = null, country = null) {
  db.prepare(`
    UPDATE users 
    SET last_login = datetime('now'), remember_ip = ?, fingerprint = COALESCE(?, fingerprint),
        country = COALESCE(?, country)
    WHERE email = ?
  `).run(ipAddress ?? null, fingerprint ?? null, country ?? null, email ?? null);
  return getUserByEmail(email);
}

export async function recordLoginEvent(userId, ip, country, city) {
  db.prepare(`
    INSERT INTO login_events (user_id, ip, country, city) VALUES (?, ?, ?, ?)
  `).run(userId ?? null, ip ?? null, country ?? null, city ?? null);
}

// Helper to fetch all rows — better-sqlite3 has .all() built in
function fetchAll(stmt, params = []) {
  return stmt.all(...params);
}

export async function getRecentCountries(userId, windowMinutes = 60) {
  const stmt = db.prepare(`
    SELECT DISTINCT country FROM login_events
    WHERE user_id = ? AND country IS NOT NULL
      AND timestamp >= datetime('now', '-' || ? || ' minutes')
  `);
  const rows = fetchAll(stmt, [userId ?? null, windowMinutes ?? 60]);
  return rows.map(r => r.country);
}


export async function incrementSuspiciousScore(userId) {
  db.prepare(`UPDATE users SET suspicious_score = suspicious_score + 1 WHERE id = ?`).run(userId ?? null);
}

export async function storeOtpToken(token, apiKey, expiresAt) {
  db.prepare("INSERT INTO otp_tokens (token, api_key, expires_at) VALUES (?, ?, ?)").run(token ?? null, apiKey ?? null, expiresAt ?? null);
}

export async function getOtpToken(token) {
  return db.prepare("SELECT * FROM otp_tokens WHERE token = ? AND expires_at > ?").get(token ?? null, Date.now()) ?? null;
}

export async function deleteOtpToken(token) {
  db.prepare("DELETE FROM otp_tokens WHERE token = ?").run(token ?? null);
}

export async function cleanupExpiredTokens() {
  db.prepare("DELETE FROM otp_tokens WHERE expires_at <= ?").run(Date.now());
}

export async function updateUserTier(email, tier) {
  db.prepare("UPDATE users SET tier = ? WHERE email = ?").run(tier ?? null, email ?? null);
  return getUserByEmail(email);
}

export async function getAllUsers() {
  return db.prepare("SELECT id, email, tier, usage_count, country, suspicious_score, last_login, created_at FROM users ORDER BY created_at DESC").all();
}

export async function getRecentLoginEvents(limit = 100) {
  return db.prepare("SELECT le.*, u.email FROM login_events le LEFT JOIN users u ON le.user_id = u.id ORDER BY le.timestamp DESC LIMIT ?").all(limit ?? 100);
}

// Limits configuration
const DAILY_LIMITS = { free: 10, pro: 200, ultra: 999999 };
const MONTHLY_LIMITS = { free: 100, pro: 5000, ultra: 50000 };

export async function incrementUsage(apiKey) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const user = db.prepare("SELECT usage_date, daily_usage, monthly_date, monthly_usage FROM users WHERE api_key = ?").get(apiKey ?? null);
  
  let dailyReset = false;
  let monthlyReset = false;
  
  if (user) {
    if (user.usage_date !== today) dailyReset = true;
    if (user.monthly_date !== thisMonth) monthlyReset = true;
  }
  
  if (dailyReset && monthlyReset) {
    db.prepare("UPDATE users SET usage_date = ?, daily_usage = 1, monthly_date = ?, monthly_usage = 1, usage_count = usage_count + 1 WHERE api_key = ?").run(today, thisMonth, apiKey ?? null);
  } else if (dailyReset) {
    db.prepare("UPDATE users SET usage_date = ?, daily_usage = 1, monthly_usage = monthly_usage + 1, usage_count = usage_count + 1 WHERE api_key = ?").run(today, apiKey ?? null);
  } else if (monthlyReset) {
    db.prepare("UPDATE users SET monthly_date = ?, monthly_usage = 1, daily_usage = daily_usage + 1, usage_count = usage_count + 1 WHERE api_key = ?").run(thisMonth, apiKey ?? null);
  } else {
    db.prepare("UPDATE users SET usage_count = usage_count + 1, daily_usage = daily_usage + 1, monthly_usage = monthly_usage + 1 WHERE api_key = ?").run(apiKey ?? null);
  }
}

export async function getDailyUsage(apiKey) {
  const today = new Date().toISOString().split('T')[0];
  const user = db.prepare("SELECT daily_usage, usage_date, tier FROM users WHERE api_key = ?").get(apiKey ?? null);
  
  if (!user) return { allowed: false, daily_usage: 0, limit: 0 };
  
  const limit = DAILY_LIMITS[user.tier] || DAILY_LIMITS.free;
  const daily_usage = user.usage_date === today ? (user.daily_usage || 0) : 0;
  
  return { 
    allowed: daily_usage < limit, 
    daily_usage, 
    limit 
  };
}

export async function getMonthlyUsage(apiKey) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const user = db.prepare("SELECT monthly_usage, monthly_date, tier FROM users WHERE api_key = ?").get(apiKey ?? null);
  
  if (!user) return { allowed: false, monthly_usage: 0, limit: 0 };
  
  const limit = MONTHLY_LIMITS[user.tier] || MONTHLY_LIMITS.free;
  const monthly_usage = user.monthly_date === thisMonth ? (user.monthly_usage || 0) : 0;
  
  return { 
    allowed: monthly_usage < limit, 
    monthly_usage, 
    limit 
  };
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
  db.prepare(`
    INSERT OR IGNORE INTO conversions (id, user_id, instagram_url, cdn_url, expires_at, size_mb)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id ?? null, userId ?? null, instagramUrl ?? null, cdnUrl ?? null, expiresAt ?? null, sizeMb ?? null);
}

export async function getConversion(id) {
  return db.prepare('SELECT * FROM conversions WHERE id = ?').get(id ?? null) ?? null;
}

export async function incrementConversionViews(id) {
  db.prepare('UPDATE conversions SET views = views + 1 WHERE id = ?').run(id ?? null);
}

export async function getUserConversionStats(apiKey) {
  const user = await getUserByApiKey(apiKey);
  if (!user) return null;
  const r = db.prepare('SELECT COUNT(*) as total, SUM(views) as total_views FROM conversions WHERE user_id = ?').get(user.id ?? null);
  return { total: r?.total || 0, total_views: r?.total_views || 0, daily: user.daily_usage || 0, monthly: user.monthly_usage || 0 };
}

export async function updateSubscriptionEndsAt(email, endsAt) {
  db.prepare('UPDATE users SET subscription_ends_at = ? WHERE email = ?').run(endsAt ?? null, email ?? null);
}

export async function getAllActiveConversions() {
  return db.prepare("SELECT id, cdn_url, expires_at, size_mb FROM conversions WHERE expires_at IS NULL OR expires_at > datetime('now')").all();
}

export async function getUserConversions(apiKey, limit = 50) {
  const user = await getUserByApiKey(apiKey);
  if (!user) return null;
  return db.prepare('SELECT id, instagram_url, views, size_mb, expires_at, created_at FROM conversions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(user.id ?? null, limit ?? 50);
}

export async function closePool() {
  if (db) db.close();
}
