// api/identityAggregator.js
// Builds the identities[] profile from working free sources:
//   - Farcaster + Twitter/X + GitHub via Neynar (VITE_NEYNAR_API_KEY)
//     or Farcaster-only via hub.pinata.cloud fallback (no key)
//   - Lens Protocol (free GraphQL, no key)
//   - ENS reverse lookup
//   - Basenames (.base.eth via Base chain)

import { ethers } from "ethers";
import { getEthereumProvider } from "./provider.js";

const ENV = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const NEYNAR_API_KEY = ENV.VITE_NEYNAR_API_KEY || "";

const _cache = new Map();
const TTL_MS = 5 * 60 * 1000;

export function invalidateAggregatorCache(key = null) {
  if (key) _cache.delete(String(key).toLowerCase());
  else _cache.clear();
}

export async function buildIdentityProfile(walletOrENS) {
  if (!walletOrENS) return emptyProfile(walletOrENS);

  let address = walletOrENS;
  if (typeof walletOrENS === "string" && walletOrENS.endsWith(".eth")) {
    try {
      const resolved = await getEthereumProvider().resolveName(walletOrENS);
      if (!resolved) return emptyProfile(walletOrENS);
      address = resolved;
    } catch {
      return emptyProfile(walletOrENS);
    }
  }

  const key = address.toLowerCase();
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

  const results = await Promise.allSettled([
    fetchFarcasterAndSocials(address),  // may return array [farcaster, twitter, github]
    fetchLensIdentity(address),
    fetchEnsIdentity(address),
    fetchBasenameIdentity(address),
  ]);

  const identities = results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value].flat() : []))
    .filter(Boolean);

  const profile = {
    wallet: address,
    identities,
    total: identities.length,
    verified: identities.filter((i) => i.verified).length,
  };

  _cache.set(key, { data: profile, ts: Date.now() });
  return profile;
}

function emptyProfile(wallet) {
  return { wallet, identities: [], total: 0, verified: 0 };
}

// ---------------------------------------------------------------------------
// Farcaster + Twitter/X + GitHub (all via Neynar's verified_accounts)
// ---------------------------------------------------------------------------
async function fetchFarcasterAndSocials(address) {
  if (!NEYNAR_API_KEY) return [];
  const results = await fetchViaNeynar(address);
  return results || [];
}

async function fetchViaNeynar(address) {
  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { api_key: NEYNAR_API_KEY, accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const users = data?.[address.toLowerCase()] || data?.[address] || [];
    if (!users.length) return null;

    const u = users[0];
    const identities = [];

    // Farcaster
    identities.push({
      platform: "farcaster",
      username: u.username,
      id: String(u.fid),
      displayName: u.display_name,
      avatar: u.pfp_url,
      social: {
        followers: u.follower_count || 0,
        following: u.following_count || 0,
      },
      url: `https://warpcast.com/${u.username}`,
      verified: true,
    });

    // Twitter/X and GitHub come from verified_accounts if user linked them in Warpcast
    for (const acct of u.verified_accounts || []) {
      const platform = (acct.platform || "").toLowerCase();
      if (platform === "x" || platform === "twitter") {
        identities.push({
          platform: "twitter",
          username: acct.username,
          id: acct.username,
          displayName: acct.username,
          social: {},
          url: `https://x.com/${acct.username}`,
          verified: true,
        });
      } else if (platform === "github") {
        identities.push({
          platform: "github",
          username: acct.username,
          id: acct.username,
          displayName: acct.username,
          social: {},
          url: `https://github.com/${acct.username}`,
          verified: true,
        });
      }
    }

    return identities;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lens Protocol (free GraphQL, no API key needed)
// ---------------------------------------------------------------------------
const LENS_API = "https://api.lens.xyz/graphql";
const LENS_QUERY = `
  query DefaultProfile($address: EthereumAddress!) {
    defaultProfile(request: { for: $address }) {
      id
      handle { fullHandle localName }
      stats { followers following posts }
      metadata {
        displayName
        picture { ... on ImageSet { optimized { uri } } }
      }
    }
  }
`;

async function fetchLensIdentity(address) {
  try {
    const res = await fetch(LENS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: LENS_QUERY, variables: { address } }),
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    const profile = data?.defaultProfile;
    if (!profile) return null;

    const handle = profile.handle?.fullHandle || profile.handle?.localName || profile.id;
    const stats = profile.stats || {};

    return {
      platform: "lens",
      username: handle,
      id: profile.id,
      displayName: profile.metadata?.displayName || handle,
      avatar: profile.metadata?.picture?.optimized?.uri || null,
      social: {
        followers: stats.followers || 0,
        following: stats.following || 0,
        posts: stats.posts || 0,
      },
      url: `https://hey.xyz/u/${handle}`,
      verified: true,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ENS (Ethereum mainnet .eth names only)
// ---------------------------------------------------------------------------
async function fetchEnsIdentity(address) {
  try {
    const ensName = await getEthereumProvider().lookupAddress(address);
    if (!ensName || !ensName.endsWith(".eth") || ensName.endsWith(".base.eth")) return null;
    return {
      platform: "ens",
      username: ensName,
      id: ensName,
      social: {},
      url: `https://app.ens.domains/${ensName}`,
      verified: true,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Basenames (.base.eth via ENS resolver on Base chain)
// ---------------------------------------------------------------------------
async function fetchBasenameIdentity(address) {
  try {
    const baseProvider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const basename = await baseProvider.lookupAddress(address);
    if (!basename || !basename.endsWith(".base.eth")) return null;
    const shortName = basename.replace(".base.eth", "");
    return {
      platform: "basenames",
      username: basename,
      id: basename,
      social: {},
      url: `https://www.base.org/name/${shortName}`,
      verified: true,
    };
  } catch {
    return null;
  }
}
