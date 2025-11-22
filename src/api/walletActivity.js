// api/walletActivity.js
import { ethers } from "ethers";

const MAINNET_RPC = import.meta.env.VITE_PUBLIC_RPC;

export async function fetchWalletActivity(address) {
  try {
    const provider = new ethers.JsonRpcProvider(MAINNET_RPC);

    // TX count is the ONLY reliable signal we can fetch without trace or BaseScan paid tier.
    const txCount = await provider.getTransactionCount(address);

    return {
      txCount,
      gasSpent: null,           // Always null since RPC alone can't compute gas
      recentContracts: null,    // Also null because trace_filter is disabled
      window: null,
    };

  } catch (err) {
    console.warn("wallet activity fetch error:", err);
    return { txCount: 0, gasSpent: null, recentContracts: null };
  }
}
