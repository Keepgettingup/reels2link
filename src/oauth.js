import { randomBytes } from "crypto";
import { pool } from "./database.js";

const memoryStates = new Map();

async function dbQuery(sql, params = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); } finally { client.release(); }
}

export async function generateState(fp = null) {
  const state = randomBytes(16).toString("hex");
  try {
    await dbQuery("INSERT INTO oauth_states (state, fp, created_at) VALUES ($1, $2, $3)", [state, fp ?? null, Date.now()]);
  } catch {
    memoryStates.set(state, { fp: fp ?? null, createdAt: Date.now() });
  }
  return state;
}

export async function validateState(state) {
  try {
    const r = await dbQuery("SELECT * FROM oauth_states WHERE state = $1", [state]);
    const data = r.rows[0];
    if (!data) {
      const mem = memoryStates.get(state);
      if (!mem) return false;
      memoryStates.delete(state);
      if (Date.now() - mem.createdAt > 10 * 60 * 1000) return false;
      return { fp: mem.fp };
    }
    await dbQuery("DELETE FROM oauth_states WHERE state = $1", [state]).catch(() => {});
    if (Date.now() - Number(data.created_at) > 10 * 60 * 1000) return false;
    return { fp: data.fp };
  } catch {
    const mem = memoryStates.get(state);
    if (!mem) return false;
    memoryStates.delete(state);
    if (Date.now() - mem.createdAt > 10 * 60 * 1000) return false;
    return { fp: mem.fp };
  }
}

export async function getFingerprintFromState(state) {
  try {
    const r = await dbQuery("SELECT fp FROM oauth_states WHERE state = $1", [state]);
    return r.rows[0]?.fp || memoryStates.get(state)?.fp || null;
  } catch {
    return memoryStates.get(state)?.fp || null;
  }
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
