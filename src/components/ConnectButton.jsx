import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Custom styled RainbowKit Connect button to match site gradient and sizing.
export default function GradientConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
        authenticationStatus,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && account && chain;

        const baseClasses = 'h-12 px-6 font-semibold text-sm rounded-xl inline-flex items-center gap-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:shadow-[0_0_0_2px_rgba(34,211,238,0.3)] disabled:opacity-60 disabled:cursor-not-allowed';
        const gradient = 'bg-gradient-to-r from-cyan-400 to-purple-500 text-white hover:opacity-90';
        const neutral = 'bg-black/40 border border-white/10 text-gray-200 hover:border-cyan-400/40';
        const pill = 'rounded-xl';

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              type="button"
              className={`${baseClasses} ${gradient} ${pill}`}
              disabled={!ready}
            >
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              className={`${baseClasses} bg-red-600 hover:bg-red-700 text-white ${pill}`}
            >
              Wrong Network
            </button>
          );
        }

        return (
          <div style={{ display: ready ? 'inline-flex' : 'none' }} className="items-center gap-3">
            <button
              onClick={openChainModal}
              className={`${baseClasses} ${neutral} ${pill} pr-4 pl-3`}
              type="button"
            >
              {chain.hasIcon && chain.iconUrl && (
                <span className="w-5 h-5 inline-flex items-center justify-center rounded-full overflow-hidden bg-white/10">
                  <img alt={chain.name ?? 'Chain icon'} src={chain.iconUrl} className="w-5 h-5" />
                </span>
              )}
              <span className="text-xs font-medium">{chain.name}</span>
            </button>
            <button
              onClick={openAccountModal}
              type="button"
              className={`${baseClasses} ${gradient} ${pill}`}
            >
              <span className="font-medium">
                {account.displayName}
              </span>
              <span className="text-xs opacity-80 hidden sm:inline">{account.displayBalance ? account.displayBalance : ''}</span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
