// api/socialGraph.js
//
// Real follower graph utilities.
// Uses Memory profile identities and any attached follower / following lists
// to build a set of social graph peers and compute overlap between wallets.

import { getMemoryProfile } from "./memory";

function norm(v) {
  return v ? String(v).trim().toLowerCase() : null;
}

function extractIds(list = []) {
  const out = new Set();
  list.forEach((item) => {
    if (!item) return;

    if (typeof item === "string") {
      const id = norm(item);
      if (id) out.add(id);
      return;
    }

    const id =
      norm(item.wallet) ||
      norm(item.address) ||
      norm(item.id) ||
      norm(item.username) ||
      norm(item.handle);
    if (id) out.add(id);
  });
  return out;
}

/**
 * Build follower / following ID sets + peer wallet candidates for a wallet.
 */
export async function getFollowerGraph(walletOrEns, profileArg = null) {
  const profile = profileArg || (await getMemoryProfile(walletOrEns));

  const followerIds = new Set();
  const followingIds = new Set();
  const peerWallets = new Set();

  (profile.identities || []).forEach((ident) => {
    const social = ident.social || {};
    const followersList = social.followersList || [];
    const followingList = social.followingList || [];

    const fSet = extractIds(followersList);
    const gSet = extractIds(followingList);

    fSet.forEach((id) => followerIds.add(id));
    gSet.forEach((id) => followingIds.add(id));

    // any explicit wallet/addr fields become peer wallet candidates
    followersList.forEach((item) => {
      const w = norm(item.wallet || item.address);
      if (w) peerWallets.add(w);
    });
    followingList.forEach((item) => {
      const w = norm(item.wallet || item.address);
      if (w) peerWallets.add(w);
    });
  });

  return {
    followerIds,
    followingIds,
    peerWallets,
  };
}

/**
 * Follower graph overlap between two wallets (0–1).
 * We treat the graph as the union of followerIds + followingIds for each.
 */
export async function computeFollowerGraphOverlap(walletA, walletB, profileA = null, profileB = null) {
  const [A, B] = await Promise.all([
    getFollowerGraph(walletA, profileA),
    getFollowerGraph(walletB, profileB),
  ]);

  const setA = new Set([...A.followerIds, ...A.followingIds]);
  const setB = new Set([...B.followerIds, ...B.followingIds]);

  if (!setA.size || !setB.size) {
    return { overlapScore: 0, sharedIds: [] };
  }

  const shared = [...setA].filter((id) => setB.has(id));
  const unionSize = new Set([...setA, ...setB]).size;
  const overlapScore = unionSize > 0 ? shared.length / unionSize : 0;

  return {
    overlapScore,
    sharedIds: shared,
  };
}
