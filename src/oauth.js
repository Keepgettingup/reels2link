import { randomBytes } from "crypto";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function dbQuery(sql, params = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); } finally { client.release(); }
}

export async function generateState(fp = null) {
  const state = randomBytes(16).toString("hex");
  await dbQuery("INSERT INTO oauth_states (state, fp, created_at) VALUES ($1, $2, $3)", [state, fp ?? null, Date.now()]);
  return state;
}

export async function validateState(state) {
  const r = await dbQuery("SELECT * FROM oauth_states WHERE state = $1", [state]);
  const data = r.rows[0];
  if (!data) return false;
  await dbQuery("DELETE FROM oauth_states WHERE state = $1", [state]);
  if (Date.now() - Number(data.created_at) > 10 * 60 * 1000) return false;
  return { fp: data.fp };
}

export async function getFingerprintFromState(state) {
  const r = await dbQuery("SELECT fp FROM oauth_states WHERE state = $1", [state]);
  return r.rows[0]?.fp || null;
}

export async function getGoogleAuthUrl(redirectUri, fp = null) {
  const state = await generateState(fp);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state: state,
    access_type: "offline",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function getGitHubAuthUrl(redirectUri, fp = null) {
  const state = await generateState(fp);
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "user:email",
    state: state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGoogleCode(code, redirectUri) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  return await response.json();
}

export async function exchangeGitHubCode(code, redirectUri) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub token exchange failed: ${error}`);
  }

  return await response.json();
}

export async function getGoogleUserInfo(accessToken) {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  return await response.json();
}

export async function getGitHubUserInfo(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub user info");
  }

  return await response.json();
}
