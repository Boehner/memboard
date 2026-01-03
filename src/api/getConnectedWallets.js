// api/getConnectedWallets.js
//
// Returns a set of "peer" wallets for a user, based primarily on
// the follower graph, but excluding the user's own identity cluster.

import { getMemoryProfile } from "./memory";
import { getFollowerGraph } from "./socialGraph";

function norm(v) {
  return v ? String(v).trim().toLowerCase() : null;
}

export async function getConnectedWallets(walletOrEns, profileArg = null) {
  const profile = profileArg || (await getMemoryProfile(walletOrEns));
  const selfIds = new Set();

  const root = norm(walletOrEns);
  if (root) selfIds.add(root);

  // Collect all identifiers that belong to THIS user
  (profile.identities || []).forEach((ident) => {
    const w = norm(ident.wallet || ident.address);
    const id = norm(ident.id);
    const u = norm(ident.username || ident.handle);

    if (w) selfIds.add(w);
    if (id) selfIds.add(id);
    if (u) selfIds.add(u);
  });

  // Get follower graph peers (reuse profile to avoid extra fetch)
  const graph = await getFollowerGraph(walletOrEns, profile);

  const peers = new Set();

  graph.peerWallets.forEach((w) => {
    const key = norm(w);
    if (key && !selfIds.has(key)) {
      peers.add(key);
    }
  });

  // Fallback: if graph is empty, just return empty list.
  // (You can later add other discovery sources here.)
  return [...peers];
}
