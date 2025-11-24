// utils/computeLegitimacyScore.js

// Helper: clamp value into [0, 1]
function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

// Helper: normalize a set of weights so they sum to 1
function normalizeWeights(weights) {
  const entries = Object.entries(weights || {});
  const sum = entries.reduce(
    (s, [, v]) => s + (typeof v === "number" ? v : 0),
    0
  );
  if (!sum) return weights;
  return Object.fromEntries(entries.map(([k, v]) => [k, v / sum]));
}

// Helper: percentile-based scaling (0–1) using approximate quantiles
// quantiles example: { p50: 10, p75: 50, p90: 200 }
function scaleByQuantiles(value, quantiles) {
  if (!quantiles) return null;
  const { p50, p75, p90 } = quantiles;
  if (!p50 || !p75 || !p90) return null;
  if (value <= 0) return 0;

  if (value <= p50) {
    // lower half of distribution → 0 to ~0.4
    return clamp01(0.4 * (value / p50));
  }
  if (value <= p75) {
    // between median and p75 → 0.4 to 0.7
    const t = (value - p50) / (p75 - p50);
    return clamp01(0.4 + 0.3 * t);
  }
  if (value <= p90) {
    // between p75 and p90 → 0.7 to 0.9
    const t = (value - p75) / (p90 - p75);
    return clamp01(0.7 + 0.2 * t);
  }
  // beyond p90 → saturate slowly from 0.9 to 1.0 with diminishing returns
  const t = (value - p90) / (p90 || 1);
  return clamp01(0.9 + 0.1 * (1 - Math.exp(-t)));
}

// Default weights across dimensions (sum to 1 after normalization)
const DEFAULT_WEIGHTS = normalizeWeights({
  identity: 0.3,
  wallet: 0.25,
  social: 0.15,
  ens: 0.1,
  memory: 0.1,
  external: 0.05,
  overlap: 0.05,
});

// Thresholds for non-percentile scaling and sybil controls
const DEFAULT_THRESHOLDS = {
  walletAgeDaysForFull: 365, // 1 year
  walletTxFull: 200, // solid history
  ensAgeDaysForFull: 365, // 1 year (can override to 730 in options if you want 2y)
  ensRenewalsForFull: 3,
  claimsForFull: 10,
  memBalanceForFull: 10000,
  followerLogMax: 6, // log10(1,000,000)
  platformSoftCap: 5, // diminishing returns after this
  platformHardCap: 10, // absolute cap used in scaling
};

