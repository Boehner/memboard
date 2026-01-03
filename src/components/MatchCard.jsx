// components/MatchCard.jsx
import React from "react";
import MatchDebugPanel from "./MatchDebugPanel";

export default function MatchCard({ data }) {
  if (!data) return null;

  const {
    walletB,
    matchScore,
    breakdown,
    sharedCreators = [],
    sharedZoraCollections = [],
    sharedContracts = [],
    sharedFarcasterWallets = [],
  } = data;

  return (
    <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow-md transition hover:bg-white/10">

      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold text-white">{walletB}</div>

        <div
          className="px-3 py-1 rounded-lg text-white text-sm font-semibold"
          style={{
            background:
              matchScore >= 80
                ? "linear-gradient(135deg,#22c55e,#16a34a)"
                : matchScore >= 60
                ? "linear-gradient(135deg,#3b82f6,#2563eb)"
                : matchScore >= 40
                ? "linear-gradient(135deg,#f59e0b,#d97706)"
                : "linear-gradient(135deg,#ef4444,#b91c1c)",
          }}
        >
          {matchScore}% Match
        </div>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs text-gray-300 mt-3">
        <MatchMetric label="Identity" value={breakdown.identitySimilarity} />
        <MatchMetric label="Platforms" value={breakdown.platformSimilarity} />
        <MatchMetric label="Usernames" value={breakdown.usernameOverlap} />
        <MatchMetric label="Followers" value={breakdown.followerSim} />
        <MatchMetric label="Creators" value={breakdown.creatorSimilarity} />
        <MatchMetric label="On-chain" value={breakdown.onchainSimilarity} />
        <MatchMetric label="MEM" value={breakdown.memSimilarity} />
        <MatchMetric label="ENS" value={breakdown.ensSimilarity} />
        <MatchMetric label="Engagement" value={breakdown.engagementSimilarity} />

        {/* NEW — Farcaster Similarity */}
        <MatchMetric
          label="Farcaster"
          value={breakdown.farcasterSimilarity || 0}
        />
      </div>

      {/* ---------------------------- */}
      {/* Shared Creators */}
      {/* ---------------------------- */}
      {sharedCreators.length > 0 && (
        <SharedSection title="Shared Creators" items={sharedCreators} />
      )}

      {/* ---------------------------- */}
      {/* Shared Zora Collections */}
      {/* ---------------------------- */}
      {sharedZoraCollections.length > 0 && (
        <SharedSection title="Shared Zora Collections" items={sharedZoraCollections} />
      )}

      {/* ---------------------------- */}
      {/* Shared Contract Interactions */}
      {/* ---------------------------- */}
      {sharedContracts.length > 0 && (
        <SharedSection title="Shared On-chain Contracts" items={sharedContracts} />
      )}

      {/* ---------------------------- */}
      {/* Shared Farcaster Wallets */}
      {/* ---------------------------- */}
      {sharedFarcasterWallets.length > 0 && (
        <SharedSection title="Shared Farcaster Wallets" items={sharedFarcasterWallets} />
      )}

      {/* --- AI Explanation --- */}
{data.explanation && (
  <div className="mt-4 text-xs text-gray-300 bg-black/20 p-3 rounded-lg border border-white/10">
    <div className="font-semibold text-purple-300 mb-1">Why this match?</div>
    <pre className="whitespace-pre-wrap text-gray-200">
      {data.explanation}
    </pre>
  </div>
      )}

      {/* Debug Panel */}
      <MatchDebugPanel data={data} />
    </div>
  );
}

/* ---------------------------------------------
   Metric Component
--------------------------------------------- */
function MatchMetric({ label, value }) {
  return (
    <div className="bg-black/20 px-2 py-1 rounded-md border border-white/10">
      <div className="uppercase text-gray-400">{label}</div>
      <div className="text-white font-semibold">
        {Math.round((value || 0) * 100)}%
      </div>
    </div>
  );
}

/* ---------------------------------------------
   Reusable Shared Items Section
--------------------------------------------- */
function SharedSection({ title, items }) {
  return (
    <div className="mt-4">
      <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
        {title}
      </div>

      <div className="flex flex-wrap gap-1">
        {items.slice(0, 8).map((it) => (
          <span
            key={it}
            className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-100 text-xs"
          >
            {String(it)}
          </span>
        ))}

        {items.length > 8 && (
          <span className="text-gray-400 text-xs ml-1">
            +{items.length - 8} more
          </span>
        )}
      </div>
    </div>
  );
}
