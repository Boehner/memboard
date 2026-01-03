// api/txGraph.js
//
// Shared transaction graph between wallets using Blockscout for Base.
// Focuses on the set of distinct "to" contract addresses.

const BLOCKSCOUT_BASE = "https://base.blockscout.com/api";

async function fetchContractSet(address, { maxTx = 200 } = {}) {
  if (!address) return new Set();

  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    sort: "desc",
    page: "1",
    offset: String(maxTx),
  });

  const url = `${BLOCKSCOUT_BASE}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("txGraph non-OK", res.status, res.statusText);
      return new Set();
    }
    const json = await res.json();
    const result = Array.isArray(json.result) ? json.result : [];

    const contracts = new Set();
    result.forEach((tx) => {
      const to = (tx.to || "").toLowerCase();
      if (to && to !== "0x0000000000000000000000000000000000000000") {
        contracts.add(to);
      }
    });
    return contracts;
  } catch (err) {
    console.warn("txGraph fetch error", err);
    return new Set();
  }
}

/**
 * Overlap in distinct "to" contracts between two wallets.
 */
export async function computeTxGraphOverlap(walletA, walletB, opts = {}) {
  const [A, B] = await Promise.all([
    fetchContractSet(walletA, opts),
    fetchContractSet(walletB, opts),
  ]);

  if (!A.size || !B.size) {
    return { overlapScore: 0, sharedContracts: [] };
  }

  const shared = [...A].filter((c) => B.has(c));
  const unionSize = new Set([...A, ...B]).size;
  const overlapScore = unionSize > 0 ? shared.length / unionSize : 0;

  return {
    overlapScore,
    sharedContracts: shared,
  };
}
