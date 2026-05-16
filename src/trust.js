import { isDisposableEmail } from "./email_filter.js";

const trustState = new Map();
const ipTimestamps = new Map();
const asnTimestamps = new Map();
let platformThreat = 0;
let baselineRpm = 5;
const trafficSamples = [];
const suspicion = new Map();

export function checkRequest(keyMeta, req) {
  const ip = clientIp(req);
  const asn = req.headers["cf-asn"] || "unknown";

  const ipBurst = trackBurst(ipTimestamps, ip);
  const asnBurst = trackBurst(asnTimestamps, asn);

  if (ipBurst.short > 5) {
    return {
      allowed: false,
      reason: "ip_burst",
      message: "Too many requests from your IP — please slow down",
      retry_after_seconds: Math.ceil(ipBurst.shortWindow_ms / 1000),
    };
  }
  if (asnBurst.medium !== null && asnBurst.medium > 100) {
    return {
      allowed: false,
      reason: "asn_burst",
      message: "High traffic from your network — try again in a minute",
      retry_after_seconds: 60,
    };
  }

  const url = req.body?.url || "";
  const susp = scoreRequest({ keyMeta, ip, asn, url, ipBurst, asnBurst });
  bumpSuspicion(keyMeta.id, susp);

  const totalSusp = (suspicion.get(keyMeta.id)?.score || 0);
  const decision = decideFriction(keyMeta, totalSusp);
  return decision;
}

export function recordOutcome(keyMeta, req, outcome) {
  const trust = getTrust(keyMeta.id);
  if (outcome === "success") {
    trust.score += 1;
    const susp = suspicion.get(keyMeta.id);
    if (susp) susp.score = Math.max(0, susp.score - 0.5);
  }
  sampleTraffic();
}

export function getThreatStats() {
  return {
    platform_threat_level: platformThreat.toFixed(2),
    baseline_rpm: baselineRpm.toFixed(1),
    current_rpm: trafficSamples.at(-1) || 0,
    tracked_ips: ipTimestamps.size,
    tracked_asns: asnTimestamps.size,
  };
}

