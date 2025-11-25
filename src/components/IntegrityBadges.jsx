import React from "react";

export default function IntegrityBadges({ badges = [] }) {
  if (!badges.length) return null;

  return (
    <div className="mt-6 bg-white/5 p-4 rounded-lg border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-3 tracking-wide">
        Identity Badges
      </h3>

      <div className="flex flex-wrap gap-2">
        {badges.map((b, index) => (
          <span
            key={b.id}
            title={b.description}
            className={`
              badge-animate
              inline-flex items-center gap-2
              text-xs px-3 py-1 rounded-full text-white font-semibold
              shadow-sm border border-white/10
              transition-transform duration-300
              hover:scale-[1.07] hover:brightness-110
              bg-gradient-to-r ${b.color}
            `}
            style={{
              animationDelay: `${index * 0.08}s`, // Stagger animation
              textShadow: "0 2px 4px rgba(0,0,0,0.7)",
            }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
