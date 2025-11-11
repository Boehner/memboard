import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import IdentityList from './IdentityList';
import CountUp from 'react-countup';

// Simple platform weight mapping
const PLATFORM_WEIGHTS = {
  twitter: 1.2,
  lens: 1.15,
  farcaster: 1.1,
  github: 1.05,
  zora: 1.1,
  ethereum: 1.0,
  ens: 1.0,
  email: 0.5,
  website: 0.6,
  'talent-protocol': 1.0,
  default: 0.8,
};

function computeStats(identities = []) {
  let totalFollowers = 0;
  let verifiedCount = 0;
  const platformContribution = {};

  identities.forEach((id) => {
    const followers = id.social?.followers || 0;
    const verified = id.sources?.some((s) => s.verified);
    const weight = PLATFORM_WEIGHTS[id.platform] || PLATFORM_WEIGHTS.default;
    if (verified) verifiedCount += 1;
    totalFollowers += followers;
    const contribution = weight * (verified ? 1.2 : 1) * (Math.log10(followers + 10));
    platformContribution[id.platform] = (platformContribution[id.platform] || 0) + contribution;
  });

  const totalContribution = Object.values(platformContribution).reduce((a, b) => a + b, 0) || 1;
  const pieData = Object.entries(platformContribution).map(([platform, value]) => ({
    platform,
    value,
    pct: value / totalContribution,
  }));

  // Estimated MEM formula (placeholder)
  const estimatedMem = (verifiedCount * 5 + totalContribution * 2).toFixed(2);

  return { totalFollowers, verifiedCount, pieData, estimatedMem };
}

// Removed PieChart in favor of readable breakdown bars.

import { estimateUpcomingRewards, MEM_CONTRACT_ADDRESS } from '../api/memRewards';

export default function InsightsBoard({ identities, wallet }) {
  const { totalFollowers, verifiedCount, pieData, estimatedMem } = useMemo(() => computeStats(identities), [identities]);
  const topPlatforms = useMemo(() => {
    return [...pieData]
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [pieData]);

  const [onChain, setOnChain] = useState(null);
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!wallet || wallet.length < 8) return;
      if (MEM_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') return; // skip placeholder
      const data = await estimateUpcomingRewards(wallet);
      if (mounted) setOnChain(data);
    }
    run();
    return () => { mounted = false; };
  }, [wallet]);

  return (
    <div className="w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
      {/* Earnings Panel (Redesigned) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
  className="card-glow p-6 max-w-lg w-full mx-auto text-center"
      >
        <div className="card-glow-overlay" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-cyan-400/10 via-transparent to-purple-600/10" />
        <h2 className="text-xl font-semibold text-white mb-2">Creator Rewards Overview</h2>
        <p className="text-gray-400 text-sm mb-6">
          Calculated using verified connections, engagement, and Memory graph influence.
        </p>
        <div className="flex justify-center mb-6">
          <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)]">
            <div className="absolute inset-[2px] rounded-full bg-[#0b0f19]" />
            <div className="relative z-10 text-white">
              <p className="text-lg font-medium">Total</p>
              <p className="text-3xl font-bold">${onChain?.projection?.toFixed(2) || estimatedMem}</p>
              <p className="text-sm text-cyan-300">$MEM</p>
            </div>
          </div>
        </div>
        <p className="text-gray-400 text-sm mb-8">
          Projected next reward tier in {Math.max(1, 5 - verifiedCount)} verified interactions.
        </p>
        <div className="grid grid-cols-2 gap-3 text-left text-gray-300 mb-4">
          <div className="metric-card group">
            <div className="metric-card-overlay" />
            <p className="text-sm text-gray-400">Verified Platforms</p>
            <p className="text-lg font-semibold text-white">{verifiedCount}</p>
          </div>
          <div className="metric-card group">
            <div className="metric-card-overlay" />
            <p className="text-sm text-gray-400">Followers</p>
            <p className="text-lg font-semibold text-white">{totalFollowers.toLocaleString()}</p>
          </div>
          <div className="metric-card group">
            <div className="metric-card-overlay" />
            <p className="text-sm text-gray-400">Engagement Rank</p>
            <p className="text-lg font-semibold text-white">Top 12%</p>
          </div>
          <div className="metric-card group">
            <div className="metric-card-overlay" />
            <p className="text-sm text-gray-400">Cross-Protocol Links</p>
            <p className="text-lg font-semibold text-white">{identities.length}</p>
          </div>
          {onChain && (
            <div className="metric-card group col-span-2">
              <div className="metric-card-overlay" />
              <p className="text-sm text-gray-400">On-chain Balance / Claimed</p>
              <p className="text-lg font-semibold text-white flex gap-4">
                <span>{onChain.balance?.toFixed(2)} MEM</span>
                <span className="text-gray-400 text-sm">claimed {onChain.claimedTotal.toFixed(2)} MEM</span>
              </p>
            </div>
          )}
        </div>
        {/* Platform influence breakdown */}
        <div className="mt-2 text-left">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Top Platform Influence</p>
          <div className="space-y-1">
            {topPlatforms.map((p) => {
              const pct = Math.round(p.pct * 100);
              return (
                <div key={p.platform} className="flex items-center gap-2">
                  <div className="h-2 flex-1 bg-white/10 rounded overflow-hidden">
                    <div
                      className="h-full rounded bg-gradient-to-r from-cyan-400 to-purple-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-300 w-20 truncate">{p.platform}</span>
                  <span className="text-[11px] text-gray-400 tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Identity Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
  className="card-glow p-6"
      >
        <div className="card-glow-overlay" />
        <h3 className="text-xl font-semibold mb-4 text-gray-100">Linked Identities</h3>
        <div>
          <IdentityList identities={identities} />
        </div>
        <p className="text-xs text-gray-500 mt-5">Hover cards for follower counts & profile links.</p>
      </motion.div>
    </div>
  );
}
