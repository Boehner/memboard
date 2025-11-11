import { computeLegitimacyScore, explainLegitimacyScore } from './computeLegitimacyScore';
import { computeEngagementRank } from './computeEngagementRank';

// Compare a primary identity set against a baseline (e.g. "casual" cohort)
// Inputs: { primary: { identities, profile, onChain }, baseline: { identities, profile, onChain } }
// Returns rich delta & breakdown for UI badges.
export function computeComparativeScores({ primary, baseline }) {
  const primaryLeg = computeLegitimacyScore({
    identities: primary.identities,
    profile: primary.profile,
    onchainData: primary.onChain,
  });
  const baselineLeg = computeLegitimacyScore({
    identities: baseline.identities,
    profile: baseline.profile,
    onchainData: baseline.onChain,
  });

  const primaryLegExplain = explainLegitimacyScore({
    identities: primary.identities,
    profile: primary.profile,
    onchainData: primary.onChain,
  });
  const baselineLegExplain = explainLegitimacyScore({
    identities: baseline.identities,
    profile: baseline.profile,
    onchainData: baseline.onChain,
  });

  const primaryEng = computeEngagementRank({ identities: primary.identities, onChain: primary.onChain });
  const baselineEng = computeEngagementRank({ identities: baseline.identities, onChain: baseline.onChain });

  // Deltas
  const legitimacyDiff = primaryLeg - baselineLeg;
  const engagementDiff = primaryEng.score - baselineEng.score;
  const legitimacyPctIncrease = baselineLeg ? ((legitimacyDiff / baselineLeg) * 100) : 0;
  const engagementPctIncrease = baselineEng.score ? ((engagementDiff / baselineEng.score) * 100) : 0;

  return {
    primary: {
      legitimacy: primaryLeg,
      engagement: primaryEng.score,
      engagementLabel: primaryEng.label,
      legitimacyBreakdown: primaryLegExplain.breakdown,
      engagementBreakdown: primaryEng.breakdown,
    },
    baseline: {
      legitimacy: baselineLeg,
      engagement: baselineEng.score,
      engagementLabel: baselineEng.label,
      legitimacyBreakdown: baselineLegExplain.breakdown,
      engagementBreakdown: baselineEng.breakdown,
    },
    deltas: {
      legitimacyDiff,
      engagementDiff,
      legitimacyPctIncrease: Number(legitimacyPctIncrease.toFixed(2)),
      engagementPctIncrease: Number(engagementPctIncrease.toFixed(2)),
      comparativeTier: comparativeTier(legitimacyDiff, engagementDiff),
    },
  };
}

function comparativeTier(legDiff, engDiff) {
  if (legDiff >= 25 && engDiff >= 25) return 'Significantly Higher';
  if (legDiff >= 10 && engDiff >= 10) return 'Higher';
  if (legDiff >= 5 || engDiff >= 5) return 'Moderately Higher';
  if (legDiff <= -20 && engDiff <= -20) return 'Significantly Lower';
  if (legDiff <= -8 && engDiff <= -8) return 'Lower';
  if (legDiff <= -3 || engDiff <= -3) return 'Slightly Lower';
  return 'Comparable';
}

// Convenience helper: given two raw identity arrays, build minimal profile objects
export function quickCompareIdentities(primaryIdentities, baselineIdentities, primaryOnChain = null, baselineOnChain = null) {
  const buildProfile = (ids) => ({ total: ids.length, verified: ids.filter(i => i.sources?.some(s => s.verified)).length });
  return computeComparativeScores({
    primary: { identities: primaryIdentities, profile: buildProfile(primaryIdentities), onChain: primaryOnChain },
    baseline: { identities: baselineIdentities, profile: buildProfile(baselineIdentities), onChain: baselineOnChain },
  });
}
