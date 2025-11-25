import { computeTier } from "../utils/computeTier";

export default function TierBadge({ score }) {
  const tier = computeTier(score);

  return (
    <div
      className={`
        inline-flex items-center gap-2
        px-4 py-1.5 rounded-full text-sm font-semibold
        bg-gradient-to-r ${tier.color}
        text-black shadow-md border border-white/10
        transition-transform duration-300 hover:scale-[1.05]
      `}
      title={tier.description}
    >
      <span  className={`text-white`}>{tier.label}</span>
    </div>
  );
}