export function findEdgingUsers(keyStore) {
  const candidates = [];
  for (const [hash, meta] of keyStore.entries()) {
    if (meta.tier !== "free") continue;
    const susp = suspicion.get(meta.id);
    if (!susp || susp.score < 5) continue;
    candidates.push({ keyId: meta.id, score: susp.score, limitHits: Math.floor(susp.score / 2) });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function scoreRequest({ keyMeta, ip, asn, url, ipBurst, asnBurst }) {
  let s = 0;
  if (keyMeta.email && isDisposableEmail(keyMeta.email)) s += 2;

  const isCloudAsn = isCloudProvider(asn);
  if (isCloudAsn && keyMeta.tier === "free") s += 3;

  if (ipBurst.medium !== null && ipBurst.medium > 20) s += 2;
  if (ipBurst.long !== null && ipBurst.long > 50) s += 3;
  if (asnBurst.medium !== null && asnBurst.medium > 50) s += 2;

  if (
    ipBurst.medium !== null && ipBurst.medium > 30 &&
    ipBurst.long !== null && ipBurst.long > 80
  ) {
    s += 4;
  }

  const trust = getTrust(keyMeta.id);
  if (keyMeta.usageCount > 20) {
    const varietyRatio = trust.signals.uniqueUrls.size / keyMeta.usageCount;
    if (varietyRatio < 0.3) s += 3;
  }

  if (trust.signals.uniqueIps.size > 15) s += 5;
  trust.signals.uniqueIps.add(ip);

  if (url) {
    const fingerprint = simpleHash(url).slice(0, 12);
    trust.signals.uniqueUrls.add(fingerprint);
    if (trust.signals.uniqueUrls.size > 200) {
      const first = trust.signals.uniqueUrls.values().next().value;
      trust.signals.uniqueUrls.delete(first);
    }
  }

  return s;
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function decideFriction(keyMeta, suspicionScore) {
  if (keyMeta.tier !== "free") return { allowed: true, delay_ms: 0 };
  const effective = suspicionScore * (1 + platformThreat * 2);

  if (effective < 3) return { allowed: true, delay_ms: 0 };
  if (effective < 8) return cooldown(effective);
  if (effective < 15) return verification(keyMeta);
  return {
    allowed: false,
    reason: "high_suspicion",
    message: "Your account has been flagged for unusual activity. Contact support if this is an error.",
    retry_after_seconds: 3600,
  };
}

function cooldown(effective) {
  const minutes = Math.min(60, Math.round(5 + (effective - 3) * 11));
  const jitterMs = Math.floor(Math.random() * 30_000);
  return {
    allowed: true,
    delay_ms: minutes * 60_000 + jitterMs,
    reason: "adaptive_cooldown",
    message: `Please wait ~${minutes} minutes before your next conversion.`,
  };
}

function verification(keyMeta) {
  return {
    allowed: false,
    requires: "verification",
    message: "We've sent a verification link to your email — click it to continue.",
    email: keyMeta.email,
  };
}

function trackBurst(map, key) {
  const now = Date.now();
  const stamps = (map.get(key) || []).filter(t => now - t < 720_000);
  stamps.push(now);
  map.set(key, stamps);

  const shortW = randInRange(8_000, 13_000);
  const medW = randInRange(45_000, 80_000);
  const longW = randInRange(240_000, 420_000);
  const xlongW = randInRange(480_000, 720_000);

  const result = {
    shortWindow_ms: shortW,
    short: stamps.filter(t => now - t < shortW).length,
    medium: null,
    long: null,
    xlong: null,
  };

  const dice = Math.random();
  if (dice < 0.40) result.medium = stamps.filter(t => now - t < medW).length;
  if (dice < 0.15) result.long = stamps.filter(t => now - t < longW).length;
  if (dice < 0.05) result.xlong = stamps.filter(t => now - t < xlongW).length;

  return result;
}

function randInRange(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}

function sampleTraffic() {
  const minute = Math.floor(Date.now() / 60_000);
  const last = trafficSamples.at(-1);
  if (last?.minute === minute) {
    last.count++;
  } else {
    trafficSamples.push({ minute, count: 1 });
    if (trafficSamples.length > 60) trafficSamples.shift();
  }
}

setInterval(() => {
  if (trafficSamples.length < 5) return;
  const recent = trafficSamples.slice(-5).reduce((a, b) => a + b.count, 0) / 5;
  const ratio = recent / Math.max(1, baselineRpm);
  if (ratio > 3) platformThreat = Math.min(1, platformThreat + 0.2);
  else if (ratio > 1.5) platformThreat = Math.min(1, platformThreat + 0.05);
  else platformThreat = Math.max(0, platformThreat - 0.1);
  baselineRpm = baselineRpm * 0.95 + recent * 0.05;
}, 60_000);

function getTrust(keyId) {
  let t = trustState.get(keyId);
  if (!t) {
    t = {
      score: 0,
      signals: { uniqueIps: new Set(), uniqueUrls: new Set() },
      history: [],
    };
    trustState.set(keyId, t);
  }
  return t;
}

function bumpSuspicion(keyId, delta) {
  const s = suspicion.get(keyId) || { score: 0, lastSpike: 0 };
  s.score += delta;
  if (delta > 2) s.lastSpike = Date.now();
  suspicion.set(keyId, s);
}

function clientIp(req) {
  return req.headers["cf-connecting-ip"]
    || req.headers["x-forwarded-for"]?.split(",")[0]
    || req.socket?.remoteAddress
    || "unknown";
}

const CLOUD_ASNS = new Set([
  "16509", "14618", "15169", "8075", "14061", "63949", "24940", "20473", "16276",
]);

function isCloudProvider(asn) {
  return CLOUD_ASNS.has(String(asn).replace(/^AS/i, ""));
}

setInterval(() => {
  for (const s of suspicion.values()) {
    s.score = Math.max(0, s.score * 0.7);
  }
}, 60 * 60 * 1000);
