// Engagement Rank heuristic
// Returns { score (0-100), percentileApprox (number), label (string), breakdown }
// Inputs: identities[], onChain { claims, balance }
// Strategy:
//  - Base engagement from weighted follower log scale
//  - Verified multiplier boosts reliability
//  - Cross-platform consistency (handles used on >=2 platforms)
//  - On-chain activity bonus (claims + balance presence)
//  - Activity freshness placeholder (could use timestamps later)

const PLATFORM_WEIGHTS = {
  twitter: 1.3,
  x: 1.3,
  lens: 1.2,
  farcaster: 1.15,
  github: 1.05,
  zora: 1.1,
  youtube: 1.25,
  instagram: 1.2,
  tiktok: 1.2,
  ethereum: 0.8,
  ens: 0.8,
  website: 0.6,
  email: 0.4,
  default: 0.75,
};

export function computeEngagementRank({ identities = [], onChain = null }) {
  if (!identities.length) {
    return { score: 0, percentileApprox: 100, label: 'No Data', breakdown: {} };
  }

  // Followers component
  let followerComponent = 0;
  let totalFollowers = 0;
  identities.forEach(id => {
    const followers = id.social?.followers || 0;
    totalFollowers += followers;
    const w = PLATFORM_WEIGHTS[id.platform?.toLowerCase()] || PLATFORM_WEIGHTS.default;
    // log10 scaling keeps huge accounts from dominating entirely
    followerComponent += w * Math.log10(followers + 10); // +10 smoothing
  });

  // Verified reliability multiplier
  const verifiedCount = identities.filter(i => i.sources?.some(s => s.verified)).length;
  const verificationRatio = verifiedCount / identities.length;
  const reliabilityMult = 1 + Math.min(0.5, verificationRatio * 0.6); // caps at +0.5

  // Handle consistency: handles appearing >=2 times
  const handleFreq = new Map();
  identities.forEach(i => {
    const h = i.username || i.handle;
    if (h) handleFreq.set(h.toLowerCase(), (handleFreq.get(h.toLowerCase()) || 0) + 1);
  });
  const multiHandles = [...handleFreq.values()].filter(c => c >= 2).length;
  const consistencyBonus = handleFreq.size ? Math.min(0.12, (multiHandles / handleFreq.size) * 0.2) : 0; // up to +0.12

  // On-chain activity
  const claimsCount = (onChain?.claims || []).length;
  const balance = Number(onChain?.balance || 0);
  const claimsScore = Math.min(1, claimsCount / 12); // 12 claims saturates
  const balanceScore = Math.min(1, balance / 15000); // heuristic scaling
  const onChainBonus = (claimsScore * 0.7 + balanceScore * 0.3) * 0.25; // up to +0.25

  // Raw engagement score before normalization
  let rawScore = followerComponent * reliabilityMult;
  rawScore *= (1 + consistencyBonus + onChainBonus);

  // Normalize: choose dynamic scaling baseline
  // Assume followerComponent ~ 0-50 typical, map to 0-100 via sigmoid-ish transform
  const normalized = sigmoidScale(rawScore, 50);
  const score = Math.round(Math.max(0, Math.min(100, normalized)));

  // Percentile approximation mapping (inverse of score, assume skewed distribution)
  const percentileApprox = Math.round(100 - (score ** 1.05) / (100 ** 1.05) * 100);

  const label = rankLabel(score, percentileApprox);

  return {
    score,
    percentileApprox,
    label,
    breakdown: {
      totalFollowers,
      verifiedCount,
      reliabilityMult: Number(reliabilityMult.toFixed(3)),
      followerComponent: Number(followerComponent.toFixed(3)),
      consistencyBonus: Number(consistencyBonus.toFixed(3)),
      onChainBonus: Number(onChainBonus.toFixed(3)),
      rawScore: Number(rawScore.toFixed(3))
    }
  };
}

function sigmoidScale(value, mid) {
  // Smooth scaling using logistic-like function
  // mid ~ value that maps near 60
  const k = 0.07; // steepness
  return 100 / (1 + Math.exp(-k * (value - mid))) - 5; // shift so low values aren't too high
}

function rankLabel(score, percentile) {
  if (score >= 90) return 'Elite';
  if (score >= 75) return percentile <= 20 ? 'High' : 'Rising';
  if (score >= 60) return 'Active';
  if (score >= 40) return 'Emerging';
  if (score >= 20) return 'Developing';
  return 'Dormant';
}
