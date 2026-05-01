// api/memory.js
// Identity profile is now built from Farcaster + ENS + Basenames via identityAggregator.
// fetchMemoryApiClaims is kept (returns []) in case callers are updated later.

import { ethers } from "ethers";
import { buildIdentityProfile, invalidateAggregatorCache } from "./identityAggregator.js";

export function invalidateMemoryCache(key = null) {
  invalidateAggregatorCache(key);
}

export async function getMemoryProfile(walletOrENS, options = {}) {
  if (!walletOrENS) {
    return { wallet: walletOrENS, identities: [], total: 0, verified: 0 };
  }

  const addrRe = /^0x[a-fA-F0-9]{40}$/;
  const ensRe = /^[^\s@\/]+\.eth$/i;
  if (!(addrRe.test(walletOrENS) || ensRe.test(walletOrENS))) {
    return { wallet: walletOrENS, identities: [], total: 0, verified: 0 };
  }

  return buildIdentityProfile(walletOrENS);
}

// Memory Protocol claims API is down — kept as a no-op stub.
export async function fetchMemoryApiClaims(address, options = {}) {
  void address;
  void options;
  return [];
}
