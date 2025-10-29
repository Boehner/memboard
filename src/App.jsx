import React, { useState } from 'react';
import { getMemoryProfile } from './api/memory';
import ConnectButton from './components/ConnectButton';
import EarningsEstimate from './components/EarningsEstimate';
import Footer from './components/Footer';
import IdentityList from './components/IdentityList';

export default function App() {
  const [wallet, setWallet] = useState('');
  const [profile, setProfile] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className='flex flex-col items-center min-h-screen py-10 bg-[#0B0B10] text-gray-100'>
      <h1 className='text-3xl font-bold mb-3'>MemBoard</h1>
      <p className='text-gray-400 mb-8 text-center max-w-lg'>
        View your Memory data, connections, and $MEM earnings as a creator.
      </p>

      <div className='flex flex-col sm:flex-row items-center justify-center gap-2 mb-8'>
        <input
          type='text'
          placeholder='Enter Memory ID or Wallet'
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          className='w-80 h-11 px-4 rounded-lg bg-gray-900 text-gray-100
                    border border-gray-700 focus:outline-none
                    focus:ring-2 focus:ring-blue-500 placeholder-gray-500
                    transition-all sm:rounded-r-none'
        />
        <ConnectButton
          onConnect={handleConnect}
          connected={connected}
          wallet={wallet}
          loading={loading}
        />
      </div>

      {loading && (
        <p className='text-blue-400 mb-6'>Fetching Memory profile…</p>
      )}

      {profile && identities.length > 0 && (
        <>
          <div className='text-center mb-6'>
            <h2 className='text-lg font-semibold text-blue-300 break-all'>
              {wallet} Connections
            </h2>
            <p className='text-gray-400'>
              {profile.total} linked identities • {profile.verified} verified
            </p>
          </div>

          <div className='mt-6 w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 px-4'>
            <IdentityList identities={identities} />
          </div>

          <EarningsEstimate identities={identities} />
        </>
      )}

      {!loading && profile && identities.length === 0 && (
        <p className='text-gray-500 mt-10'>No linked identities found.</p>
      )}

      <Footer />
    </div>
  );
}
