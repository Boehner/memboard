import React, { useState } from "react";
import { getMemoryProfile } from "./api/memory";
import ConnectButton from "./components/ConnectButton";
import DataProfile from "./components/DataProfile";
import EarningsCard from "./components/EarningsCard";
import Footer from "./components/Footer";

export default function App() {
  const [wallet, setWallet] = useState("");
  const [profile, setProfile] = useState(null);

  const handleConnect = async () => {
    const data = await getMemoryProfile(wallet || "demo-wallet");
    setProfile(data);
  };

  return (
    <div className="flex flex-col items-center min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-6">MemBoard</h1>
      <p className="text-gray-400 mb-6 text-center max-w-lg">
        View your Memory data, connections, and $MEM earnings as a creator.
      </p>

      <input
        type="text"
        placeholder="Enter Memory ID or Wallet"
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
      />
      <ConnectButton onConnect={handleConnect} />

      {profile && (
        <>
          <DataProfile profile={profile} />
          <EarningsCard earnedMem={profile.earnedMem} />
        </>
      )}

      <Footer />
    </div>
  );
}