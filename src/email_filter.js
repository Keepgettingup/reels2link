const SOURCES = [
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf",
  "https://raw.githubusercontent.com/kickboxio/disposable-email-domain-list/master/domains.txt",
];

let blocklist = new Set();
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function isDisposableEmail(email) {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  return blocklist.has(domain);
}

export async function refreshBlocklist() {
  const merged = new Set();
  for (const url of SOURCES) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      for (const line of text.split("\n")) {
        const domain = line.trim().toLowerCase();
        if (domain && !domain.startsWith("#")) merged.add(domain);
      }
    } catch (err) {
      console.warn(`Failed to refresh from ${url}:`, err.message);
    }
  }
  if (merged.size > 100) {
    blocklist = merged;
    lastRefresh = Date.now();
    console.log(`Disposable email blocklist refreshed: ${blocklist.size} domains`);
  }
}

export function getBlocklistStats() {
  return {
    domains_blocked: blocklist.size,
    last_refresh: new Date(lastRefresh).toISOString(),
    next_refresh: new Date(lastRefresh + REFRESH_INTERVAL_MS).toISOString(),
  };
}

refreshBlocklist();
setInterval(refreshBlocklist, REFRESH_INTERVAL_MS);
