import { ethers } from "ethers";

export async function getMemoryProfile(walletOrENS) {
  const API_URL = `https://api.memoryproto.co/identities/wallet/${walletOrENS}`;
  const API_KEY = import.meta.env.VITE_MEMORY_API_KEY;

  try {
    const response = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const raw = await response.json();
    console.log("Fetched Memory Identity:", raw);

    // --- Normalize data ---
    const identities =
      Array.isArray(raw)
        ? raw
        : raw.identities ||
          raw.connections ||
          raw.linked ||
          raw.results ||
          raw.identity ||
          [];

    return {
      wallet: walletOrENS,
      identities,
      total: identities.length,
      verified: identities.filter((i) =>
        i.sources?.some((s) => s.verified)
      ).length,
    };
  } catch (err) {
    console.error("Error fetching Memory identity:", err);
    return {
      wallet: walletOrENS,
      identities: [],
      total: 0,
      verified: 0,
    };
  }
}

// Memory Protocol reward claims (API)
// Returns normalized array of { amount, blockNumber, txHash, timestamp, source }
export async function fetchMemoryApiClaims(address) {
  if (!address) return [];
  try {
    const checksummed = (() => {
      try { return ethers.getAddress(address); } catch { return address.toLowerCase(); }
    })();

    const url = `https://api.memoryproto.co/rewards/reward-distribution-claims/${checksummed}`;
    const API_KEY = import.meta.env.VITE_MEMORY_API_KEY;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.warn("Memory API claims non-OK response", res.status, res.statusText);
      return [];
    }
    const data = await res.json();

    // Data format examples:
    // { totalClaimed, totalUnclaimed, claimed: [...], unclaimed: [...] }
    // Each claim item fields: claimAmount (wei), claimed (bool), distributionRoundId, createdAt, merkleRoot, chainId, merkleProof[]

    const claimedArr = Array.isArray(data?.claimed) ? data.claimed : (Array.isArray(data) ? data : []);
    const unclaimedArr = Array.isArray(data?.unclaimed) ? data.unclaimed : [];

    function mapClaim(c, isClaimed) {
      const rawWei = c.claimAmount || c.amount || "0";
      let amountMem;
      try {
        // Support either BigInt-capable numeric string or fall back
        amountMem = Number(ethers.formatUnits(rawWei, 18));
      } catch {
        amountMem = Number(rawWei) / 1e18;
      }
      return {
        amount: amountMem,
        rawAmountWei: rawWei,
        claimed: typeof c.claimed === 'boolean' ? c.claimed : isClaimed,
        distributionRoundId: c.distributionRoundId ?? null,
        merkleRoot: c.merkleRoot || null,
        chainId: c.chainId || null,
        merkleProof: Array.isArray(c.merkleProof) ? c.merkleProof : [],
        // These may be absent in current API; keep placeholders
        blockNumber: c.blockNumber ? Number(c.blockNumber) : null,
        txHash: c.transactionHash || null,
        timestamp: c.createdAt || c.timestamp || null,
        source: isClaimed ? "memory-api-claimed" : "memory-api-unclaimed",
      };
    }

    const normalized = [
      ...claimedArr.map(c => mapClaim(c, true)),
      ...unclaimedArr.map(c => mapClaim(c, false)),
    ];

    return normalized;
  } catch (err) {
    console.warn("Memory API claims error:", err);
    return [];
  }
}
