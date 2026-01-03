// api/zoraCollectors.js
//
// Zora collector graph utilities.
// Extracts Zora collections / contracts / creators a wallet has collected.

import { getMemoryProfile } from "./memory";

function norm(v) {
  return v ? String(v).trim().toLowerCase() : null;
}

function extractZoraCollectionsFromIdentity(ident) {
  const set = new Set();
  const platform = (ident.platform || "").toLowerCase();

  if (platform !== "zora" && platform !== "zorb" && platform !== "nft") {
    // Still check generic NFT fields
    // but platform-specific handling is preferred.
  }

  const mints = ident.mints || ident.collects || ident.nfts || [];
  mints.forEach((m) => {
    if (!m) return;
    const id =
      norm(m.collectionAddress) ||
      norm(m.contractAddress) ||
      norm(m.creator) ||
      norm(m.projectId);
    if (id) set.add(id);
  });

  return set;
}

export async function getZoraCollectionSet(walletOrEns, profileArg = null) {
  const profile = profileArg || (await getMemoryProfile(walletOrEns));
  const collections = new Set();

  (profile.identities || []).forEach((ident) => {
    const set = extractZoraCollectionsFromIdentity(ident);
    set.forEach((c) => collections.add(c));
  });

  return {
    set: collections,
    list: [...collections],
  };
}

export async function computeZoraOverlap(walletA, walletB, profileA = null, profileB = null) {
  const [A, B] = await Promise.all([
    getZoraCollectionSet(walletA, profileA),
    getZoraCollectionSet(walletB, profileB),
  ]);

  if (!A.list.length || !B.list.length) {
    return { overlapScore: 0, sharedCollections: [] };
  }

  const shared = A.list.filter((id) => B.set.has(id));
  const unionSize = new Set([...A.list, ...B.list]).size;
  const overlapScore = unionSize > 0 ? shared.length / unionSize : 0;

  return {
    overlapScore,
    sharedCollections: shared,
  };
}
