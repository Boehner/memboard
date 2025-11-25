import { computeTierProgress } from "../utils/computeTierProgress";

export default function TierXPBar({ score }) {
  const { tier, nextTier, progress, pointsNeeded } = computeTierProgress(score);
  const percentage = progress * 100;
  const isNearNext = progress > 0.8;

  return (
    <div className="mt-4 bg-white/5 p-4 rounded-lg border border-white/10">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-white">
          {tier.label} → {nextTier.label}
        </span>
        <span className="text-xs text-gray-300">
          {pointsNeeded === 0
            ? "Max Tier"
            : `${pointsNeeded} pts to ${nextTier.label}`}
        </span>
      </div>
      <div className="relative w-full h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full
            bg-gradient-to-r ${tier.color} xp-animate
            transition-all duration-[1500ms] ease-out
            ${isNearNext ? "xp-glow" : ""}
          `}
          style={{ width: `${percentage}%` }}
        >
        </div>
      </div>
    </div>
  );
}
