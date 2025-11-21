import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from './components/ErrorBoundary';
import "./index.css";
import '@rainbow-me/rainbowkit/styles.css';

import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';

// WalletConnect project ID must be supplied via environment variable
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  console.error('[MemBoard] Missing VITE_WALLETCONNECT_PROJECT_ID in .env. WalletConnect wallets will fail to initialize.');
}

const config = getDefaultConfig({
  appName: 'MemBoard',
  projectId: projectId || 'missing-project-id', // RainbowKit requires a string; we log error above if missing
  chains: [base, mainnet, polygon, optimism, arbitrum],
  initialChain: base,
  ssr: false,
});

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