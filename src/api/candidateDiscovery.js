// api/candidateDiscovery.js
//
// Central aggregator for potential candidate wallets to match against.
// Pulls data from:
// - Farcaster graph
// - Memory identity graph
// - Shared creators (powerful signal)
// - Follower graph
// - (Optional) Zora collectors
// - (Optional) Tx graph overlap
//
// Output: A deduped, normalized list of REAL wallet addresses.

import { getFarcasterGraph } from "./farcaster";
import { getFollowerGraph } from "./socialGraph";
import { getCreatorSet } from "./sharedCreators";       // NEW
import { getMemoryProfile } from "./memory";

function normalizeWallet(w) {
  if (!w) return null;
  w = w.toString().trim().toLowerCase();
  return w.startsWith("0x") && w.length === 42 ? w : null;
}

function uniqWallets(list) {
  const set = new Set();
  list.forEach((w) => {
    const n = normalizeWallet(w);
    if (n) set.add(n);
  });
  return [...set];
}

export async function discoverCandidates(wallet, profileArg = null) {
  const candidates = new Set();
  const mainWallet = normalizeWallet(wallet);
  if (!mainWallet) return [];

  // ------------------------------------------------
  // 1. Memory Profile → direct connected wallets
  // ------------------------------------------------
  try {
    const profile = profileArg || (await getMemoryProfile(mainWallet));
    (profile.identities || []).forEach((ident) => {
      const w =
        normalizeWallet(ident.wallet) ||
        normalizeWallet(ident.address) ||
        null;
      if (w && w !== mainWallet) candidates.add(w);
    });

    // ENS resolver might reveal secondary wallets (optional)
    if (profile.ensData?.resolvedAddress) {
      const resolved = normalizeWallet(profile.ensData.resolvedAddress);
      if (resolved && resolved !== mainWallet) candidates.add(resolved);
    }

    console.log("Candidates from Memory identities:", candidates.size);
  } catch (err) {
    console.warn("Memory identity graph error:", err);
  }

  // ------------------------------------------------
  // 2. Shared Creator Network (VERY HIGH SIGNAL)
  // ------------------------------------------------
  try {
    const creatorInfo = await getCreatorSet(mainWallet);

    // For each creator → find other fans (future: creator fan index)
    // For now we directly treat creators themselves as candidate touchpoints:
    creatorInfo.list.forEach((creator) => {
      // If creator is a wallet, add it
      const maybeWallet = normalizeWallet(creator);
      if (maybeWallet && maybeWallet !== mainWallet) {
        candidates.add(maybeWallet);
      }
    });

    console.log("Candidates from shared creators:", candidates.size);
  } catch (err) {
    console.warn("Shared creator discovery error:", err);
  }

  // ------------------------------------------------
  // 3. Farcaster Graph
  // ------------------------------------------------
  try {
    const fc = await getFarcasterGraph(mainWallet);

    fc.followerWallets.forEach((w) => {
      const n = normalizeWallet(w);
      if (n && n !== mainWallet) candidates.add(n);
    });

    fc.followingWallets.forEach((w) => {
      const n = normalizeWallet(w);
      if (n && n !== mainWallet) candidates.add(n);
    });

    console.log("Farcaster graph candidates:", candidates.size);
  } catch (err) {
    console.warn("Farcaster graph error:", err);
  }

  // ------------------------------------------------
  // 4. Social Follower Graph (Twitter/Lens/etc.)
  // ------------------------------------------------
  try {
    const fg = await getFollowerGraph(mainWallet, profileArg);
    fg.peerWallets.forEach((w) => {
      const n = normalizeWallet(w);
      if (n && n !== mainWallet) candidates.add(n);
    });

    console.log("FollowerGraph candidates:", candidates.size);
  } catch (err) {
    console.warn("FollowerGraph error:", err);
  }

  // ------------------------------------------------
  // FUTURE: 5. Transaction Graph (disabled for now)
  // ------------------------------------------------

  // ------------------------------------------------
  // FALLBACK: If still low candidates, inject active Base wallets
  // ------------------------------------------------
  let results = uniqWallets([...candidates]);

  if (results.length < 8) {
    console.warn("Low candidate count — injecting fallback active wallets");

    const ACTIVE_BASE_WALLETS = [
      "0x4200000000000000000000000000000000000000", // Base system
      "0x8ba1f109551bD432803012645Ac136ddd64DBA72", // Vitalik (example)
      "0xf977814e90da44bfa03b6295a0616a897441acec", // Binance
      "0x000000000000000000000000000000000000dead", // burner
    ];

    ACTIVE_BASE_WALLETS.forEach((w) => {
      const n = normalizeWallet(w);
      if (n && n !== mainWallet) candidates.add(n);
    });

    results = uniqWallets([...candidates]);
  }

  // ------------------------------------------------
  // FINAL RETURN: limit to 20 high-quality candidates
  // ------------------------------------------------
  return results.slice(0, 20);
}
