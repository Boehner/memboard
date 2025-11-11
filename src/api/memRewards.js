import { ethers } from 'ethers';

// Placeholder MEM token / rewards contract details (replace with real ones)
export const MEM_CONTRACT_ADDRESS = import.meta.env.VITE_MEM_CONTRACT;

// Minimal ABI fragments needed for balance & events (extend when actual ABI known)
const MEM_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'event RewardClaim(address indexed claimer, uint256 amount)',
];

// Provider helper (uses injected provider if available, else public RPC placeholder)
// Fallback RPC endpoints (rotate on failure)
const RPC_ENDPOINTS = [
  import.meta.env.VITE_PUBLIC_RPC,
  import.meta.env.VITE_PUBLIC_RPC_FALLBACK,
  'https://mainnet.base.org',
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

// Fetch MEM balance (token or reward units depending on contract semantics)
export async function fetchMemBalance(address) {
  try {
  if (!address) return null;
  // Skip if using placeholder zero address contract
  if (MEM_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') return null;
    const provider = getProvider();
    const net = await provider.getNetwork();
    if (net.chainId !== 8453n) {
      console.warn('Not on Base network, skipping MEM balance');
      return null;
    }
    const contract = getMemContract(provider);
    const raw = await contract.balanceOf(address);
  // Some non-ERC20 or faulty responses may return just '0x'
  if (!raw || raw === '0x') return null;
    return Number(ethers.formatUnits(raw, 18));
  } catch (e) {
    console.warn('MEM balance fetch failed', e);
    return null;
  }
}

// Fetch recent claimed rewards (limited scan)
export async function fetchRecentClaims(address, lookbackBlocks = 1500) {
  if (!address) return [];
  const filterLogs = async (prov, fromBlock, toBlock, contract, address) => {
    const filter = contract.filters.RewardClaim(address);
    return prov.getLogs({ ...filter, fromBlock, toBlock });
  };
  let provider = getProvider();
  let net;
  try { net = await provider.getNetwork(); } catch { return []; }
  if (net.chainId !== 8453n) return [];
  const contract = getMemContract(provider);
  const current = await provider.getBlockNumber();
  let fromBlock = Math.max(current - lookbackBlocks, 0);
  let attempts = 0;
  let degraded = false;
  while (attempts < 4) {
    try {
      const logs = await filterLogs(provider, fromBlock, current, contract, address);
      return logs.map((l) => {
        const parsed = contract.interface.parseLog(l);
        return { amount: Number(ethers.formatUnits(parsed.args[1], 18)), txHash: l.transactionHash, blockNumber: l.blockNumber, degraded };
      });
    } catch (err) {
      const code = err?.code;
      if (code === -32011) {
        // Backend unhealthy: reduce range + retry after small backoff
        lookbackBlocks = Math.floor(lookbackBlocks / 2);
        fromBlock = Math.max(current - lookbackBlocks, 0);
        await new Promise(r => setTimeout(r, 350 * (attempts + 1))); // incremental backoff
      } else if (code === -32002 || err?.data?.httpStatus === 503) {
        // Busy; short wait then retry
        await new Promise(r => setTimeout(r, 300));
      } else {
        console.warn('MEM claims fetch failed non-retryable', err);
        return [];
      }
      // Rotate RPC after second failure
      attempts++;
      if (attempts === 2) {
        rpcIndex++;
        provider = getProvider();
        degraded = true;
      }
    }
  }
  return [];
}

// Estimate upcoming rewards (placeholder heuristic combining balance + claims)
export async function estimateUpcomingRewards(address) {
  const balance = await fetchMemBalance(address);
  const claims = await fetchRecentClaims(address);
  const claimedTotal = claims.reduce((a, c) => a + c.amount, 0);
  const avgClaim = claims.length ? claimedTotal / claims.length : 0;
  // Use degraded flag if any claim log indicates degradation
  const degraded = claims.some(c => c.degraded);
  // Simple heuristic: weight balance modestly, average claim primarily
  const projection = avgClaim * 1.1 + (balance || 0) * 0.02;
  return { balance, claimedTotal, avgClaim, projection, degraded };
}
