import React from "react";

export default function ConnectButton({ onConnect, connected, wallet, loading, className = '' }) {
  const shortWallet = wallet && wallet.length > 10 ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet;

  const baseClasses = "h-12 px-6 font-semibold transition-all duration-300 focus:outline-none text-base leading-none";
  const stateClasses = connected
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-gradient-to-r from-cyan-400 to-purple-500 text-white hover:opacity-90";
  const disabledClasses = loading ? "opacity-70 cursor-not-allowed" : "";

  const label = loading
    ? 'Loading...'
    : connected && wallet
    ? `Connected: ${shortWallet}`
    : 'Connect';

  return (
    <button
      onClick={!connected ? onConnect : undefined}
      disabled={loading || connected}
      className={`${baseClasses} ${stateClasses} ${disabledClasses} ${className} ${connected ? 'cursor-default opacity-90 ring-1 ring-green-500/40' : ''}`}
      aria-disabled={loading || connected}
    >
      {label}
    </button>
  );
}
