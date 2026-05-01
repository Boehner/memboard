// api/identityAggregator.js
// Builds the identities[] profile from working free sources:
//   - Farcaster via Neynar (if VITE_NEYNAR_API_KEY set) or hub.pinata.cloud fallback
//   - ENS reverse lookup
//   - Basenames (Base chain ENS resolver)

import { ethers } from "ethers";
import { getEthereumProvider } from "./provider.js";
import { getFidFromAddress } from "./farcaster.js";

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

  // Resolve ENS input to address
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
    fetchFarcasterIdentity(address),
    fetchEnsIdentity(address),
    fetchBasenameIdentity(address),
  ]);

  const identities = results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
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
// Farcaster
// ---------------------------------------------------------------------------
async function fetchFarcasterIdentity(address) {
  if (NEYNAR_API_KEY) {
    const result = await fetchFarcasterViaNeynar(address);
    if (result) return result;
  }
  return fetchFarcasterViaHub(address);
}

async function fetchFarcasterViaNeynar(address) {
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
    return {
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
    };
  } catch {
    return null;
  }
}

async function fetchFarcasterViaHub(address) {
  try {
    const fid = await getFidFromAddress(address);
    if (!fid) return null;

    const res = await fetch(`https://hub.pinata.cloud/v1/userDataByFid?fid=${fid}`);
    if (!res.ok) return null;
    const data = await res.json();

    let username = null;
    let displayName = null;
    let pfpUrl = null;
    (data?.messages || []).forEach((msg) => {
      const ud = msg?.data?.userDataBody;
      if (!ud) return;
      if (ud.type === "USER_DATA_TYPE_USERNAME") username = ud.value;
      else if (ud.type === "USER_DATA_TYPE_DISPLAY") displayName = ud.value;
      else if (ud.type === "USER_DATA_TYPE_PFP") pfpUrl = ud.value;
    });

    return {
      platform: "farcaster",
      username: username || `fid:${fid}`,
      id: String(fid),
      displayName: displayName || username,
      avatar: pfpUrl,
      // Follower count unavailable without Neynar; neutral for scoring
      social: { followers: 0, following: 0 },
      url: username ? `https://warpcast.com/${username}` : null,
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
