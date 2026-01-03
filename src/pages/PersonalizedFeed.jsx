import React from "react";
import FeedList from "@/components/FeedList";
import { useRankedFeed } from "@/hooks/useRankedFeed";

export default function PersonalizedFeed() {
  const sampleSubjects = [
    { id: "a1", walletOrEns: "jack.base.eth", timestamp: Date.now() - 10000 },
    { id: "a2", walletOrEns: "0x1234...", timestamp: Date.now() - 86400000 },
    { id: "a3", walletOrEns: "alice.eth", timestamp: Date.now() - 3600000 },
  ];

  const { ranked, loading } = useRankedFeed(sampleSubjects, {
    weights: { legitimacy: 0.50, engagement: 0.40, freshness: 0.10 },
    freshnessConfig: { halfLifeDays: 3 },
  });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-4">Personalized Feed</h1>
      <FeedList data={ranked} loading={loading} />
    </div>
  );
}
