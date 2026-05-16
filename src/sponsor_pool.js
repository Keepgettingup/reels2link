import { findEdgingUsers } from "./trust.js";

const pool = {
  balance_usd: 0,
  contributions: [],
  grants: [],
};

const COST_PER_CONVERSION = 0.0005;
const GRANT_SIZE_DEFAULT_USD = 0.10;

export function recordContribution({ donorEmail, amountUsd }) {
  pool.balance_usd += amountUsd;
  pool.contributions.push({
    donorEmail,
    amount: amountUsd,
    date: new Date().toISOString(),
  });
  console.log(`+$${amountUsd} to suspended pool (balance: $${pool.balance_usd.toFixed(2)})`);
}

export function distributeGrants(keyStore, applyGrant) {
  if (pool.balance_usd < GRANT_SIZE_DEFAULT_USD) {
    return { granted: 0, reason: "Pool empty" };
  }
  const candidates = findEdgingUsers(keyStore);
  const grants = [];
  for (const candidate of candidates) {
    if (pool.balance_usd < GRANT_SIZE_DEFAULT_USD) break;
    const recentGrant = pool.grants.find(g =>
      g.recipientKeyId === candidate.keyId &&
      Date.now() - new Date(g.date).getTime() < 30 * 86_400_000,
    );
    if (recentGrant) continue;
    pool.balance_usd -= GRANT_SIZE_DEFAULT_USD;
    const grant = {
      recipientKeyId: candidate.keyId,
      amount: GRANT_SIZE_DEFAULT_USD,
      bonus_conversions: Math.floor(GRANT_SIZE_DEFAULT_USD / COST_PER_CONVERSION),
      date: new Date().toISOString(),
      reason: `${candidate.limitHits} limit-hits, score ${candidate.score}`,
    };
    pool.grants.push(grant);
    grants.push(grant);
    applyGrant(candidate.keyId, grant.bonus_conversions);
  }
  return { granted: grants.length, remaining_balance: pool.balance_usd, grants };
}

export function getPoolStats() {
  return {
    balance_usd: pool.balance_usd.toFixed(2),
    total_contributed: pool.contributions
      .reduce((sum, c) => sum + c.amount, 0).toFixed(2),
    total_granted: pool.grants
      .reduce((sum, g) => sum + g.amount, 0).toFixed(2),
    contributors_count: new Set(pool.contributions.map(c => c.donorEmail)).size,
    grants_count: pool.grants.length,
    bonus_conversions_funded: pool.grants
      .reduce((sum, g) => sum + g.bonus_conversions, 0),
  };
}
