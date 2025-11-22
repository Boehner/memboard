// api/scoreServices.js
import { getMemoryProfile } from "./memory";
import { fetchMemBalance, fetchAllMemClaims } from "./memRewards";
import { fetchWalletAge } from "./walletAge";
import { fetchWalletActivity } from "./walletActivity";
import { fetchEnsMetadata } from "./ens";
import { getEthereumProvider, rotateEthereumProvider } from "./provider";
import { computeFollowerQuality } from "./followerQuality";
import { computeIdentityConsistency } from "./identityConsistency";
import { computeSocialOverlap } from "./socialOverlap";

// Simple in-memory cache of ENS lookups with TTL + in-flight promise control.
// key: address(lowercase) -> { name: string|null, ts: number }
const ensCache = new Map();
const ensInFlight = new Map(); // key -> Promise<string|null>
const ENS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const NEGATIVE_CACHE_TTL_MS = 2 * 60 * 1000; // shorter TTL for negative results

export async function gatherLegitimacyInputs(walletOrEns) {
  const isEnsInput = walletOrEns?.endsWith?.(".eth");
  const isAddressInput = /^0x[a-fA-F0-9]{40}$/.test(walletOrEns || "");

  // Fetch profile first so we can inspect identities for existing ENS/Base names.
  const profile = await getMemoryProfile(walletOrEns);
  const identities = profile.identities;

  let identityEnsName = null;
  for (const ident of identities) {
    const platform = (ident.platform || '').toLowerCase();
    const nameCandidate = ident.id || ident.name || '';
    if (platform === 'ens' && nameCandidate.endsWith('.eth')) {
      identityEnsName = nameCandidate;
      break;
    }
    if (platform === 'basenames' && nameCandidate.endsWith('.eth')) {
      identityEnsName = nameCandidate; // treat as display only; skip ENS subgraph fetch
      break;
    }
  }

  let resolvedEnsName = null;
  if (!identityEnsName && !isEnsInput && isAddressInput) {
    const addrKey = walletOrEns.toLowerCase();
    const cached = ensCache.get(addrKey);
    const now = Date.now();
    if (cached) {
      const age = now - cached.ts;
      const ttl = cached.name ? ENS_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      if (age < ttl) {
        resolvedEnsName = cached.name;
      }
    }
    if (resolvedEnsName === null && !cached) {
      if (ensInFlight.has(addrKey)) {
        resolvedEnsName = await ensInFlight.get(addrKey);
      } else {
        const promise = (async () => {
          const MAX_ATTEMPTS = 3;
          let backoff = 300;
          for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
              const ethProvider = attempt === 0 ? getEthereumProvider() : rotateEthereumProvider();
              const name = await ethProvider.lookupAddress(walletOrEns);
              ensCache.set(addrKey, { name: name || null, ts: Date.now() });
              return name || null;
            } catch (err) {
              const msg = String(err.message || '').toLowerCase();
              const isRateLimited = msg.includes('429') || msg.includes('rate') || msg.includes('too many');
              console.warn(`ENS lookup attempt ${attempt + 1} failed`, err.message);
              if (!isRateLimited) {
                ensCache.set(addrKey, { name: null, ts: Date.now() });
                return null;
              }
              if (attempt === MAX_ATTEMPTS - 1) {
                ensCache.set(addrKey, { name: null, ts: Date.now() });
                return null;
              }
              await new Promise(r => setTimeout(r, backoff));
              backoff *= 2;
            }
          }
          return null;
        })();
        ensInFlight.set(addrKey, promise);
        resolvedEnsName = await promise;
        ensInFlight.delete(addrKey);
      }
    }
  }

  const ensNameToUse = identityEnsName || (isEnsInput ? walletOrEns : resolvedEnsName);

  const memBalance = await fetchMemBalance(walletOrEns);
  const claims = await fetchAllMemClaims(walletOrEns);
  const onchainData = {
    balance: memBalance || 0,
    claims,
    avgClaim: claims.reduce((a, c) => a + c.amount, 0) / Math.max(claims.length, 1),
  };

  const walletAge = await fetchWalletAge(walletOrEns);
  console.log('Fetched wallet age for legitimacy inputs:', walletAge);
  const activity = await fetchWalletActivity(walletOrEns);

  let ensData = null;
  if (ensNameToUse && identityEnsName && identityEnsName.endsWith('.base.eth')) {
    ensData = null; // skip ENS subgraph for basenames
  } else if (ensNameToUse) {
    ensData = await fetchEnsMetadata(ensNameToUse);
    console.log('Fetched ENS data for legitimacy inputs:', ensData);
  }

  const followerQuality = computeFollowerQuality(identities);
  const identityConsistency = computeIdentityConsistency(identities);
  const overlap = computeSocialOverlap(identities);
console.log('scoreServices gatherLegitimacyInputs:', {
    identities,
    profile,
    onchainData,
    walletActivity: {
      ageDays: walletAge?.ageDays || 0,
      txCount: activity.txCount,
      gasSpent: activity.gasSpent,
    },
    ensData,
    ensName: ensNameToUse || null,
    followerQuality,
    externalReputation: null,
    mutualOverlap: overlap.overlapScore,
    ...identityConsistency,
  });
  return {
    identities,
    profile,
    onchainData,
    walletActivity: {
      ageDays: walletAge?.ageDays || 0,
      txCount: activity.txCount,
      gasSpent: activity.gasSpent,
    },
    ensData,
    ensName: ensNameToUse || null,
    followerQuality,
    externalReputation: null,
    mutualOverlap: overlap.overlapScore,
    ...identityConsistency,
  };
}
