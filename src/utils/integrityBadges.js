// utils/integrityBadges.js

export function computeIntegrityBadges(breakdown = {}) {
  const meta = breakdown.meta || {};
  const badges = [];

  // -------------------------------
  // IDENTITY BADGES
  // -------------------------------
  if ((meta.handleConsistency ?? 0) >= 0.75) {
    badges.push({
      id: "consistent-identity",
      label: "Consistent Identity",
      description: "Your usernames and profiles line up across platforms.",
      color: "from-purple-400 to-purple-600",
    });
  }

  if ((meta.pfpConsistency ?? 0) >= 0.7) {
    badges.push({
      id: "pfp-match",
      label: "PFP Match",
      description: "You use the same profile photo across multiple accounts.",
      color: "from-pink-400 to-fuchsia-500",
    });
  }

  if ((meta.platformCountRaw ?? 0) >= 6) {
    badges.push({
      id: "multi-platform",
      label: "Cross-Platform Presence",
      description: "You are active on multiple connected platforms.",
      color: "from-blue-300 to-cyan-400",
    });
  }

  // -------------------------------
  // WALLET BADGES
  // -------------------------------
  if ((meta.walletAgeDays ?? 0) >= 730) {
    badges.push({
      id: "wallet-veteran",
      label: "On-Chain Veteran",
      description: "Your wallet has over 2 years of on-chain history.",
      color: "from-green-400 to-emerald-500",
    });
  }

  if ((meta.walletTxCount ?? 0) >= 150) {
    badges.push({
      id: "active-wallet",
      label: "Active Wallet",
      description: "Your wallet demonstrates ongoing, real usage.",
      color: "from-lime-400 to-green-500",
    });
  }

  // -------------------------------
  // SOCIAL BADGES
  // -------------------------------
  if ((meta.avgFollowers ?? 0) >= 5000) {
    badges.push({
      id: "social-reach",
      label: "High Social Reach",
      description: "You have a strong following across your social graph.",
      color: "from-yellow-300 to-yellow-500",
    });
  }

  if ((meta.followerQuality ?? 0) >= 0.85) {
    badges.push({
      id: "real-audience",
      label: "Real Audience",
      description: "Your followers appear to be mostly real users.",
      color: "from-emerald-300 to-green-400",
    });
  }

  // -------------------------------
  // ENS BADGES
  // -------------------------------
  if ((meta.ensAgeDays ?? 0) >= 365) {
    badges.push({
      id: "ens-holder",
      label: "ENS Veteran",
      description: "Your ENS name has long-term history.",
      color: "from-indigo-300 to-indigo-500",
    });
  }

  if (meta.hasBasename) {
    badges.push({
      id: "basename-user",
      label: "Basename User",
      description: "You’re part of the Base naming ecosystem.",
      color: "from-sky-300 to-blue-400",
    });
  }

  // -------------------------------
  // MEM BADGES
  // -------------------------------
  if ((meta.claimsCount ?? 0) >= 5) {
    badges.push({
      id: "mem-claimant",
      label: "Active MEM User",
      description: "You've claimed MEM rewards multiple times.",
      color: "from-amber-400 to-orange-500",
    });
  }

  if ((meta.memBalance ?? 0) >= 3000) {
    badges.push({
      id: "mem-holder",
      label: "MEM Holder",
      description: "You maintain a meaningful on-chain MEM balance.",
      color: "from-orange-300 to-red-400",
    });
  }

  // -------------------------------
  // OVERLAP BADGE
  // -------------------------------
  if ((meta.overlapScore ?? 0) >= 0.6) {
    badges.push({
      id: "identity-linked",
      label: "Linked Profiles",
      description: "Your profiles reinforce the same identity across platforms.",
      color: "from-cyan-300 to-teal-400",
    });
  }

  return badges;
}
