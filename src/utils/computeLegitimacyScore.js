// utils/computeLegitimacyScore.js

// Helper: clamp value into [0, 1]
function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

// Helper: normalize a set of weights so they sum to 1
function normalizeWeights(weights) {
  const entries = Object.entries(weights || {});
  const sum = entries.reduce((s, [, v]) => s + (typeof v === "number" ? v : 0), 0);
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
  identity: 0.30,
  wallet: 0.25,
  social: 0.15,
  ens: 0.10,
  memory: 0.10,
  external: 0.05,
  overlap: 0.05,
});

// Thresholds for non-percentile scaling and sybil controls
const DEFAULT_THRESHOLDS = {
  walletAgeDaysForFull: 365,       // 1 year
  walletTxFull: 200,               // solid history
  ensAgeDaysForFull: 365,          // 1 year
  ensRenewalsForFull: 3,
  claimsForFull: 10,
  memBalanceForFull: 10000,
  followerLogMax: 6,               // log10(1,000,000)
  platformSoftCap: 5,              // diminishing returns after this
  platformHardCap: 10,             // absolute cap used in scaling
};

// Core implementation that returns both score and breakdown
function _computeLegitimacyScoreWithBreakdown(inputs = {}, options = {}) {
  const {
    identities = [],
    profile = null,
    onchainData = null,
    ensData = null,
    walletActivity = null,      // { ageDays, txCount, gasSpent }
    followerQuality = null,     // { realFollowers, botFollowers }
    externalReputation = null,  // 0–1
    mutualOverlap = null,       // 0–1
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

  // Handle & avatar consistency (behavior-like but merged into identity)
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

  const handleConsistency =
    handleMap.size > 0 ? multiHandle / handleMap.size : 0;
  const pfpConsistency = pfpMap.size > 0 ? multiPfp / pfpMap.size : 0;
  const behaviorConsistency = (handleConsistency + pfpConsistency) / 2 || 0;

  // Identity normalized 0–1
  const identityNorm = clamp01(
    verificationRatio * 0.55 +
      platformRichness * 0.25 +
      behaviorConsistency * 0.20
  );

  // ---------------------------------------------------------------------------
  // Wallet authenticity (age + tx count, with percentile support)
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
    const scaled = q ? scaleByQuantiles(walletActivity.txCount, q) : null;
    if (scaled === null) {
      txNorm = clamp01(walletActivity.txCount / (t.walletTxFull || 200));
    } else {
      txNorm = scaled;
    }
  } else {
    txNorm = 0.5;
  }

  const walletNorm = clamp01(ageNorm * 0.6 + txNorm * 0.4);

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

  const socialNorm = clamp01(reachNorm * 0.7 + followerQualityRatio * 0.3);

  // ---------------------------------------------------------------------------
  // ENS intelligence
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

    claimsNorm = clamp01(
      claimsCount / (t.claimsForFull || 10)
    );
    balanceNorm = clamp01(
      memBalance / (t.memBalanceForFull || 10000)
    );
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
