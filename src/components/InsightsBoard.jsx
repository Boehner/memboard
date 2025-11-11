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
import { computeEngagementRank } from '../utils/computeEngagementRank';

export default function InsightsBoard({ identities, wallet }) {
  const { totalFollowers, verifiedCount, pieData, estimatedMem } = useMemo(() => computeStats(identities), [identities]);
  const topPlatforms = useMemo(() => {
    return [...pieData]
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [pieData]);

  const [onChain, setOnChain] = useState(null);
  const [timerDone, setTimerDone] = useState(false);
  const [onChainLoaded, setOnChainLoaded] = useState(false);
  // Fetch on-chain data
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!wallet) return;
      if (MEM_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') return; // skip placeholder
      const data = await estimateUpcomingRewards(wallet);
      if (mounted) {
        setOnChain(data);
        setOnChainLoaded(true);
      }
    }
    run();
    return () => { mounted = false; };
  }, [wallet]);

  // Minimum 2s loader display per wallet change
  useEffect(() => {
    setTimerDone(false);
    setOnChain(null);
    setOnChainLoaded(false);
    const t = setTimeout(() => setTimerDone(true), 2000);
    return () => clearTimeout(t);
  }, [wallet]);

  const engagement = useMemo(() => computeEngagementRank({ identities, onChain }), [identities, onChain]);

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
          <div className="group relative w-48 h-48 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-[0_0_32px_rgba(139,92,246,0.5)]">
            <div className="absolute inset-[3px] rounded-full bg-[#0b0f19]" />
            {/* Wave animation overlay while loading (persists until both data & timer ready) */}
            {!(timerDone && onChainLoaded) && (
              <div className="absolute inset-[3px] rounded-full overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-purple-600/40 via-cyan-500/40 to-transparent animate-waveRise" />
                <svg className="absolute bottom-0 left-0 w-full h-24 animate-waveMove" preserveAspectRatio="none" viewBox="0 0 400 100">
                  <path d="M0 50 Q 50 20 100 50 T 200 50 T 300 50 T 400 50 V100 H0 Z" fill="url(#waveGrad)" opacity="0.45" />
                  <defs>
                    <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            )}
            <div className="relative z-10 text-white flex flex-col items-center">
              <p className="text-[11px] tracking-wide uppercase text-cyan-200/80">Projected Rewards</p>
              <p className="text-4xl font-bold leading-tight tabular-nums">
                {(() => {
                  const val = onChain?.projection ?? Number(estimatedMem);
                  if (val < 0.01) return '<0.01';
                  return val.toFixed(4);
                })()}
              </p>
              <p className="text-sm font-medium text-cyan-300">MEM</p>
              {!(timerDone && onChainLoaded) && (
                <p className="mt-1 text-[10px] text-gray-400 animate-pulse">loading on-chain data…</p>
              )}
            </div>
            {/* Tooltip breakdown */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 translate-y-full w-64 p-3 rounded-xl bg-black/80 border border-white/10 text-left text-[11px] leading-relaxed z-20">
              <p className="text-cyan-300 font-semibold mb-1">Projection Breakdown</p>
              {onChain ? (
                <>
                  <p><span className="text-gray-400">Balance:</span> {onChain.balance?.toFixed(2) || '0.00'} MEM</p>
                  <p><span className="text-gray-400">Avg Claim:</span> {onChain.avgClaim?.toFixed(2) || '0.00'} MEM</p>
                  <p><span className="text-gray-400">Formula:</span> avgClaim * 1.1 + balance * 0.02</p>
                </>
              ) : (
                <p className="text-gray-400">Waiting for on-chain balance & recent claim logs from Base network…</p>
              )}
              <p className="mt-2 text-[10px] text-gray-500">Experimental; not financial advice.</p>
            </div>
          </div>
        </div>
        {/* Reward tier heuristic */}
        {(() => {
          const TIERS = [
            { name: 'Starter', min: 0, max: 2 },
            { name: 'Builder', min: 3, max: 5 },
            { name: 'Creator', min: 6, max: 9 },
            { name: 'Influencer', min: 10, max: Infinity },
          ];
          const current = TIERS.find(t => verifiedCount >= t.min && verifiedCount <= t.max) || TIERS[0];
          const currentIndex = TIERS.indexOf(current);
          const next = TIERS[currentIndex + 1];
          let remaining = null;
          if (next) {
            remaining = Math.max(0, next.min - verifiedCount);
          }
          return (
            <p className="text-gray-400 text-sm mb-8">
              Current tier: <span className="text-cyan-300 font-medium">{current.name}</span>
              {next && remaining > 0 && (
                <> • {remaining} more verified connection{remaining === 1 ? '' : 's'} to reach <span className="text-purple-300 font-medium">{next.name}</span></>
              )}
              {!next && ' • Max tier reached'}
            </p>
          );
        })()}
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
            <p className="text-lg font-semibold text-white flex items-center gap-2">
              <span>{engagement.label}</span>
              <span className="text-[11px] text-cyan-300 tabular-nums">{engagement.percentileApprox <= 1 ? 'Top 1%' : `Top ${Math.max(2, engagement.percentileApprox)}%`}</span>
            </p>
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
