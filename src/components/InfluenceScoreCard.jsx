import React, { useMemo } from "react";

export default function InfluenceScoreCard({ legitimacyScore = 82 }) {
  const clamped = Math.max(0, Math.min(100, legitimacyScore));

  const tier = useMemo(() => {
    if (clamped >= 90) return { label: "Diamond", color: "from-cyan-400 via-fuchsia-400 to-purple-500" };
    if (clamped >= 75) return { label: "Gold", color: "from-amber-300 via-yellow-400 to-orange-500" };
    if (clamped >= 60) return { label: "Silver", color: "from-gray-200 via-gray-400 to-gray-600" };
    return { label: "Bronze", color: "from-orange-600 via-red-500 to-pink-500" };
  }, [clamped]);

  // Radial progress circle math
  const size = 160; // px
  const stroke = 10;
  const radius = (size / 2) - stroke;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
  <div className="card-glow p-6 max-w-md mx-auto">
    <div className="card-glow-overlay" />
    <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-cyan-400/10 via-transparent to-purple-500/10" />
      <header className="relative z-10 mb-4">
        <h2 className="text-lg font-semibold text-white tracking-wide">Influence Legitimacy</h2>
        <p className="text-xs text-gray-400 mt-1">Cross-protocol verification, overlap consistency & network quality.</p>
      </header>
      <div className="relative flex items-center justify-center my-6">
        <div className="relative">
          <svg
            width={size}
            height={size}
            role="img"
            aria-label={`Legitimacy score ${clamped} out of 100`}
            className="rotate-[-90deg]"
          >
            {/* Background track */}
            <circle
              cx={size/2}
              cy={size/2}
              r={radius}
              strokeWidth={stroke}
              stroke="rgba(255,255,255,0.08)"
              fill="none"
            />
            {/* Progress stroke */}
            <circle
              cx={size/2}
              cy={size/2}
              r={radius}
              strokeWidth={stroke}
              strokeLinecap="round"
              stroke="url(#grad)"
              fill="none"
              style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,.14,.2,1)' }}
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm text-cyan-300 font-medium tracking-wide">Score</p>
            <p className="text-4xl font-bold text-white leading-none">{clamped}</p>
            <p className="text-xs text-gray-400">/100</p>
          </div>
        </div>
      </div>
      {/* Tier & bar */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">Creator Tier</span>
          <span className={`text-sm font-semibold bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>{tier.label}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${tier.color} transition-all duration-700`}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
      <footer className="mt-5 text-xs text-gray-500 italic">
        Higher legitimacy correlates with verified multi-protocol reach & authentic overlap.
      </footer>
    </div>
  );
}
