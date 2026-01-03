// api/matching.js
//
// Wallet-Based Social Matching Engine with:
//  - Identity similarity
//  - Platform + username similarity
//  - Follower graph similarity
//  - Shared creators + Zora collections
//  - On-chain behavior + shared tx contracts
//  - MEM behavior
//  - ENS similarity
//  - Engagement similarity
//  - Farcaster graph similarity

import { gatherLegitimacyInputs } from "./scoreServices";
import { computeEngagementRank } from "../utils/computeEngagementRank";
import { explainLegitimacyScore } from "../utils/computeLegitimacyScore";

import { computeCreatorOverlap } from "./sharedCreators";
import { computeFollowerGraphOverlap } from "./socialGraph";
import { computeZoraOverlap } from "./zoraCollectors";
import { computeTxGraphOverlap } from "./txGraph";
import { getFarcasterGraph } from "./farcaster";
import { generateMatchExplanation } from "./matchExplain";

function clamp01(v) {
  return Math.max(0, Math.min(1, v || 0));
}

function cosine(a, b) {
  if (!a || !b) return 0;
  let dot = 0,
    ma = 0,
    mb = 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    dot += av * bv;
    ma += av * av;
    mb += bv * bv;
  }
  if (!ma || !mb) return 0;
  return clamp01(dot / Math.sqrt(ma * mb));
}

function setOverlap(a, b) {
  if (!a.size || !b.size) return 0;
  const inter = new Set([...a].filter((x) => b.has(x)));
  return clamp01(inter.size / Math.max(a.size, b.size));
}

// You can tweak these; they roughly sum to 1.0
const MATCH_WEIGHTS = {
  identity: 0.18,
  platforms: 0.07,
  usernames: 0.04,
  followers: 0.13,
  creators: 0.17,
  onchain: 0.15,
  mem: 0.07,
  ens: 0.04,
  engagement: 0.07,
  farcaster: 0.08,
};

