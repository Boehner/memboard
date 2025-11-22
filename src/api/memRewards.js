// api/memRewards.js (UPDATED FULL VERSION)

import { ethers } from "ethers";
import { fetchMemoryApiClaims } from "./memory";

// --- Config ---
export const MEM_CONTRACT_ADDRESS = import.meta.env.VITE_MEM_CONTRACT;

// Minimal ABI
const MEM_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "event RewardClaim(address indexed claimer, uint256 amount)"
];

// RPC rotation
const RPC_ENDPOINTS = [
  import.meta.env.VITE_PUBLIC_RPC,
  import.meta.env.VITE_PUBLIC_RPC_FALLBACK,
  "https://mainnet.base.org"
].filter(Boolean);

let rpcIndex = 0;
function selectRpc() {
  return RPC_ENDPOINTS[rpcIndex % RPC_ENDPOINTS.length];
}

function rotateRpc() {
  rpcIndex = (rpcIndex + 1) % RPC_ENDPOINTS.length;
}

export function getProvider() {
  return new ethers.JsonRpcProvider(selectRpc());
}

export function getMemContract(provider) {
  return new ethers.Contract(MEM_CONTRACT_ADDRESS, MEM_ABI, provider);
}

// ------------------------------
// ENS resolution helpers (unchanged)
// ------------------------------
const ENS_MAINNET_PROVIDER = new ethers.JsonRpcProvider("https://cloudflare-eth.com");
const ENS_CACHE = new Map();
const ENS_NEG_CACHE = new Map();
const NEG_TTL_MS = 5 * 60 * 1000;
const ENS_FALLBACK_BASE = "https://api.ensideas.com/ens/resolve/";

async function fetchEnsIdeas(name) {
  try {
    const res = await fetch(ENS_FALLBACK_BASE + encodeURIComponent(name));
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address;
    if (addr && ethers.isAddress(addr)) return addr;
    return null;
  } catch {
    return null;
  }
}

async function resolveAddressOrName(input) {
  if (!input) return null;
  if (ethers.isAddress(input)) return input;

  if (typeof input === "string" && input.endsWith(".eth")) {
    if (ENS_CACHE.has(input)) return ENS_CACHE.get(input);

    const negTs = ENS_NEG_CACHE.get(input);
    if (negTs && Date.now() - negTs < NEG_TTL_MS) return null;

    try {
      const resolved = await ENS_MAINNET_PROVIDER.resolveName(input);
      if (resolved && ethers.isAddress(resolved)) {
        ENS_CACHE.set(input, resolved);
        return resolved;
      }
    } catch {}

    const apiResolved = await fetchEnsIdeas(input);
    if (apiResolved) {
      ENS_CACHE.set(input, apiResolved);
      return apiResolved;
    }

    ENS_NEG_CACHE.set(input, Date.now());
    return null;
  }

  return null;
}

export async function resolveEnsWithSource(name) {
  if (!name || !name.endsWith(".eth")) return { address: null, source: null };
  if (ENS_CACHE.has(name)) return { address: ENS_CACHE.get(name), source: "cache" };
  const negTs = ENS_NEG_CACHE.get(name);
  if (negTs && Date.now() - negTs < NEG_TTL_MS)
    return { address: null, source: "negative-cache" };

  try {
    const resolved = await ENS_MAINNET_PROVIDER.resolveName(name);
    if (resolved && ethers.isAddress(resolved)) {
      ENS_CACHE.set(name, resolved);
      return { address: resolved, source: "rpc" };
    }
  } catch {}

  const apiResolved = await fetchEnsIdeas(name);
  if (apiResolved) {
    ENS_CACHE.set(name, apiResolved);
    return { address: apiResolved, source: "api" };
  }

  ENS_NEG_CACHE.set(name, Date.now());
  return { address: null, source: "unresolved" };
}

