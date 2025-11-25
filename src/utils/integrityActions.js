const DIMENSION_LABELS = {
  identity: "Identity Trust",
  wallet: "Wallet Authenticity",
  social: "Social Quality",
  ens: "ENS Credibility",
  memory: "MEM Activity",
  external: "External Reputation",
  overlap: "Cross-Platform Overlap",
};

export function getSeverity(normalized) {
  if (normalized >= 0.8) return "excellent";
  if (normalized >= 0.6) return "strong";
  if (normalized >= 0.45) return "moderate";
  if (normalized >= 0.25) return "weak";
  return "critical";
}

/**
 * Core engine
 * @param {{ score: number, breakdown: any }} params
 * @returns {Array<{
 *   key: string;
 *   label: string;
 *   severity: "excellent"|"strong"|"moderate"|"weak"|"critical";
 *   priority: number;            // higher = more important to fix
 *   normalized: number;          // 0-1
 *   weighted: number;            // contribution to final score (0-1)
 *   summary: string;
 *   actions: string[];
 * }>}
 */
export function buildIntegrityActions({ score, breakdown }) {
  if (!breakdown) return [];

  const meta = breakdown.meta || {};
  const dims = [
    "identity",
    "wallet",
    "social",
    "ens",
    "memory",
    "external",
    "overlap",
  ];

  const results = [];

  for (const key of dims) {
    const dim = breakdown[key];
    if (!dim || typeof dim.normalized !== "number") continue;

    const normalized = dim.normalized; // 0-1
    const weight = dim.weight ?? 0;    // 0-1
    const weighted = dim.weighted ?? normalized * weight;
    const severity = getSeverity(normalized);

    // How much integrity potential is left here?
    // 1 = totally missing; 0 = maxed.
    const gap = (1 - normalized) * weight;
    const label = DIMENSION_LABELS[key] || key;

    let summary = "";
    let actions = [];

    switch (key) {
      // --------------------------------------------------------
      // IDENTITY TRUST
      // --------------------------------------------------------
      case "identity": {
        const total = meta.totalIdentities ?? 0;
        const verified = meta.verifiedIdentities ?? 0;
        const platforms = meta.platformCountRaw ?? 0;

        // High level summary
        if (!total) {
          summary = "No connected identities. The system sees an address, not a person.";
        } else if (verified === total && platforms >= 5) {
          summary = "You have a fully verified identity across multiple platforms, but behavioral consistency can still improve.";
        } else if (verified === total) {
          summary = "All your connected identities are verified, but you're under-represented across platforms.";
        } else {
          summary = "You have some verified identities, but several signals are still weak or missing.";
        }

        // Concrete actions driven by meta + severity
        if (!total) {
          actions.push(
            "Connect at least 2-3 identities from reputable platforms (e.g., Twitter, Farcaster, GitHub).",
            "Prefer identities that you actively use and are publicly associated with you."
          );
        } else {
          if (verified < total) {
            actions.push(
              `Verify the remaining ${total - verified} unverified identities, or remove stale ones that don't represent you anymore.`
            );
          }

          if (platforms < 3) {
            actions.push(
              "Add identities on 1-2 more reputable platforms so your presence isn't concentrated in a single place."
            );
          } else if (platforms >= 3 && platforms < 6 && severity !== "excellent") {
            actions.push(
              "Strengthen your presence on your existing platforms (regular activity, profile completeness) instead of adding more low-signal accounts."
            );
          }

          // Even if we don’t have handle/pfp metrics here, we can still give a clear integrity nudge:
          if (severity === "weak" || severity === "critical") {
            actions.push(
              "Align your username and avatar across your connected platforms so it's obvious they belong to the same person."
            );
          }
        }

        // Fallback so we always say something
        if (!actions.length) {
          actions.push(
            "Maintain consistent usernames and avatars across platforms, and keep inactive or joke accounts disconnected from this wallet."
          );
        }
        break;
      }

      // --------------------------------------------------------
      // WALLET AUTHENTICITY
      // --------------------------------------------------------
      case "wallet": {
        const ageDays = meta.walletAgeDays ?? null;
        const txCount = meta.txCount ?? null; // only if you pipe it through later

        if (ageDays != null) {
          if (ageDays >= 730) {
            summary = "Your wallet has a long on-chain history, which is a strong integrity signal.";
          } else if (ageDays >= 365) {
            summary = "Your wallet is reasonably seasoned but still has room to mature.";
          } else {
            summary = "Your wallet is relatively young, so the system is still cautious about long-term behavior.";
          }
        } else {
          summary = "Wallet age is unknown, so the system can't fully trust its long-term history yet.";
        }

        if (ageDays != null && ageDays < 180) {
          actions.push(
            "Stick with this wallet over time instead of frequently switching; long-lived wallets are easier to trust."
          );
        }

        if (txCount != null) {
          if (txCount < 10) {
            actions.push(
              "Increase normal on-chain usage (swaps, mints, sends) with this wallet instead of spreading activity across many throwaway wallets."
            );
          } else if (txCount >= 10 && txCount < 50 && severity !== "excellent") {
            actions.push(
              "Continue using this wallet consistently; a larger history of ordinary transactions improves authenticity."
            );
          }
        } else if (severity !== "excellent") {
          actions.push(
            "Use this wallet for regular activity over time instead of creating new ones for every interaction."
          );
        }

        break;
      }

      // --------------------------------------------------------
      // SOCIAL QUALITY
      // --------------------------------------------------------
      case "social": {
        const avgFollowers = meta.avgFollowers ?? 0;

        if (avgFollowers === 0) {
          summary = "No social reach is visible for your connected identities.";
          actions.push(
            "Connect at least one social account where you actually interact with others (Twitter, Farcaster, Lens, etc.).",
            "Start building real conversations rather than focusing on raw follower counts."
          );
        } else {
          if (avgFollowers < 200) {
            summary = "You have a small but real audience. Integrity is fine; reach is limited.";
            actions.push(
              "Engage consistently with the followers you already have instead of chasing vanity metrics.",
              "Reply, quote, and collaborate with other real accounts to deepen your social graph."
            );
          } else if (avgFollowers < 5000) {
            summary = "You have a healthy social footprint, but it still looks mid-tier to the system.";
            actions.push(
              "Keep interactions organic: avoid sudden spikes from giveaways or low-quality followers.",
              "Show consistent activity across multiple weeks rather than short-lived bursts."
            );
          } else {
            summary = "You have strong reach. The main risk now is quality, not quantity.";
            actions.push(
              "Avoid inflating your audience with bots or follow-for-follow schemes - they reduce social integrity even if numbers go up.",
              "Maintain high-signal interactions: thoughtful posts, replies, and collabs with credible accounts."
            );
          }
        }

        break;
      }

      // --------------------------------------------------------
      // ENS CREDIBILITY
      // --------------------------------------------------------
      case "ens": {
        const ensAgeDays = meta.ensAgeDays ?? null;
        const hasBasename = !!meta.hasBasename;

        if (!ensAgeDays && !hasBasename) {
          summary = "No long-lived name is associated with this wallet.";
          actions.push(
            "Consider registering an ENS or Base name and actually using it (profile, dApps, social bios)."
          );
        } else if (ensAgeDays && ensAgeDays < 180) {
          summary = "Your ENS name is relatively new, so it hasn't built much historical trust yet.";
          actions.push(
            "Keep this name over time instead of rotating through many domains; stability improves credibility."
          );
        } else if (ensAgeDays && ensAgeDays >= 180) {
          summary = "You have a name with some history attached, which helps your on-chain identity feel less disposable.";
          actions.push(
            "Use this name consistently in your public profiles so others can recognize and verify you across contexts."
          );
        } else if (hasBasename) {
          summary = "You're using a basename, which gives you a recognizable on-chain identity.";
          actions.push(
            "Pair your basename with visible activity (social profiles, dApps) so it's clearly tied to a real person."
          );
        }

        break;
      }

      // --------------------------------------------------------
      // MEM ACTIVITY
      // --------------------------------------------------------
      case "memory": {
        const claims = meta.claimsCount ?? 0;
        const memBalance = meta.memBalance ?? 0;

        if (claims === 0 && memBalance === 0) {
          summary = "No visible participation in the MEM ecosystem yet.";
          actions.push(
            "Check if you’re eligible for any MEM rewards and make your first claim.",
            "Use the same wallet and identities when interacting with MEM so the protocol can reliably associate activity with you."
          );
        } else {
          if (claims > 0 && memBalance === 0) {
            summary = "You've interacted with MEM before, but you currently hold no MEM on this address.";
            actions.push(
              "If you're still active in the ecosystem, consider keeping a small MEM balance in this wallet to signal ongoing participation."
            );
          } else if (claims >= 5 || memBalance >= 100) {
            summary = "You have a meaningful history of MEM claims or holdings, which is a positive integrity signal.";
            if (severity !== "excellent") {
              actions.push(
                "Continue using the same wallet and identities when interacting with MEM to deepen that history.",
                "Avoid spreading MEM activity across many disposable wallets; concentration improves the clarity of your reputation."
              );
            }
          } else {
            summary = "You've started building a MEM history, but it still looks early compared to more established participants.";
            actions.push(
              "Claim new rewards when they're available instead of leaving them unclaimed.",
              "Engage with MEM-aligned apps or communities using the same wallet so your involvement looks consistent rather than one-off."
            );
          }
        }

        break;
      }

      // --------------------------------------------------------
      // EXTERNAL REPUTATION
      // --------------------------------------------------------
      case "external": {
        summary = "External reputation blends any off-platform or third-party trust signals the system is aware of.";

        if (severity === "excellent" || severity === "strong") {
          actions.push(
            "Maintain your existing relationships and contributions in external communities; abrupt changes in behavior can erode this quickly."
          );
        } else {
          actions.push(
            "Look for at least one external community (open source, DAOs, forums, or protocols) where you can contribute in a visible, ongoing way.",
            "Use the same identities and wallet so your contributions accumulate under a single, coherent persona."
          );
        }

        break;
      }

      // --------------------------------------------------------
      // CROSS-PLATFORM OVERLAP
      // --------------------------------------------------------
      case "overlap": {
        const platforms = meta.platformCountRaw ?? 0;

        if (platforms <= 1) {
          summary = "All of your signals are effectively coming from a single platform.";
          actions.push(
            "Connect at least one additional platform where you are active (e.g., Twitter + Farcaster, or GitHub + Lens).",
            "Use matching usernames so it’s obvious that the accounts belong to the same person."
          );
        } else if (severity === "weak" || severity === "critical") {
          summary = "You're present on multiple platforms, but they don't strongly reinforce each other yet.";
          actions.push(
            "Standardize your handle and avatar across platforms so they mutually confirm your identity.",
            "Link between your profiles (e.g., add your Farcaster in your Twitter bio and vice versa) to make the connections explicit."
          );
        } else {
          summary = "Your platforms overlap reasonably well, but there's still some room to tighten the connections.";
          actions.push(
            "Avoid creating side accounts that conflict with your main identity; keep the public, high-trust persona coherent."
          );
        }

        break;
      }

      default:
        summary = "This dimension contributes to your integrity score but has no custom guidance yet.";
        actions.push("No specific actions available for this dimension yet.");
        break;
    }

    results.push({
      key,
      label,
      severity,
      priority: gap,
      normalized,
      weighted,
      summary,
      actions,
    });
  }

  // Highest “gap” (most integrity headroom) first.
  return results.sort((a, b) => b.priority - a.priority);
}
