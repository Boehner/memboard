// api/freshness.js

import { fetchWalletActivityTimestamp } from "./walletLastTx";
import { fetchMemoryApiClaims } from "./memory";
import { getMemoryProfile } from "./memory";
import { fetchEnsMetadata } from "./ens";

// Weights to decide what matters most for "freshness"
const SOURCE_WEIGHTS = {
  walletTx: 1.0,      // most important (real on-chain)
  memoryClaim: 0.8,   // reward claims are strong signal
  socialPost: 0.7,    // social activity
  identityUpdate: 0.4,// Memory identity updated
  ensUpdate: 0.2,     // ENS renewal/change
};

// Take max weighted timestamp
function weightedMax(scores) {
  return scores
    .filter(s => Number.isFinite(s.ts) && s.ts > 0)
    .sort((a, b) => b.ts * b.w - a.ts * a.w)[0] || null;
}

/**
 * Fetches the REAL last activity timestamp for a wallet or ENS.
 *
 * Returns:
 * {
 *   timestamp: ms,
 *   sources: { walletTx, memoryClaim, socialPost, identityUpdate, ensUpdate }
 * }
 */
export async function getFreshnessTimestamp(walletOrEns, profileArg = null) {
  const results = {};

  // --- 1. Last on-chain transaction timestamp (REAL)
  const walletTxTs = await fetchWalletActivityTimestamp(walletOrEns);
  if (walletTxTs) results.walletTx = walletTxTs;

  // --- 2. Last Memory reward claim timestamp
  const claims = await fetchMemoryApiClaims(walletOrEns);
  const latestClaim =
    claims
      .map(c => Date.parse(c.timestamp || 0))
      .filter(Boolean)
      .sort((a, b) => b - a)[0] || null;
  if (latestClaim) results.memoryClaim = latestClaim;

  // --- 3. Last social post timestamp (via Memory identities)
  const profile = profileArg || (await getMemoryProfile(walletOrEns));

  let latestSocial = null;
  for (const ident of profile.identities || []) {
    const posts = ident.posts || ident.social?.posts || [];
    if (Array.isArray(posts) && posts.length) {
      for (const p of posts) {
        const ts = Date.parse(p.createdAt || p.timestamp || 0);
        if (Number.isFinite(ts) && ts > (latestSocial || 0)) {
          latestSocial = ts;
        }
      }
    }
  }
  if (latestSocial) results.socialPost = latestSocial;

  // --- 4. Last Memory identity update timestamp (REAL)
  let identityUpdate = null;
  for (const ident of profile.identities || []) {
    const ts = Date.parse(ident.updatedAt || ident.lastUpdated || 0);
    if (Number.isFinite(ts) && ts > (identityUpdate || 0)) {
      identityUpdate = ts;
    }
  }
  if (identityUpdate) results.identityUpdate = identityUpdate;

  // --- 5. ENS updated/renewed timestamp
  const ensData = await fetchEnsMetadata(profile.ensName || walletOrEns);
  const ensTs = ensData?.createdAt || null;
  if (ensTs && Number.isFinite(ensTs)) results.ensUpdate = ensTs;

  // Weighted winner
  const weighted = weightedMax(
    Object.entries(results).map(([key, ts]) => ({
      key,
      ts,
      w: SOURCE_WEIGHTS[key] || 1,
    }))
  );

  return {
    timestamp: weighted?.ts || null,
    sources: results,
    winningSource: weighted?.key || null,
  };
}
