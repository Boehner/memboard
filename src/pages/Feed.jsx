import React, { useEffect, useState } from "react";
import { getConnectedWallets } from "@/api/getConnectedWallets";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import FeedList from "@/components/FeedList";

export default function Feed({ wallet, userProfile = null }) {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    async function load() {
      // 1. Fetch REAL wallets from Memory identity graph
      const wallets = await getConnectedWallets(wallet, userProfile);

      // 2. Build real feed subjects
      const realSubjects = wallets.slice(0, 50).map(w => ({
        id: w,
        walletOrEns: w,
        timestamp: Date.now(), // TEMP until you add content timestamps
      }));

      setSubjects(realSubjects);
    }
    load();
  }, [wallet]);

  // 3. Rank REAL items
  const { ranked, loading } = useRankedFeed(subjects, {
    weights: { legitimacy: 0.60, engagement: 0.35, freshness: 0.05 },
    userWallet: wallet,
    userProfile,
  });

  return (
    <div className="p-6">
      <h1 className="text-white font-bold text-xl mb-4">Your Personalized Feed</h1>
      <FeedList data={ranked} loading={loading} />
    </div>
  );
}
