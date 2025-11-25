import { computeTier } from "./computeTier";

export function computeTierProgress(score) {
  const tier = computeTier(score);

  // Tier boundaries
  const thresholds = {
    unverified: 0,
    emerging: 25,
    credible: 45,
    established: 65,
    trusted: 80,
    sovereign: 93,
  };

  const order = [
    "unverified",
    "emerging",
    "credible",
    "established",
    "trusted",
    "sovereign",
  ];

  const currentIndex = order.indexOf(tier.id);
  const nextTierId = order[currentIndex + 1] || "sovereign";

  const currentMin = thresholds[tier.id];
  const nextMin = thresholds[nextTierId];

  // Calculate progress
  const progressRaw = (score - currentMin) / (nextMin - currentMin);
  const clampedProgress = Math.max(0, Math.min(1, progressRaw));

  const pointsNeeded = Math.max(0, nextMin - score);

  return {
    tier,
    nextTier: computeTier(nextMin),
    progress: clampedProgress,
    pointsNeeded,
    nextThreshold: nextMin,
  };
}
