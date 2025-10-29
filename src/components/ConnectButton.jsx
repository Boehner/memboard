import React from "react";

export default function ConnectButton({ onConnect, connected, wallet, loading }) {
  const shortWallet =
    wallet && wallet.length > 10
      ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
      : wallet;

  return (
    <button
      onClick={onConnect}
      disabled={loading}
      className={`h-11 px-5 rounded-lg sm:rounded-l-none font-semibold transition-all duration-300 ${
        connected
          ? "bg-green-600 hover:bg-green-700 text-white"
          : "bg-blue-600 hover:bg-blue-700 text-white"
      } ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
    >
      {loading
        ? "Loading..."
        : connected && wallet
        ? `Connected: ${shortWallet}`
        : "Connect Memory ID / Wallet"}
    </button>
  );
}
