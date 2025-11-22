// api/provider.js
import { ethers } from "ethers";

// Base chain RPC rotation (for Base on-chain data)
const BASE_RPC_ENDPOINTS = [
  import.meta.env.VITE_PUBLIC_RPC,
  import.meta.env.VITE_PUBLIC_RPC_FALLBACK,
  "https://mainnet.base.org",
].filter(Boolean);

let baseRpcIndex = 0;

export function getSharedProvider() {
  return new ethers.JsonRpcProvider(
    BASE_RPC_ENDPOINTS[baseRpcIndex % BASE_RPC_ENDPOINTS.length]
  );
}

export function rotateProvider() {
  baseRpcIndex++;
}

// Ethereum mainnet RPC endpoints for ENS resolution. Order matters for rotation.
const ETH_MAINNET_RPCS = [
  import.meta.env.VITE_ETH_MAINNET_RPC, // primary (Alchemy/Infura or custom) - may rate limit
  import.meta.env.VITE_ETH_MAINNET_RPC_FALLBACK, // secondary user-provided
  "https://cloudflare-eth.com", // public fallback
  "https://rpc.ankr.com/eth", // public aggregated
].filter(Boolean);

let ethRpcIndex = 0;
let currentEthProvider;

function buildEthProvider(rpcUrl) {
  try {
    return new ethers.JsonRpcProvider(rpcUrl);
  } catch (e) {
    console.warn("Failed to build eth provider for", rpcUrl, e);
    return null;
  }
}

export function getEthereumProvider() {
  if (!currentEthProvider) {
    // Initialize first available
    for (let i = 0; i < ETH_MAINNET_RPCS.length; i++) {
      const p = buildEthProvider(ETH_MAINNET_RPCS[i]);
      if (p) {
        ethRpcIndex = i;
        currentEthProvider = p;
        break;
      }
    }
    if (!currentEthProvider) {
      // Final fallback: default provider (aggregates multiple services, may need env keys)
      currentEthProvider = ethers.getDefaultProvider("mainnet");
    }
  }
  return currentEthProvider;
}

export function rotateEthereumProvider() {
  if (!ETH_MAINNET_RPCS.length) return currentEthProvider || ethers.getDefaultProvider("mainnet");
  ethRpcIndex = (ethRpcIndex + 1) % ETH_MAINNET_RPCS.length;
  const next = buildEthProvider(ETH_MAINNET_RPCS[ethRpcIndex]);
  if (next) currentEthProvider = next;
  return currentEthProvider;
}
