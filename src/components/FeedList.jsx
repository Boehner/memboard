// components/FeedList.jsx
import React from "react";

export default function FeedList({ data = [], loading }) {
  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400 animate-pulse">
        Loading personalized feed...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="p-6 text-center text-gray-400">
        No feed items found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function FeedItem({ item }) {
  const {
    id,
    walletOrEns,
    feedScore,
    legitimacyScore,
    engagementScore,
    engagementBreakdown,
    legitimacyBreakdown,
    freshnessScore,
    meta,
  } = item;

  return (
    <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm shadow-sm hover:bg-white/10 transition">
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold text-white">{walletOrEns}</div>
        <div className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-200 font-medium">
          Feed Score: {feedScore}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs text-gray-300 mb-3">
        <Badge label="Legitimacy" value={legitimacyScore} />
        <Badge label="Engagement" value={engagementScore} />
        <Badge label="Freshness" value={freshnessScore} />
      </div>

      {meta?.type === "post" && (
        <div className="text-gray-200 text-sm border-t border-white/10 pt-3">
          {meta.content}
        </div>
      )}
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div className="bg-black/20 px-2 py-1 rounded-lg border border-white/10">
      <div className="text-gray-400">{label}</div>
      <div className="text-white font-semibold">{value}</div>
    </div>
  );
}
