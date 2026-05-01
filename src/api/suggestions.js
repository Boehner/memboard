// api/suggestions.js
// A small rule-based suggestions engine for MemBoard.
// buildSuggestions({ identities, walletGraph, walletHistory, scores })
// Returns: { suggestedAccounts, suggestedMiniApps, suggestedAssets }

const CURATED_ACCOUNTS = [
  { id: 'memboard_official', display: 'MemBoard (Official)', type: 'community', tags: ['official', 'product'] },
  { id: 'farcaster', display: 'Farcaster', type: 'platform', tags: ['bridge', 'social'] },
  { id: 'ens_foundation', display: 'ENS Foundation', type: 'community', tags: ['naming'] },
];

const CURATED_MINIAPPS = [
  { id: 'mem-insights', display: 'Mem Insights', category: 'analytics' },
  { id: 'onchain-scan', display: 'OnChain Scan', category: 'explorer' },
];

const SCORE_THRESHOLDS = {
  highConfidence: 0.75,
  mediumConfidence: 0.5,
};

function makeSuggestion(item, why, confidence, riskFlags = []) {
  return { id: item.id || item.address || item, display: item.display || item.id || item, why, confidence, riskFlags };
}

function addIfNotPresent(list, suggestion) {
  if (!list.find(s => s.id === suggestion.id)) list.push(suggestion);
}

export function buildSuggestions({ identities = [], walletGraph = null, walletHistory = null, scores = {} } = {}) {
  const suggestedAccounts = [];
  const suggestedMiniApps = [];
  const suggestedAssets = [];

  // 1) Suggest official / platform accounts when user has weak presence but low risk
  const platforms = new Set((identities || []).map(i => (i.platform || '').toLowerCase()));
  const verifiedCount = (identities || []).filter(i => i.verified).length;
  const totalIdent = Math.max(1, identities.length);
  const verifiedRatio = verifiedCount / totalIdent;

  if (verifiedRatio < 0.4) {
    // suggest community/platform handles to follow or connect
    for (const acct of CURATED_ACCOUNTS) {
      const why = [];
      why.push(`Low identity verification (${Math.round(verifiedRatio*100)}%)`);
      if (!platforms.has('ens') && acct.tags.includes('naming')) why.push('No ENS presence — consider ENS resources');
      const confidence = verifiedRatio < 0.2 ? 0.9 : 0.6;
      addIfNotPresent(suggestedAccounts, makeSuggestion(acct, why, confidence));
    }
  }

  // 2) Suggest mini-apps based on wallet activity and presence
  const activityScore = walletHistory?.activityCadenceScore ?? null;
  if (activityScore !== null) {
    if (activityScore > 0.6) {
      addIfNotPresent(suggestedMiniApps, makeSuggestion(CURATED_MINIAPPS[0], ['Active on-chain: good for analytics'], 0.8));
    } else if (activityScore > 0.2) {
      addIfNotPresent(suggestedMiniApps, makeSuggestion(CURATED_MINIAPPS[1], ['Moderate activity: try explorers'], 0.5));
    }
  }

  // 3) Suggest accounts from walletGraph (linked wallets) when confidence high
  if (walletGraph && walletGraph.links && walletGraph.links.length > 0) {
    for (const l of walletGraph.links.slice(0, 8)) {
      const why = [`Linked in Memory identities (${Math.round((l.confidence||0)*100)}% soft link)`];
      const confidence = l.confidence || 0.35;
      const riskFlags = [];
      if (l.count && l.count > 5 && (l.confidence || 0) < 0.2) {
        riskFlags.push('reused-address-low-confidence');
      }
      addIfNotPresent(suggestedAccounts, makeSuggestion({ id: l.address, display: l.address }, why, confidence, riskFlags));
    }
  }

  // 4) Asset suggestions (optional): lightly suggest explorers or common token trackers when activity is high
  if (walletHistory && (walletHistory.recentTxCount30d || 0) > 5) {
    addIfNotPresent(suggestedAssets, makeSuggestion({ id: 'token-tracker', display: 'Token Tracker' }, ['High recent activity'], 0.5));
  }

  // 5) Risk heuristics: mark suggestions when sybil-ish patterns appear
  const riskFlagsGlobal = [];
  if ((walletGraph?.links || []).length > 20 && (verifiedRatio < 0.2)) {
    riskFlagsGlobal.push('many-soft-links-low-verification');
  }

  // Attach global risk flags to lower-confidence suggestions
  if (riskFlagsGlobal.length) {
    for (const s of suggestedAccounts) s.riskFlags = Array.from(new Set([...(s.riskFlags||[]), ...riskFlagsGlobal]));
  }

  // Normalize confidence to [0,1]
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  for (const s of [...suggestedAccounts, ...suggestedMiniApps, ...suggestedAssets]) {
    s.confidence = clamp01(s.confidence || 0);
    if (!s.why) s.why = ['Suggested by MemBoard heuristics'];
  }

  return { suggestedAccounts, suggestedMiniApps, suggestedAssets };
}

export default buildSuggestions;