export async function matchWallets(walletA, walletB, profileA = null, profileB = null) {
  const [
    A,
    B,
    creatorInfo,
    followerGraph,
    zoraInfo,
    txInfo,
    fcA,
    fcB,
  ] = await Promise.all([
    gatherLegitimacyInputs(walletA, profileA),
    gatherLegitimacyInputs(walletB, profileB),
    computeCreatorOverlap(walletA, walletB, profileA, profileB),
    computeFollowerGraphOverlap(walletA, walletB, profileA, profileB),
    computeZoraOverlap(walletA, walletB, profileA, profileB),
    computeTxGraphOverlap(walletA, walletB, { maxTx: 200 }),
    getFarcasterGraph(walletA),
    getFarcasterGraph(walletB),
  ]);

  // Platforms
  const platformsA = new Set(
    A.identities.map((i) => i.platform?.toLowerCase()).filter(Boolean)
  );
  const platformsB = new Set(
    B.identities.map((i) => i.platform?.toLowerCase()).filter(Boolean)
  );
  const platformSimilarity = setOverlap(platformsA, platformsB);

  // Usernames
  const usernamesA = new Set(
    A.identities
      .map((i) => (i.username || i.handle || "").toLowerCase())
      .filter(Boolean)
  );
  const usernamesB = new Set(
    B.identities
      .map((i) => (i.username || i.handle || "").toLowerCase())
      .filter(Boolean)
  );
  const usernameOverlap = setOverlap(usernamesA, usernamesB);

  // Followers – counts based + graph overlap
  const followersA = A.identities
    .map((i) => i.social?.followers || 0)
    .filter((n) => n > 0);
  const followersB = B.identities
    .map((i) => i.social?.followers || 0)
    .filter((n) => n > 0);
  const followerCountSim = cosine(
    followersA.length ? followersA : [0],
    followersB.length ? followersB : [0]
  );
  const followerGraphSim = followerGraph.overlapScore || 0;
  const followerSim = clamp01(0.5 * followerCountSim + 0.5 * followerGraphSim);

  // Engagement similarity
  const engA = computeEngagementRank({
    identities: A.identities,
    onChain: A.onchainData,
  }).score;
  const engB = computeEngagementRank({
    identities: B.identities,
    onChain: B.onchainData,
  }).score;
  const engagementSimilarity = 1 - Math.abs(engA - engB) / 100;

  // On-chain wallet behavior + tx graph
  const onchainVectorA = [
    A.walletActivity.ageDays || 0,
    A.walletActivity.txCount || 0,
  ];
  const onchainVectorB = [
    B.walletActivity.ageDays || 0,
    B.walletActivity.txCount || 0,
  ];
  const onchainBehaviorSim = cosine(onchainVectorA, onchainVectorB);
  const txGraphSim = txInfo.overlapScore || 0;
  const onchainSimilarity = clamp01(
    0.5 * onchainBehaviorSim + 0.5 * txGraphSim
  );

  // MEM behavior
  const memVectorA = [
    A.onchainData.balance || 0,
    A.onchainData.claims?.length || 0,
  ];
  const memVectorB = [
    B.onchainData.balance || 0,
    B.onchainData.claims?.length || 0,
  ];
  const memSimilarity = cosine(memVectorA, memVectorB);

  // ENS similarity
  let ensSimilarity = 0;
  if (A.ensData && B.ensData) {
    const ensVecA = [A.ensData.renewalCount || 0, A.ensData.nameAgeDays || 0];
    const ensVecB = [B.ensData.renewalCount || 0, B.ensData.nameAgeDays || 0];
    ensSimilarity = cosine(ensVecA, ensVecB);
  }

  // Identity legitimacy similarity
  const legA = explainLegitimacyScore(A).score;
  const legB = explainLegitimacyScore(B).score;
  const identitySimilarity = 1 - Math.abs(legA - legB) / 100;

  // Creators + Zora collectors
  const creatorSimilarity = creatorInfo.overlapScore || 0;
  const zoraSim = zoraInfo.overlapScore || 0;
  const combinedCreatorSim = clamp01(
    0.6 * creatorSimilarity + 0.4 * zoraSim
  );

  // FARCASTER GRAPH SIMILARITY
  const fcOverlap = (() => {
    const Aset = new Set([
      ...(fcA?.followerWallets || []),
      ...(fcA?.followingWallets || []),
    ]);
    const Bset = new Set([
      ...(fcB?.followerWallets || []),
      ...(fcB?.followingWallets || []),
    ]);
    if (!Aset.size || !Bset.size) return 0;
    const shared = [...Aset].filter((w) => Bset.has(w));
    const union = new Set([...Aset, ...Bset]).size;
    return union > 0 ? shared.length / union : 0;
  })();

  const finalNorm =
    MATCH_WEIGHTS.identity * identitySimilarity +
    MATCH_WEIGHTS.platforms * platformSimilarity +
    MATCH_WEIGHTS.usernames * usernameOverlap +
    MATCH_WEIGHTS.followers * followerSim +
    MATCH_WEIGHTS.creators * combinedCreatorSim +
    MATCH_WEIGHTS.onchain * onchainSimilarity +
    MATCH_WEIGHTS.mem * memSimilarity +
    MATCH_WEIGHTS.ens * ensSimilarity +
    MATCH_WEIGHTS.engagement * engagementSimilarity +
    MATCH_WEIGHTS.farcaster * fcOverlap;

  const matchScore = Math.round(clamp01(finalNorm) * 100);

  // Shared Farcaster wallets for debug / UI
  const sharedFarcasterWallets = (() => {
    const Aset = new Set([
      ...(fcA?.followerWallets || []),
      ...(fcA?.followingWallets || []),
    ]);
    const Bset = new Set([
      ...(fcB?.followerWallets || []),
      ...(fcB?.followingWallets || []),
    ]);
    if (!Aset.size || !Bset.size) return [];
    return [...Aset].filter((w) => Bset.has(w));
  })();

  return {
    walletA,
    walletB,
    matchScore,
    breakdown: {
      identitySimilarity,
      platformSimilarity,
      usernameOverlap,
      followerSim,
      creatorSimilarity: combinedCreatorSim,
      onchainSimilarity,
      memSimilarity,
      ensSimilarity,
      engagementSimilarity,
      farcasterSimilarity: fcOverlap,
    },
    sharedCreators: creatorInfo.sharedCreators || [],
    sharedZoraCollections: zoraInfo.sharedCollections || [],
    sharedContracts: txInfo.sharedContracts || [],
    sharedFarcasterWallets,
    explanation,
    raw: { A, B },
  };
}
