// Heuristic legitimacy score calculation
// Inputs: identities (Array), profile ({ total, verified }), onchainData ({ claims, balance })
// Output: number 0-100
export function computeLegitimacyScore({ identities = [], profile = null, onchainData = null }) {
  if (!identities.length || !profile) return 0;

  const total = profile.total || identities.length;
  const verified = profile.verified || 0;

  // 1. Verification ratio (0-40)
  const verificationRatio = total > 0 ? verified / total : 0;
  const verificationScore = Math.min(1, verificationRatio) * 40;

  // 2. Platform diversity (0-20)
  const platforms = new Set(identities.map(i => (i.platform || 'unknown').toLowerCase()));
  const diversityScore = Math.min(1, platforms.size / 8) * 20; // assume 8 is "very diverse"

  // 3. Social reach quality (0-15) using average log10(followers+1)
  const followerCounts = identities
    .map(i => i.social?.followers)
    .filter(v => typeof v === 'number' && v > 0);
  let socialScore = 0;
  if (followerCounts.length) {
    const avgLog = followerCounts.reduce((sum, v) => sum + Math.log10(v + 1), 0) / followerCounts.length;
    socialScore = Math.min(1, avgLog / 6) * 15; // log10(1,000,000) ≈ 6
  }

  // 4. Handle consistency (0-10): proportion of handles appearing on >=2 platforms
  const handleUsage = new Map();
  identities.forEach(i => {
    const h = i.username || i.handle;
    if (h) handleUsage.set(h.toLowerCase(), (handleUsage.get(h.toLowerCase()) || 0) + 1);
  });
  const multiPlatformHandles = [...handleUsage.values()].filter(c => c >= 2).length;
  const consistencyScore = handleUsage.size ? Math.min(1, multiPlatformHandles / handleUsage.size) * 10 : 0;

  // 5. On-chain activity (0-10): claims + balance heuristics
  let onchainScore = 0;
  if (onchainData) {
    const claimsCount = (onchainData.claims || []).length;
    const balance = Number(onchainData.balance || 0);
    const claimsComponent = Math.min(1, claimsCount / 10); // 10 claims => full
    // Balance scaling: assume 10k tokens signals maturity
    const balanceComponent = Math.min(1, balance / 10000);
    onchainScore = Math.min(1, (claimsComponent * 0.6 + balanceComponent * 0.4)) * 10;
  }

  // 6. Presence of core identity anchors (ENS or Ethereum) (+5 if present)
  const hasAnchor = identities.some(i => ['ens','ethereum'].includes((i.platform || '').toLowerCase()));
  const anchorBonus = hasAnchor ? 5 : 0;

  const rawTotal = verificationScore + diversityScore + socialScore + consistencyScore + onchainScore + anchorBonus;
  return Math.round(Math.max(0, Math.min(100, rawTotal)));
}

export function explainLegitimacyScore(inputs) {
  const score = computeLegitimacyScore(inputs);
  const { identities = [], profile = null, onchainData = null } = inputs;
  const total = profile?.total || identities.length;
  const verified = profile?.verified || 0;
  const platforms = new Set(identities.map(i => (i.platform || 'unknown').toLowerCase()));
  const followerCounts = identities.map(i => i.social?.followers).filter(v => typeof v === 'number' && v > 0);
  const avgFollowers = followerCounts.length ? Math.round(followerCounts.reduce((s,v)=>s+v,0)/followerCounts.length) : 0;
  return {
    score,
    breakdown: {
      verifiedRatio: total ? (verified/total).toFixed(2) : '0.00',
      platformCount: platforms.size,
      avgFollowers,
      identities: identities.length,
      claims: onchainData?.claims?.length || 0,
      balance: onchainData?.balance || 0
    }
  };
}
