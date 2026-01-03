// api/sharedCreators.js
//
// Shared creators / artists / authors signal
// -----------------------------------------
// Goal: extract a normalized set of "creator IDs" that a wallet follows or
// interacts with across platforms (Zora, Farcaster, Lens, Sound, Catalog, etc).

import { getMemoryProfile } from "./memory";

// Normalize any identifier (handle, contract, id, url) into a string key
function normalizeId(v) {
  if (!v) return null;
  return String(v).trim().toLowerCase();
}

// Heuristic extractor per identity – plug real fields here as you discover them.
function extractCreatorsFromIdentity(ident) {
  const creators = new Set();
  const platform = (ident.platform || "").toLowerCase();

  // 1) Direct "following creators" style fields
  // e.g. Memory may expose: ident.creators, ident.followingCreators, etc.
  const directCreators =
    ident.creators ||
    ident.followingCreators ||
    ident.favoriteCreators ||
    [];

  if (Array.isArray(directCreators)) {
    directCreators.forEach((c) => {
      const id =
        normalizeId(c.id) ||
        normalizeId(c.handle) ||
        normalizeId(c.contract) ||
        normalizeId(c.address) ||
        normalizeId(c);
      if (id) creators.add(id);
    });
  }

  // 2) Generic "following" arrays on social platforms
  // Structure is intentionally loose; adapt as needed.
  const following = ident.following || ident.social?.following || [];
  if (Array.isArray(following)) {
    following.forEach((f) => {
      const id =
        normalizeId(f.creatorId) ||
        normalizeId(f.handle) ||
        normalizeId(f.username) ||
        normalizeId(f.id) ||
        normalizeId(f);
      if (id) creators.add(id);
    });
  }

  // 3) Minted / collected creators (Zora, Sound, Catalog etc.)
  const mints = ident.mints || ident.collects || ident.nfts || [];
  if (Array.isArray(mints)) {
    mints.forEach((m) => {
      const creator =
        normalizeId(m.creator) ||
        normalizeId(m.creatorAddress) ||
        normalizeId(m.artist) ||
        normalizeId(m.contractAddress);
      if (creator) creators.add(creator);
    });
  }

  // 4) Platform-specific hints (optional tweaks)
  if (platform === "zora" || platform === "sound" || platform === "catalog") {
    // If the identity itself *is* a creator, consider its own id as a creator
    const selfId =
      normalizeId(ident.id) ||
      normalizeId(ident.handle) ||
      normalizeId(ident.username);
    if (selfId) creators.add(selfId);
  }

  return creators;
}

/**
 * Returns { set, list } for all creators associated with a wallet/ENS.
 */
export async function getCreatorSet(walletOrEns, profileArg = null) {
  const profile = profileArg || (await getMemoryProfile(walletOrEns));
  const creators = new Set();

  (profile.identities || []).forEach((ident) => {
    const cset = extractCreatorsFromIdentity(ident);
    cset.forEach((c) => creators.add(c));
  });

  return {
    set: creators,
    list: [...creators],
  };
}

/**
 * Compute creator overlap [0–1] & intersection list between two wallets.
 */
export async function computeCreatorOverlap(walletA, walletB, profileA = null, profileB = null) {
  const [A, B] = await Promise.all([
    getCreatorSet(walletA, profileA),
    getCreatorSet(walletB, profileB),
  ]);

  const shared = A.list.filter((id) => B.set.has(id));
  const unionSize = new Set([...A.list, ...B.list]).size;
  const overlapScore = unionSize > 0 ? shared.length / unionSize : 0;

  return {
    overlapScore,
    sharedCreators: shared,
    creatorsA: A.list,
    creatorsB: B.list,
  };
}
