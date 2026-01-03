// hooks/useWalletMatch.js
import { useEffect, useState } from "react";
import { matchWallets } from "./api/matching";

export function useWalletMatch(walletA, walletB, profileA = null, profileB = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!walletA || !walletB) return;

      setLoading(true);
      try {
        const result = await matchWallets(walletA, walletB, profileA, profileB);
        setData(result);
      } catch (err) {
        console.error("Wallet match error:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [walletA, walletB]);

  return { data, loading };
}
