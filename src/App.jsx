import React, { useState } from 'react';
import { getMemoryProfile } from './api/memory';
import ConnectButton from './components/ConnectButton';
import EarningsEstimate from './components/EarningsEstimate'; // legacy, may remove later
import Footer from './components/Footer';
import IdentityList from './components/IdentityList';
import InsightsBoard from './components/InsightsBoard';
import InfluenceScoreCard from "./components/InfluenceScoreCard";

export default function App() {
  const [wallet, setWallet] = useState('');
  const [profile, setProfile] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingWallet, setEditingWallet] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      let address = wallet;

      if (window.ethereum && !wallet) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        address = accounts[0];
        setWallet(address);
        setConnected(true);
      }

      const data = await getMemoryProfile(address);
      setProfile(data);
      setIdentities(data.identities || []);
      setConnected(true);
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Unable to connect or fetch Memory profile.');
    } finally {
      setLoading(false);
    }
  };
  const handleDisconnect = () => {
    // Clear session state
    setConnected(false);
    setProfile(null);
    setIdentities([]);
    // Preserve entered wallet text so user can quickly reconnect or change
    // Optionally clear wallet: uncomment next line if full reset desired
    // setWallet('');
    setEditingWallet(true);
  };

  const startEditing = () => {
    setEditingWallet(true);
    setConnected(false); // allow reconnection attempt
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111827] to-[#1f2937] text-gray-100 px-4 py-10">
  <div className="card-glow p-8 w-full max-w-xl mb-10">
    <div className="card-glow-overlay" />
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-4 text-center">
          MemBoard
        </h1>
        <p className="text-gray-400 text-lg mb-6 text-center">
          Connect your wallet, visualize your identity graph, and explore $MEM rewards.
        </p>
        {!connected || editingWallet ? (
          <div className="flex flex-col sm:flex-row w-full rounded-xl border border-white/10 overflow-hidden focus-within:ring-2 focus-within:ring-cyan-400/70 focus-within:shadow-[0_0_0_2px_rgba(34,211,238,0.3)] transition">
            <input
              type="text"
              placeholder="Enter wallet or ENS"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="flex-1 h-12 px-4 bg-black/30 text-white placeholder-gray-400 focus:outline-none text-base leading-none sm:border-r sm:border-white/10"
            />
            <ConnectButton
              onConnect={handleConnect}
              connected={connected && !editingWallet}
              wallet={wallet}
              loading={loading}
              className="h-12 w-full sm:w-auto sm:min-w-[140px]"
            />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-gray-500 text-center">Connect your wallet or paste any address / ENS to explore its Memory graph.</p>
        {connected && wallet && !editingWallet && (
          <div className="mt-4 flex items-center justify-center gap-3 text-xs">
            <span className="text-green-400 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Connected: <span className="font-medium">{wallet.length > 12 ? wallet.slice(0,6) + '...' + wallet.slice(-4) : wallet}</span>
            </span>
            <button
              onClick={handleDisconnect}
              className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-cyan-400/40 transition-colors"
            >
              Disconnect
            </button>
            <button
              onClick={startEditing}
              className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-purple-400/40 transition-colors"
            >
              Change
            </button>
          </div>
        )}
        {loading && (
          <p className="text-cyan-400 mt-6 text-center">Fetching Memory profile…</p>
        )}
      </div>


      {profile && identities.length > 0 && (
        <div className="w-full flex flex-col items-center">
          <div className='text-center mb-8'>
            <h2 className='text-lg font-semibold text-cyan-300 break-all'>
              {wallet} Connections
            </h2>
            <p className='text-gray-400'>
              {profile.total} linked identities • {profile.verified} verified
            </p>
          </div>

          <div className="mb-10">
            <InfluenceScoreCard legitimacyScore={87} />
          </div>

          <InsightsBoard identities={identities} wallet={wallet} />
        </div>
      )}


      {!loading && profile && identities.length === 0 && (
        <p className='text-gray-500 mt-10'>No linked identities found.</p>
      )}



      <div className="mt-auto w-full">
        <Footer />
      </div>
    </div>
  );
}