// ------------------------------
// 1. MEM BALANCE (unchanged)
// ------------------------------
export async function fetchMemBalance(address) {
  try {
    if (!address) return null;

    if (MEM_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000")
      return null;

    const provider = getProvider();
    const net = await provider.getNetwork();

    if (net.chainId !== 8453n) {
      console.warn("Not on Base network, skipping MEM balance");
      return null;
    }

    const resolved = await resolveAddressOrName(address);
    if (!resolved) {
      console.warn("Address/ENS not resolvable:", address);
      return null;
    }

    const contract = getMemContract(provider);
    const raw = await contract.balanceOf(resolved);
    return Number(ethers.formatUnits(raw, 18));

  } catch (e) {
    console.warn("MEM balance fetch failed:", e);
    return null;
  }
}

// Memory API claims now moved to memory.js (fetchMemoryApiClaims)

// ------------------------------
// 3. On-chain claim logs (kept as secondary)
// ------------------------------
export async function fetchOnchainRewardClaims(address, lookbackBlocks = 20000) {
  if (!address) return [];

  try {
    const resolved = await resolveAddressOrName(address);
    if (!resolved) return [];

    const iface = new ethers.Interface(MEM_ABI);
    const topic = iface.getEvent("RewardClaim").topicHash;

    let provider = getProvider();
    const net = await provider.getNetwork();
    if (net.chainId !== 8453n) return [];

    const latest = await provider.getBlockNumber();
    const start = Math.max(latest - lookbackBlocks, 0);

    const CHUNK_SIZE = 4000; // reduce strain on RPC
    const MAX_RETRIES = 3;
    const logsCollected = [];

    for (let from = start; from <= latest; from += CHUNK_SIZE + 1) {
      const to = Math.min(from + CHUNK_SIZE, latest);
      let attempt = 0;
      while (attempt < MAX_RETRIES) {
        try {
          const batchLogs = await provider.getLogs({
            fromBlock: from,
            toBlock: to,
            address: MEM_CONTRACT_ADDRESS,
            topics: [topic, ethers.zeroPadValue(resolved, 32)],
          });
          logsCollected.push(...batchLogs);
          break; // success for this chunk
        } catch (err) {
          const msg = String(err.message || '').toLowerCase();
          const isBackendUnhealthy = msg.includes('no backend') || msg.includes('healthy');
          if (isBackendUnhealthy) {
            rotateRpc();
            provider = getProvider();
          }
          attempt++;
          if (attempt >= MAX_RETRIES) {
            console.warn(`Skipping block range ${from}-${to} after ${attempt} failures`, err.message);
            break;
          }
          await new Promise(r => setTimeout(r, 250 * attempt));
        }
      }
    }

    return logsCollected.map(log => {
      const parsed = iface.parseLog(log);
      return {
        amount: Number(ethers.formatUnits(parsed.args[1], 18)),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: null,
        source: "onchain",
      };
    });

  } catch (err) {
    console.warn("On-chain RewardClaim logs error:", err);
    return [];
  }
}

// ------------------------------
// 4. Unified Claims Fetch (REPLACEMENT FOR fetchRecentClaims)
// ------------------------------
export async function fetchAllMemClaims(address) {
  try {
    const [apiClaims, onchainClaims] = await Promise.all([
      fetchMemoryApiClaims(address),
      fetchOnchainRewardClaims(address),
    ]);
    return [...apiClaims, ...onchainClaims]
      .sort((a, b) => {
        const aKey = a.blockNumber || a.distributionRoundId || 0;
        const bKey = b.blockNumber || b.distributionRoundId || 0;
        return bKey - aKey;
      });

  } catch (err) {
    console.warn("fetchAllMemClaims failed", err);
    return [];
  }
}

// ------------------------------
// 5. Unified Reward Projection
// ------------------------------
export async function estimateUpcomingRewards(address) {
  const balance = await fetchMemBalance(address);
  const claims = await fetchAllMemClaims(address);

  const claimedTotal = claims.reduce((sum, c) => sum + c.amount, 0);
  const avgClaim = claims.length ? claimedTotal / claims.length : 0;

  // Simple projection model
  const projection =
    avgClaim * 1.1 + // Slight upward bias
    (balance || 0) * 0.02; // Small multiplier for unclaimed MEM

  return {
    balance,
    claims,
    claimedTotal,
    avgClaim,
    projection,
  };
}
