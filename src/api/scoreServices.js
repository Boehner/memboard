// api/scoreServices.js
import { fetchMemBalance } from "./memRewards.js";
import { fetchWalletAge } from "./walletAge.js";
import { fetchWalletActivity } from "./walletActivity.js";
import { fetchWalletHistory } from "./walletHistory.js";
import { fetchEnsMetadata } from "./ens.js";
import { getEthereumProvider, rotateEthereumProvider } from "./provider.js";
import { computeFollowerQuality } from "./followerQuality.js";
import { fetchWalletLinks } from "./walletLinks.js";
import { computeIdentityConsistency } from "./identityConsistency.js";
import { computeSocialOverlap } from "./socialOverlap.js";
import { fetchSocialGraph } from "./socialGraph.js";
import { buildSuggestions } from "./suggestions.js";
import vault from "./vault.js";

// ENS reverse lookup caching
const ensCache = new Map();
const ensInFlight = new Map();
const ENS_CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000;

export async function gatherLegitimacyInputs(walletOrEns, profile) {
  const isEnsInput = walletOrEns?.endsWith?.(".eth");
  const isAddressInput = /^0x[a-fA-F0-9]{40}$/.test(walletOrEns || "");
  const identities = (profile && profile.identities) || [];

  // ---------------------------------------------
  // 1. Identify ENS and Basenames separately
  // ---------------------------------------------
  let ensName = null;
  let bnsName = null;

  for (const ident of identities) {
    const platform = (ident.platform || "").toLowerCase();
    const name = ident.id || ident.name || "";

    if (platform === "ens" && name.endsWith(".eth") && !name.endsWith(".base.eth")) {
      ensName = name;
    }

    if (platform === "basenames" && name.endsWith(".base.eth")) {
      bnsName = name;
    }
  }

  // ---------------------------------------------
  // 2. ENS Reverse Lookup (only for true ENS)
  // ---------------------------------------------
  let resolvedEnsName = ensName;

  if (!resolvedEnsName && !isEnsInput && isAddressInput) {
    const key = walletOrEns.toLowerCase();
    const cached = ensCache.get(key);
    const now = Date.now();

    if (cached) {
      const ttl = cached.name ? ENS_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      if (now - cached.ts < ttl) resolvedEnsName = cached.name;
    }

    if (!resolvedEnsName && !cached) {
      const promise =
        ensInFlight.get(key) ||
        (async () => {
          let backoff = 200;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const provider = attempt === 0 ? getEthereumProvider() : rotateEthereumProvider();
              const name = await provider.lookupAddress(walletOrEns);
              ensCache.set(key, { name, ts: Date.now() });
              return name;
            } catch (_) {
              await new Promise(r => setTimeout(r, backoff));
              backoff *= 2;
            }
          }
          ensCache.set(key, { name: null, ts: Date.now() });
          return null;
        })();

      ensInFlight.set(key, promise);
      resolvedEnsName = await promise;
      ensInFlight.delete(key);
    }
  }

  if (!ensName && resolvedEnsName) ensName = resolvedEnsName;

  // ---------------------------------------------
  // 3. MEM data
  // ---------------------------------------------
  // ---------------------------------------------
  console.log('gatherLegitimacyInputs: fetching MEM balance for', walletOrEns);
  let memBalance;
  try {
    memBalance = await fetchMemBalance(walletOrEns);
    console.log('gatherLegitimacyInputs: MEM balance result for', walletOrEns, memBalance);
  } catch (err) {
    console.warn('gatherLegitimacyInputs: fetchMemBalance threw for', walletOrEns, err && err.message ? err.message : err);
    memBalance = null;
  }

  const onchainData = {
    balance: memBalance || 0,
    claims: [],
    avgClaim: 0,
  };
  // 4. Wallet activity
  // ---------------------------------------------
  const walletAge = await fetchWalletAge(walletOrEns);
  const activity = await fetchWalletActivity(walletOrEns);
  const walletHistory = await fetchWalletHistory(walletOrEns);

  // ---------------------------------------------
  // 5. ENS metadata (Basenames have no API)
  // ---------------------------------------------
  const ensData = ensName ? await fetchEnsMetadata(ensName) : null;

  // ---------------------------------------------
  // 6. Identity scoring components
  // ---------------------------------------------
  const identityConsistency = computeIdentityConsistency(identities);
  const followerQuality = computeFollowerQuality(identities);
  const overlap = computeSocialOverlap(identities);

  // Social graph summary (platform presences, follower buckets, suggestions)
  let socialGraph = null;
  try {
    socialGraph = await fetchSocialGraph(identities || []);
  } catch (err) {
    console.warn('gatherLegitimacyInputs: fetchSocialGraph error', err && err.message ? err.message : err);
    socialGraph = null;
  }

  // ---------------------------------------------
  // 7. Wallet links (soft links from Memory identities)
  // ---------------------------------------------
  let walletGraph = null;
  try {
    walletGraph = await fetchWalletLinks(walletOrEns);
  } catch (err) {
    console.warn('gatherLegitimacyInputs: fetchWalletLinks error', err && err.message ? err.message : err);
    walletGraph = null;
  }

  // ---------------------------------------------
  // 8. Return all scoring inputs (include walletGraph)
  // ---------------------------------------------
  let suggestions = null;
  try {
    suggestions = buildSuggestions({ identities, walletGraph, walletHistory, scores: null });
  } catch (err) {
    console.warn('gatherLegitimacyInputs: buildSuggestions error', err && err.message ? err.message : err);
    suggestions = null;
  }
  return {
    identities,
    profile,
    onchainData,
    // Top-level aliases for schema alignment
    walletAge: walletAge?.ageDays || 0,
    walletActivity: {
      ageDays: walletAge?.ageDays || 0,
      txCount: activity.txCount,
      gasSpent: activity.gasSpent,
      // historySummary: API-derived summary (recent counts, top contracts, cadence)
      historySummary: walletHistory || null,
    },
    // Convenience alias matching proposed schema (optional)
    walletHistorySummary: walletHistory || null,
    ensName,
    ensData,
    bnsName,
    followerQuality,
    externalReputation: null,
    mutualOverlap: overlap.overlapScore,
    walletGraph,
    suggestions,
    socialGraph,
    // Surface locally stored proofs (optional, may be empty)
    proofs: (() => {
      try { return vault.listProofs(); } catch (_) { return []; }
    })(),
    ...identityConsistency,
  };
}