// Core implementation that returns both score and breakdown
function _computeLegitimacyScoreWithBreakdown(inputs = {}, options = {}) {
  const {
    identities = [],
    profile = null,
    onchainData = null,
    ensData = null,
    bnsName = null,              // currently not used directly, but available
    walletActivity = null,       // { ageDays, txCount, gasSpent }
    followerQuality = null,      // { realFollowers, botFollowers }
    externalReputation = null,   // 0–1
    mutualOverlap = null,        // 0–1
    identityTrust = null,        // 0–1
    consistencyScore = null,     // 0–1
  } = inputs;

  const {
    weights: rawWeights = DEFAULT_WEIGHTS,
    thresholds: t = DEFAULT_THRESHOLDS,
    stats = {}, // percentile stats, e.g. stats.txCountQuantiles, stats.followerLogQuantiles
  } = options;

  const weights = normalizeWeights({ ...DEFAULT_WEIGHTS, ...rawWeights });

  if (!identities.length || !profile) {
    return {
      score: 0,
      breakdown: {
        identity: { normalized: 0, weighted: 0 },
        wallet: { normalized: 0, weighted: 0 },
        social: { normalized: 0, weighted: 0 },
        ens: { normalized: 0, weighted: 0 },
        memory: { normalized: 0, weighted: 0 },
        external: { normalized: 0, weighted: 0 },
        overlap: { normalized: 0, weighted: 0 },
        meta: { reason: "no-identities-or-profile" },
      },
    };
  }

  const total = profile.total || identities.length;
  const verified = profile.verified || 0;

  // ---------------------------------------------------------------------------
  // Identity signals
  // ---------------------------------------------------------------------------
  const verificationRatio = total > 0 ? verified / total : 0;

  const platformsSet = new Set(
    identities.map((i) => (i.platform || "unknown").toLowerCase())
  );
  const platformCountRaw = platformsSet.size;

  // Sybil protection: diminishing returns after platformSoftCap
  const softCap = t.platformSoftCap || 5;
  const hardCap = t.platformHardCap || 10;
  const cappedCount = Math.min(platformCountRaw, hardCap);
  // sqrt to flatten above softCap
  const platformRichness = clamp01(Math.sqrt(cappedCount / softCap));

  // Legacy handle & avatar consistency (kept as fallback / secondary signal)
  const handleMap = new Map();
  const pfpMap = new Map();
  identities.forEach((i) => {
    const h = (i.username || i.handle || "").toLowerCase();
    if (h) handleMap.set(h, (handleMap.get(h) || 0) + 1);
    const p = i.avatar || null;
    if (p) pfpMap.set(p, (pfpMap.get(p) || 0) + 1);
  });

  const multiHandle = [...handleMap.values()].filter((c) => c >= 2).length;
  const multiPfp = [...pfpMap.values()].filter((c) => c >= 2).length;

  const handleConsistencyLegacy =
    handleMap.size > 0 ? multiHandle / handleMap.size : 0;
  const pfpConsistencyLegacy =
    pfpMap.size > 0 ? multiPfp / pfpMap.size : 0;
  const behaviorConsistencyLegacy =
    (handleConsistencyLegacy + pfpConsistencyLegacy) / 2 || 0;

  // ENS + BNS age bonuses (for identity fairness)
  let ensAgeBonus = 0;
  if (ensData && typeof ensData.nameAgeDays === "number") {
    // You can override ensAgeDaysForFull in options to 730 if you want 2y full credit
    const fullDays = t.ensAgeDaysForFull || 365;
    ensAgeBonus = clamp01(ensData.nameAgeDays / fullDays);
  }

  let basenameBonus = 0;
  if (bnsName) {
    basenameBonus = 0.10; // small identity boost
  }

  // NEW: use identityTrust + consistencyScore when available, plus ENS & BNS bonuses
  let identityNorm;
  if (typeof identityTrust === "number") {
    const trustNorm = clamp01(identityTrust);
    const consistencyNorm =
      typeof consistencyScore === "number"
        ? clamp01(consistencyScore)
        : behaviorConsistencyLegacy;

    // Fair weighting inside identity:
    //  - identityTrust:   0.60
    //  - consistency:     0.20
    //  - platformRichness:0.10
    //  - ENS age bonus:   0.08
    //  - BNS name bonus:   0.02
    identityNorm = clamp01(
      trustNorm * 0.6 +
        consistencyNorm * 0.2 +
        platformRichness * 0.1 +
        ensAgeBonus * 0.08 +
        basenameBonus * 0.02
    );
  } else {
    // Fallback to previous formulation + name bonuses
    identityNorm = clamp01(
      verificationRatio * 0.5 +
        platformRichness * 0.2 +
        behaviorConsistencyLegacy * 0.2 +
        ensAgeBonus * 0.08 +
        basenameBonus * 0.02
    );
  }

  // ---------------------------------------------------------------------------
  // Wallet authenticity (age + tx count + gas spent, with percentile support)
  // ---------------------------------------------------------------------------
  let ageNorm;
  if (walletActivity && typeof walletActivity.ageDays === "number") {
    ageNorm = clamp01(
      walletActivity.ageDays / (t.walletAgeDaysForFull || 365)
    );
  } else {
    ageNorm = 0.5; // neutral missing data
  }

  let txNorm;
  if (walletActivity && typeof walletActivity.txCount === "number") {
    const q = stats.txCountQuantiles;
    const scaled = q
      ? scaleByQuantiles(walletActivity.txCount, q)
      : null;
    if (scaled === null) {
      txNorm = clamp01(walletActivity.txCount / (t.walletTxFull || 200));
    } else {
      txNorm = scaled;
    }
  } else {
    txNorm = 0.5;
  }

  // NEW: gas usage signal (helps distinguish real wallets from pure relayers)
  let gasNorm = 0.5;
  if (walletActivity && typeof walletActivity.gasSpent === "number") {
    const gasEth = walletActivity.gasSpent;
    if (gasEth > 0) {
      const gasLog = Math.log10(gasEth + 1);
      const q = stats.gasSpentQuantiles;
      const scaled = q ? scaleByQuantiles(gasLog, q) : null;
      if (scaled === null) {
        gasNorm = clamp01(gasLog / 4); // up to ~1e4 ETH gas equivalent
      } else {
        gasNorm = scaled;
      }
    } else {
      gasNorm = 0.3; // zero-gas wallets are slightly penalized
    }
  }

  const walletNorm = clamp01(ageNorm * 0.4 + txNorm * 0.35 + gasNorm * 0.25);

  // ---------------------------------------------------------------------------
  // Social graph quality (followers + bot ratio)
  // ---------------------------------------------------------------------------
  const followerCounts = identities
    .map((i) => i.social?.followers)
    .filter((v) => typeof v === "number" && v > 0);

  let avgFollowers = 0;
  let avgFollowerLog = 0;

  if (followerCounts.length) {
    avgFollowers =
      followerCounts.reduce((s, v) => s + v, 0) / followerCounts.length;
    avgFollowerLog =
      followerCounts.reduce((s, v) => s + Math.log10(v + 1), 0) /
      followerCounts.length;
  }

  let reachNorm;
  if (avgFollowerLog > 0) {
    const q = stats.followerLogQuantiles;
    const scaled = q ? scaleByQuantiles(avgFollowerLog, q) : null;
    if (scaled === null) {
      reachNorm = clamp01(avgFollowerLog / (t.followerLogMax || 6));
    } else {
      reachNorm = scaled;
    }
  } else {
    reachNorm = 0.5;
  }

  let followerQualityRatio = 0.5; // neutral
  if (followerQuality) {
    const { realFollowers = 0, botFollowers = 0 } = followerQuality;
    const totalF = realFollowers + botFollowers;
    followerQualityRatio = totalF > 0 ? realFollowers / totalF : 0.5;
  }

  const socialNorm = clamp01(reachNorm * 0.6 + followerQualityRatio * 0.4);

  // ---------------------------------------------------------------------------
  // ENS intelligence (kept as separate dimension)
  // ---------------------------------------------------------------------------
  let ensAgeNorm = 0.5;
  let ensRenewalNorm = 0.5;

  if (ensData) {
    if (typeof ensData.nameAgeDays === "number") {
      ensAgeNorm = clamp01(
        ensData.nameAgeDays / (t.ensAgeDaysForFull || 365)
      );
    }
    if (typeof ensData.renewalCount === "number") {
      ensRenewalNorm = clamp01(
        ensData.renewalCount / (t.ensRenewalsForFull || 3)
      );
    }
  }

  const ensNorm = clamp01(ensAgeNorm * 0.7 + ensRenewalNorm * 0.3);

  // ---------------------------------------------------------------------------
  // Memory protocol activity
  // ---------------------------------------------------------------------------
  let claimsNorm = 0.5;
  let balanceNorm = 0.5;
  let claimsCount = 0;
  let memBalance = 0;

  if (onchainData) {
    claimsCount = (onchainData.claims || []).length;
    memBalance = Number(onchainData.balance || 0);

    claimsNorm = clamp01(claimsCount / (t.claimsForFull || 10));
    balanceNorm = clamp01(memBalance / (t.memBalanceForFull || 10000));
  }

  const memoryNorm = clamp01(claimsNorm * 0.6 + balanceNorm * 0.4);

  // ---------------------------------------------------------------------------
  // External reputation (0–1) and mutual overlap (0–1)
  // ---------------------------------------------------------------------------
  const externalNorm =
    typeof externalReputation === "number"
      ? clamp01(externalReputation)
      : 0.5;

  const overlapNorm =
    typeof mutualOverlap === "number" ? clamp01(mutualOverlap) : 0.5;

  // ---------------------------------------------------------------------------
  // Final weighted score
  // ---------------------------------------------------------------------------
  const dims = {
    identity: identityNorm,
    wallet: walletNorm,
    social: socialNorm,
    ens: ensNorm,
    memory: memoryNorm,
    external: externalNorm,
    overlap: overlapNorm,
  };

  let finalNorm = 0;
  const dimBreakdown = {};

  Object.entries(dims).forEach(([key, norm]) => {
    const w = weights[key] ?? 0;
    const weighted = norm * w;
    finalNorm += weighted;
    dimBreakdown[key] = {
      normalized: norm,
      weight: w,
      weighted: weighted,
    };
  });

  const score = Math.round(clamp01(finalNorm) * 100);

  return {
    score,
    breakdown: {
      ...dimBreakdown,
      meta: {
        totalIdentities: identities.length,
        verifiedIdentities: verified,
        platforms: Array.from(platformsSet),
        platformCountRaw,
        avgFollowers,
        avgFollowerLog,
        claimsCount,
        memBalance,
        walletAgeDays: walletActivity?.ageDays,
        ensAgeDays: ensData?.nameAgeDays,
        hasBasename: bnsName ? true : false,
      },
    },
  };
}

// Public API: same signature as before, but with optional options
export function computeLegitimacyScore(inputs, options) {
  return _computeLegitimacyScoreWithBreakdown(inputs, options).score;
}

// Public API: full transparency object with component breakdown
export function explainLegitimacyScore(inputs, options) {
  return _computeLegitimacyScoreWithBreakdown(inputs, options);
}
