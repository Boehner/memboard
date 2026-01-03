// components/MatchList.jsx
import React from "react";
import MatchCard from "./MatchCard";

export default function MatchList({ matches = [], loading }) {
  if (loading) {
    return <div className="p-4 text-center text-gray-400 animate-pulse">Loading matches...</div>;
  }

  if (!matches.length) {
    return <div className="p-4 text-center text-gray-400">No matches found.</div>;
  }

  return (
    <div className="space-y-4">
      {matches.map(m => (
        <MatchCard key={m.walletB} data={m} />
      ))}
    </div>
  );
}
