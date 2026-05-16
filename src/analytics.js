import { getLink } from "./storage.js";

const analytics = new Map();

export function trackView(linkId, req) {
  const country = req.headers["cf-ipcountry"] || "??";
  const client  = classifyClient(req.headers["user-agent"] || "");
  const hour    = currentHourBucket();

  const stats = analytics.get(linkId) || {
    views: 0,
    byCountry: {},
    byHour: {},
    byClient: { browser: 0, bot: 0, ai_agent: 0, unknown: 0 },
    firstView: null,
    lastView: null,
  };

  stats.views++;
  stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
  stats.byHour[hour]       = (stats.byHour[hour]       || 0) + 1;
  stats.byClient[client]++;
  stats.firstView ??= new Date().toISOString();
  stats.lastView   = new Date().toISOString();

  analytics.set(linkId, stats);
}

export async function getLinkStats(linkId) {
  const link = await getLink(linkId);
  if (!link) return null;
  const stats = analytics.get(linkId) || emptyStats();
  return {
    id: linkId,
    views: stats.views,
    expires: link.expires,
    size_mb: link.sizeMb,
    first_view: stats.firstView,
    last_view: stats.lastView,
    bandwidth_estimate_mb: stats.views * link.sizeMb,
    breakdown: {
      by_country: topN(stats.byCountry, 10),
      by_client: stats.byClient,
      by_hour: stats.byHour,
    },
  };
}

export function getGlobalStats() {
  let totalViews = 0;
  let totalLinks = 0;
  const countries = {};
  const clients = { browser: 0, bot: 0, ai_agent: 0, unknown: 0 };

  for (const stats of analytics.values()) {
    totalLinks++;
    totalViews += stats.views;
    for (const [c, n] of Object.entries(stats.byCountry)) {
      countries[c] = (countries[c] || 0) + n;
    }
    for (const [c, n] of Object.entries(stats.byClient)) {
      clients[c] += n;
    }
  }

  return {
    total_links: totalLinks,
    total_views: totalViews,
    avg_views_per_link: totalLinks ? (totalViews / totalLinks).toFixed(1) : 0,
    top_countries: topN(countries, 10),
    by_client: clients,
  };
}

export async function getBunnyStats(pullZoneId, dateFrom, dateTo) {
  const res = await fetch(
    `https://api.bunny.net/statistics?pullZone=${pullZoneId}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
    { headers: { AccessKey: process.env.BUNNY_API_KEY } },
  );
  if (!res.ok) throw new Error(`Bunny API: ${res.status}`);
  const data = await res.json();
  return {
    total_bandwidth_gb: (data.TotalBandwidthUsed / 1e9).toFixed(2),
    total_requests: data.TotalRequestsServed,
    cache_hit_rate: data.CacheHitRate,
    cost_estimate_usd: ((data.TotalBandwidthUsed / 1e9) * 0.005).toFixed(2),
    by_region: data.GeoTrafficDistribution || {},
  };
}

function classifyClient(ua) {
  const lower = ua.toLowerCase();
  if (lower.includes("x402") || lower.includes("agentkit")) return "ai_agent";
  if (lower.includes("bot") || lower.includes("crawler") || lower.includes("python") || lower.includes("curl")) return "bot";
  if (lower.includes("mozilla") && lower.includes("safari")) return "browser";
  return "unknown";
}

function currentHourBucket() {
  return new Date().toISOString().slice(0, 13);
}

function topN(obj, n) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ key: k, count: v }));
}

function emptyStats() {
  return {
    views: 0, byCountry: {}, byHour: {}, byClient: {},
    firstView: null, lastView: null,
  };
}
