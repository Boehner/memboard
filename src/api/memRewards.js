import { ethers } from "ethers";

// --- Config ---
export const MEM_CONTRACT_ADDRESS = import.meta.env.VITE_MEM_CONTRACT;

// Minimal ABI fragments needed for balance & events (extend when actual ABI known)
const MEM_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "event RewardClaim(address indexed claimer, uint256 amount)",
];

// Fallback RPC endpoints (rotate on failure)
const RPC_ENDPOINTS = [
  import.meta.env.VITE_PUBLIC_RPC,
  import.meta.env.VITE_PUBLIC_RPC_FALLBACK,
  "https://mainnet.base.org",
].filter(Boolean);

let rpcIndex = 0;
function selectRpc() {
  return RPC_ENDPOINTS[rpcIndex % RPC_ENDPOINTS.length];
}

export function getProvider() {
  return new ethers.JsonRpcProvider(selectRpc());
}

export function getMemContract(provider) {
  return new ethers.Contract(MEM_CONTRACT_ADDRESS, MEM_ABI, provider);
}

// --- Fetch MEM Balance ---
// Dedicated mainnet provider for ENS (Base RPC does not support ENS resolver calls)
const ENS_MAINNET_PROVIDER = new ethers.JsonRpcProvider('https://cloudflare-eth.com');
// Positive resolution cache (name -> address)
const ENS_CACHE = new Map();
// Negative cache to avoid hammering on unresolved names (name -> timestamp)
const ENS_NEG_CACHE = new Map();
const NEG_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ENS_FALLBACK_BASE = 'https://api.ensideas.com/ens/resolve/';

async function fetchEnsIdeas(name) {
  try {
    const res = await fetch(ENS_FALLBACK_BASE + encodeURIComponent(name));
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address;
    if (addr && ethers.isAddress(addr)) return addr;
    return null;
  } catch (_) {
    return null;
  }
}

async function resolveAddressOrName(input) {
  if (!input) return null;
  if (ethers.isAddress(input)) return input;
  if (typeof input === 'string' && input.endsWith('.eth')) {
    // Check positive cache first
    if (ENS_CACHE.has(input)) return ENS_CACHE.get(input);
    // Check negative cache TTL
    const negTs = ENS_NEG_CACHE.get(input);
    if (negTs && Date.now() - negTs < NEG_TTL_MS) return null;
    // Primary: RPC resolution
    try {
      const resolved = await ENS_MAINNET_PROVIDER.resolveName(input);
      if (resolved && ethers.isAddress(resolved)) {
        ENS_CACHE.set(input, resolved);
        return resolved;
      }
    } catch (_) {
      // ignore primary failure, will fallback
    }
    // Fallback: ensideas API
    const apiResolved = await fetchEnsIdeas(input);
    if (apiResolved) {
      ENS_CACHE.set(input, apiResolved);
      return apiResolved;
    }
    // Mark negative result
    ENS_NEG_CACHE.set(input, Date.now());
    return null;
  }
  return null;
}

// Extended ENS resolver with source metadata for UI badges (does not change existing helpers)
export async function resolveEnsWithSource(name) {
  if (!name || !name.endsWith('.eth')) return { address: null, source: null };
  if (ENS_CACHE.has(name)) return { address: ENS_CACHE.get(name), source: 'cache' };
  const negTs = ENS_NEG_CACHE.get(name);
  if (negTs && Date.now() - negTs < NEG_TTL_MS) return { address: null, source: 'negative-cache' };
  // Try RPC first
  try {
    const resolved = await ENS_MAINNET_PROVIDER.resolveName(name);
    if (resolved && ethers.isAddress(resolved)) {
      ENS_CACHE.set(name, resolved);
      return { address: resolved, source: 'rpc' };
    }
  } catch (_) {}
  // Fallback API
  const apiResolved = await fetchEnsIdeas(name);
  if (apiResolved) {
    ENS_CACHE.set(name, apiResolved);
    return { address: apiResolved, source: 'api' };
  }
  ENS_NEG_CACHE.set(name, Date.now());
  return { address: null, source: 'unresolved' };
}

export async function fetchMemBalance(address) {
  try {
    if (!address) return null;
    if (
      MEM_CONTRACT_ADDRESS ===
      "0x0000000000000000000000000000000000000000"
    )
      return null;

    const provider = getProvider();
    const net = await provider.getNetwork();

    if (net.chainId !== 8453n) {
      console.warn("Not on Base network, skipping MEM balance");
      return null;
    }
  const resolved = await resolveAddressOrName(address);
    if (!resolved) {
      console.warn('Address/ENS not resolvable for balanceOf:', address);
      return null;
    }
    const contract = getMemContract(provider);
    const raw = await contract.balanceOf(resolved);

    if (!raw || raw === "0x") return null;
    return Number(ethers.formatUnits(raw, 18));
  } catch (e) {
    console.warn("MEM balance fetch failed:", e);
    return null;
  }
}

// --- Fetch Recent Claimed Rewards ---
export async function fetchRecentClaims(address, lookbackBlocks = 1500) {
  if (!address) return [];

  const provider = getProvider();
  const net = await provider.getNetwork();
  if (net.chainId !== 8453n) return [];
  const resolved = await resolveAddressOrName(address);
  if (!resolved) {
    console.warn('Address/ENS not resolvable for claim logs:', address);
    return [];
  }
  const contract = getMemContract(provider);
  const iface = new ethers.Interface(MEM_ABI);
  const eventTopic = iface.getEvent("RewardClaim").topicHash;

  const currentBlock = await provider.getBlockNumber();
  let fromBlock = Math.max(currentBlock - lookbackBlocks, 0);
  let attempts = 0;
  let degraded = false;

  while (attempts < 4) {
    try {
      const logs = await provider.getLogs({
        fromBlock,
        toBlock: currentBlock,
        address: MEM_CONTRACT_ADDRESS,
        topics: [eventTopic, ethers.zeroPadValue(resolved, 32)],
      });

      return logs.map((log) => {
        const parsed = iface.parseLog(log);
        const amount = Number(ethers.formatUnits(parsed.args[1], 18));
        return {
          amount,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          degraded,
        };
      });
    } catch (err) {
      console.warn("Error fetching RewardClaim logs:", err.code);
      const code = err?.code;

      if (code === -32011) {
        lookbackBlocks = Math.floor(lookbackBlocks / 2);
        fromBlock = Math.max(currentBlock - lookbackBlocks, 0);
        await new Promise((r) => setTimeout(r, 350 * (attempts + 1)));
      } else if (code === -32002 || err?.data?.httpStatus === 503) {
        await new Promise((r) => setTimeout(r, 300));
      } else {
        console.warn("MEM claims fetch failed non-retryable", err);
        return [];
      }

      attempts++;
      if (attempts === 2) {
        rpcIndex++;
        degraded = true;
      }
    }
  }

  return [];
}

export async function estimateUpcomingRewards(address) {
  const balance = await fetchMemBalance(address);
  const claims = await fetchRecentClaims(address);
  const claimedTotal = claims.reduce((a, c) => a + c.amount, 0);
  const avgClaim = claims.length ? claimedTotal / claims.length : 0;
  const degraded = claims.some((c) => c.degraded);

  const projection = avgClaim * 1.1 + (balance || 0) * 0.02;
  return { balance, claimedTotal, avgClaim, projection, degraded };
}
