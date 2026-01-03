import React, { useState } from "react";

export default function MatchDebugPanel({ data }) {
  const [open, setOpen] = useState(false);

  if (!data) return null;

  const {
    matchScore,
    breakdown,
    sharedCreators = [],
    sharedZoraCollections = [],
    sharedContracts = [],
    raw,
  } = data;

  return (
    <div className="mt-3 bg-black/20 border border-white/10 rounded-xl p-3">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center text-sm text-gray-300 hover:text-white transition"
      >
        <span className="font-semibold text-purple-300">
          Debug Match Details
        </span>
        <span className="text-xs opacity-70">
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      {!open && <div className="text-xs text-gray-500 mt-1">Score: {matchScore}%</div>}

      {/* Body */}
      {open && (
        <div className="mt-4 space-y-4 text-xs text-gray-300">

          {/* Breakdown */}
          <Section title="Similarity Breakdown">
            <BreakRow label="Identity Similarity" value={breakdown.identitySimilarity} />
            <BreakRow label="Platform Similarity" value={breakdown.platformSimilarity} />
            <BreakRow label="Username Overlap" value={breakdown.usernameOverlap} />
            <BreakRow label="Follower Similarity" value={breakdown.followerSim} />
            <BreakRow label="Creator Similarity" value={breakdown.creatorSimilarity} />
            <BreakRow label="On-chain Similarity" value={breakdown.onchainSimilarity} />
            <BreakRow label="MEM Similarity" value={breakdown.memSimilarity} />
            <BreakRow label="ENS Similarity" value={breakdown.ensSimilarity} />
            <BreakRow label="Engagement Similarity" value={breakdown.engagementSimilarity} />
          </Section>

          {/* Shared Creators */}
          <Section title="Shared Creators">
            {sharedCreators.length > 0 ? (
              <PillList items={sharedCreators} />
            ) : (
              <EmptyLine />
            )}
          </Section>

          {/* Shared Zora Collections */}
          <Section title="Shared Zora Collections">
            {sharedZoraCollections.length > 0 ? (
              <PillList items={sharedZoraCollections} />
            ) : (
              <EmptyLine />
            )}
          </Section>

          {/* Shared Contracts */}
          <Section title="Shared On-chain Contracts">
            {sharedContracts.length > 0 ? (
              <PillList items={sharedContracts} />
            ) : (
              <EmptyLine />
            )}
          </Section>

          {/* Raw inputs A + B */}
          {raw && (
            <Section title="Raw Input Data">
              <pre className="whitespace-pre-wrap text-[10px] text-gray-400 bg-black/30 p-3 rounded-md border border-white/5 overflow-x-auto">
                {JSON.stringify(raw, null, 2)}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// Helpers
function Section({ title, children }) {
  return (
    <div>
      <div className="text-purple-400 font-semibold mb-1">{title}</div>
      {children}
    </div>
  );
}

function BreakRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-1">
      <span>{label}</span>
      <span className="text-white font-semibold">{Math.round(value * 100)}%</span>
    </div>
  );
}

function PillList({ items }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded-full bg-purple-600/20 border border-purple-400/30 text-purple-200 text-[11px]"
        >
          {String(i)}
        </span>
      ))}
    </div>
  );
}

function EmptyLine() {
  return <div className="text-gray-500 italic">None</div>;
}
