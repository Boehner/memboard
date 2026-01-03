// pages/RecommendedMatches.jsx
import React, { useEffect, useState } from "react";
import { matchWallets } from "@/api/matching";
import MatchList from "@/components/MatchList";
import { discoverCandidates } from "@/api/candidateDiscovery";

export default function RecommendedMatches({ userWallet, userProfile = null }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userWallet) return;

    async function load() {
      setLoading(true);

      try {
        // --------------------------------------------
        // 1. Fetch candidates using our identity graph
        // --------------------------------------------
        const candidates = await discoverCandidates(userWallet, userProfile);

        // If discoverCandidates returns ENS, usernames, or invalid types, filter:
        const walletsOnly = candidates.filter(
          c => typeof c === "string" && c.toLowerCase().startsWith("0x")
        );

        // Limit for safety while scoring:
        const targets = walletsOnly.slice(0, 20);

        // --------------------------------------------
        // 2. Compute match scores
        // --------------------------------------------
        const results = await Promise.all(
          targets.map(async (peer) => {
            try {
              const res = await matchWallets(userWallet, peer);
              return res || null;
            } catch (err) {
              console.error("Match error with wallet:", peer, err);
              return null;
            }
          })
        );

        // --------------------------------------------
        // 3. Clean + sort by matchScore
        // --------------------------------------------
        const cleaned = results
          .filter(r => r && !r.blocked && r.matchScore !== undefined)
          .sort((a, b) => b.matchScore - a.matchScore);

        setMatches(cleaned);
      } catch (err) {
        console.error("RecommendedMatches load error:", err);
        setMatches([]);
      }

      setLoading(false);
    }

    load();
  }, [userWallet]);

  return (
    <div className="p-0">
      <MatchList matches={matches} loading={loading} />
    </div>
  );
}
