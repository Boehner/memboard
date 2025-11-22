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

const MAX_RAW = 40;

export function computeEngagementRank({ identities = [], onChain = null }) {
  if (!identities.length) {
    return { score: 0, percentileApprox: 0, label: 'No Data', breakdown: {} };
  }

  let followerComponent = 0;
  let totalFollowers = 0;

  identities.forEach(id => {
    const platform = id.platform?.toLowerCase() || 'unknown';
    const followers = id.social?.followers || 0;
    totalFollowers += followers;

    const w = PLATFORM_WEIGHTS[platform] || PLATFORM_WEIGHTS.default;
    const incremental = w * Math.log10(followers + 10);
    followerComponent += incremental;

  });
  const verifiedCount = identities.filter(i => i.sources?.some(s => s.verified)).length;
  const verificationRatio = verifiedCount / identities.length;
  const reliabilityMult = 1 + Math.min(0.5, verificationRatio * 0.6);
  const handleFreq = new Map();
  identities.forEach(i => {
    const h = i.username || i.handle;
    if (h) handleFreq.set(h.toLowerCase(), (handleFreq.get(h.toLowerCase()) || 0) + 1);
  });
  const multiHandles = [...handleFreq.values()].filter(c => c >= 2).length;
  const consistencyBonus = handleFreq.size
    ? Math.min(0.12, (multiHandles / handleFreq.size) * 0.2)
    : 0;
  const claimsCount = (onChain?.claims || []).length;
  const balance = Number(onChain?.balance || 0);
  const claimsScore = Math.min(1, claimsCount / 12);
  const balanceScore = Math.min(1, balance / 15000);
  const onChainBonus = (claimsScore * 0.7 + balanceScore * 0.3) * 0.25;
  let rawScore = followerComponent * reliabilityMult;
  rawScore *= (1 + consistencyBonus + onChainBonus);
  const normalized = Math.min(100, (rawScore / MAX_RAW) * 100);
  const score = Math.round(normalized);
  const percentileApprox = score;
  const label = rankLabel(score);
  const breakdown = {
    totalFollowers,
    verifiedCount,
    reliabilityMult: Number(reliabilityMult.toFixed(3)),
    followerComponent: Number(followerComponent.toFixed(3)),
    consistencyBonus: Number(consistencyBonus.toFixed(3)),
    onChainBonus: Number(onChainBonus.toFixed(3)),
    rawScore: Number(rawScore.toFixed(3)),
  };

  return { score, percentileApprox, label, breakdown };
}

function rankLabel(score) {
  if (score >= 90) return 'Elite';
  if (score >= 75) return 'High';
  if (score >= 60) return 'Active';
  if (score >= 40) return 'Emerging';
  if (score >= 20) return 'Developing';
  return 'Dormant';
}
