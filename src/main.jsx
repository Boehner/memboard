import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from './components/ErrorBoundary';
import "./index.css";
import '@rainbow-me/rainbowkit/styles.css';

import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';

// WalletConnect project ID must be supplied via environment variable
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  console.error('[MemBoard] Missing VITE_WALLETCONNECT_PROJECT_ID in .env. WalletConnect wallets will fail to initialize.');
}

const baseRpc = import.meta.env.VITE_PUBLIC_RPC;

const config = getDefaultConfig({
  appName: 'MemBoard',
  projectId: projectId || 'missing-project-id',
  chains: [base, mainnet, polygon, optimism, arbitrum],
  initialChain: base,
  transports: {
    [base.id]: http(baseRpc || 'https://mainnet.base.org'),
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http()
  },
  ssr: false,
});

console.log('[MemBoard] Wagmi config connectors:', config.connectors?.map(c => c.id));

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

// Notify Farcaster frame/miniapp host that the app is ready to hide the splash.
// Try local package first, then fallback to CDN.
async function notifyFarcasterReady() {
  try {
    let sdk;
    try {
      sdk = await import('@farcaster/miniapp-sdk');
    } catch (err) {
      // fallback to CDN
      sdk = await import('https://esm.sh/@farcaster/miniapp-sdk');
    }

    // Allow the app a moment to finish rendering
    setTimeout(() => {
      try {
        sdk?.sdk?.actions?.ready?.();
        console.log('[MemBoard] Farcaster miniapp sdk.actions.ready() called');
      } catch (e) {
        console.warn('[MemBoard] Unable to call sdk.actions.ready()', e);
      }
    }, 300);
  } catch (err) {
    console.warn('[MemBoard] Farcaster SDK not available:', err);
  }
}

notifyFarcasterReady();