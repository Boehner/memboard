// App.jsx — FULL UPDATED FILE
// Includes RecommendedMatches + Shared Creator Matching UI

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

import { getMemoryProfile } from "./api/memory";
import { estimateUpcomingRewards } from "./api/memRewards";
import { gatherLegitimacyInputs } from "./api/scoreServices";

import ConnectButton from "./components/ConnectButton";
import Footer from "./components/Footer";
import InsightsBoard from "./components/InsightsBoard";
import InfluenceScoreCard from "./components/InfluenceScoreCard";
import ScoreDebugPanel from "./components/ScoreDebugPanel";
import WhyMyScore from "./components/WhyMyScore";
import BatchScoreComponent from "./components/BatchScoreComponent";
import ScoreBox from "./components/ScoreBox";

// NEW MATCHING FEATURE
import RecommendedMatches from "./components/RecommendedMatches";

import {
  computeLegitimacyScore,
  explainLegitimacyScore,
} from "./utils/computeLegitimacyScore";

export default function App() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [onchainData, setOnchainData] = useState(null);
  const [legitimacyScore, setLegitimacyScore] = useState(0);
  const [legitimacyBreakdown, setLegitimacyBreakdown] = useState(null);
  const [rpcDegraded, setRpcDegraded] = useState(false);
  const [scoreDebug, setScoreDebug] = useState(null);
  const [whyExpanded, setWhyExpanded] = useState(false);

  // Close WhyMyScore on ESC
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") setWhyExpanded(false);
    }
    if (whyExpanded) {
      window.addEventListener("keydown", handler);
    }
    return () => window.removeEventListener("keydown", handler);
  }, [whyExpanded]);

  // Fetch Memory profile & rewards when wallet connects
  useEffect(() => {
    if (!isConnected || !address) {
      setProfile(null);
      setIdentities([]);
      setOnchainData(null);
      setLegitimacyScore(0);
      setRpcDegraded(false);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const data = await getMemoryProfile(address);
        if (!active) return;

        const ids = data.identities || [];
        setProfile(data);
        setIdentities(ids);

        const rewards = await estimateUpcomingRewards(address);
        if (!active) return;
        setOnchainData(rewards);

        if (rewards?.degraded) setRpcDegraded(true);
        else setRpcDegraded(false);

        const inputs = await gatherLegitimacyInputs(address, data);

        const options = {
          thresholds: {
            walletAgeDaysForFull: 365,
            walletTxFull: 250,
            memBalanceForFull: 15000,
            platformSoftCap: 5,
            platformHardCap: 10,
          },
          stats: {
            txCountQuantiles: { p50: 12, p75: 55, p90: 200 },
            followerLogQuantiles: { p50: 1.5, p75: 3.2, p90: 5.0 },
          },
          weights: {
            identity: 0.32,
            wallet: 0.23,
            social: 0.17,
            ens: 0.09,
            memory: 0.12,
            external: 0.04,
            overlap: 0.03,
          },
        };

        const score = computeLegitimacyScore(inputs, options);
        const result = explainLegitimacyScore(inputs, options);

        setLegitimacyScore(score);
        setLegitimacyBreakdown(result.breakdown);
        setScoreDebug({ ...result, address });
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [isConnected, address]);

  // -------------------------------------------------
  // RENDER UI
  // -------------------------------------------------

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111827] to-[#1f2937] text-gray-100 px-4 py-10">

      {/* ---------------- HEADER ---------------- */}
      <div className="card-glow p-8 w-full max-w-xl mb-10 relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-4 text-center">
          MemBoard
        </h1>

        <p className="text-gray-400 text-lg mb-6 text-center">
          Connect your wallet, visualize your identity graph, and explore $MEM rewards.
        </p>

        <div className="flex items-center justify-center mb-4">
          <ConnectButton />
        </div>

        {isConnected && address && (
          <div className="mt-2 flex items-center justify-center gap-3 text-xs">
            <span className="text-green-400 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Connected:{" "}
              <span className="font-medium">
                {address.length > 12
                  ? address.slice(0, 6) + "..." + address.slice(-4)
                  : address}
              </span>
            </span>

            {rpcDegraded && (
              <span
                className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-300 flex items-center gap-1"
                title="RPC rotated after retries; data may be partial."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> RPC degraded
              </span>
            )}
          </div>
        )}

        {loading && (
          <p className="text-cyan-400 mt-6 text-center">
            Fetching Memory profile…
          </p>
        )}
      </div>

      {/* ---------------- MAIN CONTENT ---------------- */}
      {isConnected && profile && identities.length > 0 && (
        <div className="w-full flex flex-col items-center">

          {/* Identity overview */}
          <div className="text-center mb-8">
            <h2 className="text-lg font-semibold text-cyan-300 break-all">
              Connections
            </h2>
            <p className="text-gray-400">
              {profile.total} linked identities • {profile.verified} verified
            </p>
          </div>

          {/* Influence Score */}
          <div className="mb-10">
            <InfluenceScoreCard
              legitimacyScore={legitimacyScore}
              onInfoClick={() => setWhyExpanded((v) => !v)}
            />
          </div>

          {/* Insights Graph */}
          <InsightsBoard identities={identities} wallet={Address} />

          {/* -------------------------------------------------- */}
          {/* 🔥 NEW: RECOMMENDED MATCHES SECTION (Shared Creators) */}
          {/* -------------------------------------------------- */}
          <div className="w-full max-w-xl mt-12">
            <h2 className="text-xl font-semibold text-purple-300 mb-3 text-center">
              People Like You
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Based on shared creators, shared graph signals, and identity overlap.
            </p>

            <RecommendedMatches userWallet={address} />
          </div>

          {/* Why My Score Modal */}
          <WhyMyScore
            breakdown={legitimacyBreakdown}
            score={legitimacyScore}
            expanded={whyExpanded}
            onClose={() => setWhyExpanded(false)}
          />
        </div>
      )}

      {isConnected && !loading && profile && identities.length === 0 && (
        <p className="text-gray-500 mt-10">No linked identities found.</p>
      )}

      <div className="mt-auto w-full">
        <Footer />
      </div>
    </div>
  );
}
