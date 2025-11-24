// utils/identityConsistency.js

function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

// Basic Levenshtein distance for short handles / names
function levenshtein(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function normalizeText(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Memory-style proof strength weights
const PROOF_STRENGTH = {
  signature: 1.0,
  oauth: 0.85,
  api: 0.7,
  ens: 0.6,
  evm_match: 0.5,
  manual: 0.35,
  inferred: 0.2,
  unknown: 0.1,
};

// Platform trust weights (similar to your engagement rank)
const PLATFORM_WEIGHTS = {
  twitter: 1.3,
  x: 1.3,
  farcaster: 1.2,
  lens: 1.15,
  github: 1.25,
  youtube: 1.2,
  instagram: 1.1,
  zora: 1.05,
  email: 0.4,
  website: 0.5,
  ens: 1.0,
  ethereum: 1.0,
  default: 0.8,
};

// Try to extract a rough "age" in days if metadata is present
function extractAgeDays(identity) {
  const meta = identity.metadata || {};
  const candidates = [
    identity.createdAt,
    identity.created_at,
    identity.created_at_ms,
    meta.createdAt,
    meta.created_at,
    meta.joinedAt,
    meta.joined_at,
  ].filter(Boolean);

  if (!candidates.length) return null;

  const now = Date.now();
  for (const c of candidates) {
    const ts =
      typeof c === "number"
        ? (c > 1e12 ? c : c * 1000) // seconds vs ms
        : Date.parse(c);
    if (!Number.isFinite(ts)) continue;
    const days = (now - ts) / (1000 * 60 * 60 * 24);
    if (days > 0) return days;
  }
  return null;
}

/**
 * Computes:
 *  - identityTrust: Memory-style trust score (0–1)
 *  - consistencyScore: cross-platform cohesion (0–1)
 *  - plus some sub-metrics for debugging/inspection
 */
export function computeIdentityConsistency(identities = []) {
  if (!Array.isArray(identities) || identities.length === 0) {
    return {
      identityTrust: 0,
      consistencyScore: 0,
      handleConsistency: 0,
      avatarConsistency: 0,
      nameConsistency: 0,
    };
  }

  const handles = [];
  const avatars = [];
  const names = [];
  const domains = [];

  // Per-identity trust scores
  const perIdentityTrust = [];

  identities.forEach((id) => {
    const platform = (id.platform || "default").toLowerCase();
    const weight = PLATFORM_WEIGHTS[platform] ?? PLATFORM_WEIGHTS.default;

    const handle = normalizeText(id.username || id.handle);
    const displayName = normalizeText(
      id.displayName || id.name || id.ens || id.domain
    );
    const avatar = id.avatar || null;
    const domain = getDomain(id.url);

    if (handle) handles.push(handle);
    if (avatar) avatars.push(String(avatar));
    if (displayName) names.push(displayName);
    if (domain) domains.push(domain);

    // Proof strength from sources
    const sources = Array.isArray(id.sources) ? id.sources : [];
    const verifiedSources = sources.filter((s) => s && s.verified);

    let proofScore = 0;
    if (verifiedSources.length) {
      let sum = 0;
      verifiedSources.forEach((s) => {
        const type = (s.type || "unknown").toLowerCase();
        sum += PROOF_STRENGTH[type] ?? PROOF_STRENGTH.unknown;
      });
      proofScore = sum / verifiedSources.length; // average strength 0–1
    } else if (sources.length) {
      // unverified sources still give *some* signal
      proofScore = 0.2;
    } else {
      proofScore = 0.1; // no sources; very weak
    }

    // Age normalization (if we can detect it)
    const ageDays = extractAgeDays(id);
    const ageNorm =
      ageDays !== null ? clamp01(ageDays / 365) : 0.5; // neutral if unknown

    // Combine proof, platform trust, age
    const platformNorm = clamp01((weight - 0.5) / 1.0); // roughly maps 0.5–1.3 → 0–1
    const identityTrust =
      proofScore * 0.5 + platformNorm * 0.25 + ageNorm * 0.25;

    perIdentityTrust.push(identityTrust);
  });

  // Global handle / avatar / name consistency signals
  function computeRepetitionScore(list) {
    if (!list.length) return 0;
    const counts = new Map();
    list.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    let multiCount = 0;
    counts.forEach((c) => {
      if (c >= 2) multiCount += 1;
    });
    return multiCount / counts.size; // fraction of values that appear in >=2 identities
  }

  const handleConsistency = computeRepetitionScore(handles);
  const avatarConsistency = computeRepetitionScore(avatars);
  const nameConsistency = computeRepetitionScore(names);

  // Cross-handle similarity beyond exact matches
  let pairwiseSimilarity = 0;
  let pairCount = 0;
  for (let i = 0; i < handles.length; i++) {
    for (let j = i + 1; j < handles.length; j++) {
      const a = handles[i];
      const b = handles[j];
      const maxLen = Math.max(a.length, b.length);
      if (maxLen === 0) continue;
      const dist = levenshtein(a, b);
      const sim = 1 - dist / maxLen;
      pairwiseSimilarity += sim;
      pairCount++;
    }
  }
  const avgHandleSimilarity =
    pairCount > 0 ? clamp01(pairwiseSimilarity / pairCount) : 0;

  // Domain alignment (if multiple identities share the same website domain)
  const domainConsistency = computeRepetitionScore(domains);

  const consistencyScore = clamp01(
    handleConsistency * 0.4 +
      avatarConsistency * 0.2 +
      nameConsistency * 0.2 +
      avgHandleSimilarity * 0.1 +
      domainConsistency * 0.1
  );

  // Aggregate identity trust across all identities,
  // and modulate slightly by global consistency.
  const baseTrust =
    perIdentityTrust.length > 0
      ? perIdentityTrust.reduce((a, v) => a + v, 0) / perIdentityTrust.length
      : 0.1;

  const identityTrust = clamp01(
    baseTrust * 0.7 + consistencyScore * 0.3
  );

  return {
    identityTrust,
    consistencyScore,
    handleConsistency,
    avatarConsistency,
    nameConsistency,
  };
}
