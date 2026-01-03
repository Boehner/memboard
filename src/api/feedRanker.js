// api/feedRanker.js
//
// High-level feed ranking utilities.
//
// Core idea:
//  - For each subject (wallet / ENS), call gatherLegitimacyInputs()
//  - Derive legitimacyScore + engagementScore
//  - Optionally blend in a recency / custom freshness score
//  - Return a combined "feedScore" and sorted list for UI consumption

import { gatherLegitimacyInputs } from "./scoreServices";
import {
  computeLegitimacyScore,
  explainLegitimacyScore,
} from "../utils/computeLegitimacyScore";
import { computeEngagementRank } from "../utils/computeEngagementRank";

// Default weighting for the blended feed score.
const DEFAULT_FEED_WEIGHTS = {
  legitimacy: 0.55,
  engagement: 0.35,
  freshness: 0.10,
};

// Simple clamp helper
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

// Convert a timestamp to a 0–1 freshness score with exponential decay.
// halfLifeDays ~ how fast items decay toward 0.5 / 0.
function freshnessFromTimestamp(
  timestampMs,
  { now = Date.now(), halfLifeDays = 14 } = {}
) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 0.5;

  const ageMs = now - timestampMs;
  if (ageMs <= 0) return 1;

  const halfLifeMs = halfLifeDays * 86400000;
  const decay = Math.exp(-ageMs / halfLifeMs); // 1 → 0 over time
  // Map decay [0,1] to [0.2, 1] so "stale" never fully dies.
  return clamp01(0.2 + 0.8 * decay);
}

// Normalize and merge custom weights with defaults
function resolveWeights(overrideWeights = {}) {
  const merged = { ...DEFAULT_FEED_WEIGHTS, ...overrideWeights };
  const sum =
    (merged.legitimacy || 0) +
    (merged.engagement || 0) +
    (merged.freshness || 0);

  if (!sum) return DEFAULT_FEED_WEIGHTS;

  return {
    legitimacy: (merged.legitimacy || 0) / sum,
    engagement: (merged.engagement || 0) / sum,
    freshness: (merged.freshness || 0) / sum,
  };
}

/**
 * Score a single subject (wallet or ENS-like string).
 *
 * subject = {
 *   id: string | number,
 *   walletOrEns: string,
 *   // optional:
 *   timestamp?: number (ms since epoch, for recency),
 *   freshnessOverride?: number (0–1 directly),
 *   meta?: any (passed through for the UI),
 * }
 *
 * options = {
 *   weights?: { legitimacy, engagement, freshness },
 *   legitimacyOptions?: options passed through to computeLegitimacyScore/explainLegitimacyScore
 *   freshnessConfig?: { now?: number, halfLifeDays?: number }
 * }
 */
export async function scoreSubject(subject, options = {}) {
  const {
    walletOrEns,
    timestamp,
    freshnessOverride,
    id = walletOrEns,
    meta = {},
    } = subject || {};

    if (!walletOrEns) {
        return {
        id,
        walletOrEns,
        feedScore: 0,
        legitimacyScore: 0,
        engagementScore: 0,
        freshnessScore: 0.5,
        legitimacyBreakdown: null,
        engagementBreakdown: null,
        inputs: null,
        meta,
        };
    }

  const weights = resolveWeights(options.weights);
  const legitimacyOptions = options.legitimacyOptions || {};
  const freshnessConfig = options.freshnessConfig || {};

  // 1. Gather raw inputs for this wallet/ENS
  // If caller provided the main user's profile, reuse it to avoid refetching
  const userWallet = options.userWallet || null;
  const userProfile = options.userProfile || null;
  const profileArg = userWallet && userProfile && userWallet === walletOrEns ? userProfile : null;
  const inputs = await gatherLegitimacyInputs(walletOrEns, profileArg);

  // 2. Legitimacy score (0–100)
  const legitExplain = explainLegitimacyScore(inputs, legitimacyOptions);
  const legitimacyScore = legitExplain.score ?? computeLegitimacyScore(
    inputs,
    legitimacyOptions
  );

  // 3. Engagement rank (0–100)
  const engagement = computeEngagementRank({
    identities: inputs.identities || [],
    onChain: inputs.onchainData,
  });
  const engagementScore = engagement.score || 0;

  // 4. Freshness (0–1 → later scaled to 0–100 for display, but we mix as 0–1)
    let freshnessTs = null;

    if (typeof freshnessOverride === "number") {
    freshnessTs = freshnessOverride;
    } else {
    const f = await getFreshnessTimestamp(walletOrEns);
    freshnessTs = f.timestamp;
    }

    const freshnessScore01 = freshnessFromTimestamp(
    freshnessTs,
    freshnessConfig
    );


  // Normalize scores into [0,1] for blending
  const legitNorm = clamp01(legitimacyScore / 100);
  const engNorm = clamp01(engagementScore / 100);

  const feedNorm =
    legitNorm * weights.legitimacy +
    engNorm * weights.engagement +
    freshnessScore01 * weights.freshness;

  const feedScore = Math.round(clamp01(feedNorm) * 100);

  return {
    id,
    walletOrEns,
    feedScore,
    legitimacyScore,
    engagementScore,
    freshnessScore: Math.round(freshnessScore01 * 100),
    weights,
    legitimacyBreakdown: legitExplain.breakdown,
    engagementBreakdown: engagement.breakdown,
    inputs,
    meta,
  };
}

/**
 * Rank a list of subjects for a feed.
 *
 * subjects: Array<subject> (see scoreSubject docs)
 *
 * Returns: {
 *   items: Array<scoredSubject>,
 *   meta: {
 *     weights,
 *     count,
 *   }
 * }
 */
export async function rankSubjects(subjects = [], options = {}) {
  if (!Array.isArray(subjects) || !subjects.length) {
    return { items: [], meta: { weights: resolveWeights(options.weights), count: 0 } };
  }

  const weights = resolveWeights(options.weights);

  const scored = await Promise.all(
    subjects.map((s) => scoreSubject(s, { ...options, weights }))
  );

  scored.sort((a, b) => b.feedScore - a.feedScore);

  return {
    items: scored,
    meta: {
      weights,
      count: scored.length,
    },
  };
}
