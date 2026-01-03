// api/matchExplain.js
//
// Converts raw match breakdown + shared sets into a human-readable AI explanation.
// You can enhance this with GPT or your own LLM call.
// This version is fully local + deterministic.

export function generateMatchExplanation({ walletA, walletB, breakdown, sharedCreators, sharedZoraCollections, sharedContracts, sharedFarcasterWallets }) {
  const lines = [];

  // High-level summary
  const topReasons = [];

  if (breakdown.creatorSimilarity > 0.25 && sharedCreators?.length) {
    topReasons.push(`you share ${sharedCreators.length} creators`);
  }

  if (breakdown.followerSim > 0.2) {
    topReasons.push(`your social graphs overlap`);
  }

  if (breakdown.farcasterSimilarity > 0.15 && sharedFarcasterWallets?.length) {
    topReasons.push(`you both follow or are followed by ${sharedFarcasterWallets.length} similar Farcaster accounts`);
  }

  if (breakdown.onchainSimilarity > 0.2 && sharedContracts?.length) {
    topReasons.push(`you interact with similar smart contracts on Base`);
  }

  if (breakdown.identitySimilarity > 0.5) {
    topReasons.push(`your identity trust scores are very similar`);
  }

  const summary = topReasons.length
    ? `You and ${walletB.slice(0,6)}... share strong identity signals — ` +
      topReasons.join(", ") + "."
    : `You and ${walletB.slice(0,6)}... have moderate identity overlap.`;

  lines.push(summary);

  // Detailed reasons
  if (sharedCreators?.length) {
    lines.push(
      `• Shared creators: ${sharedCreators.slice(0,5).join(", ")}${sharedCreators.length > 5 ? "..." : ""}`
    );
  }

  if (sharedFarcasterWallets?.length) {
    lines.push(
      `• Shared Farcaster accounts: ${sharedFarcasterWallets.slice(0,5).join(", ")}${sharedFarcasterWallets.length > 5 ? "..." : ""}`
    );
  }

  if (sharedZoraCollections?.length) {
    lines.push(
      `• Both collected similar Zora projects: ${sharedZoraCollections.slice(0,5).join(", ")}${sharedZoraCollections.length > 5 ? "..." : ""}`
    );
  }

  if (sharedContracts?.length) {
    lines.push(
      `• Overlap in smart contract interactions: ${sharedContracts.slice(0,5).join(", ")}${sharedContracts.length > 5 ? "..." : ""}`
    );
  }

  // Fallback
  if (lines.length === 1) {
    lines.push("• Similar engagement, creator activity, and identity footprint.");
  }

  return lines.join("\n");
}
