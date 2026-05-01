import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

import { getMemoryProfile } from "./api/memory";
import { estimateUpcomingRewards } from "./api/memRewards";
import { gatherLegitimacyInputs } from "./api/scoreServices";
import ConnectButton from "./components/ConnectButton";
import Footer from "./components/Footer";
import InsightsBoard from "./components/InsightsBoard";
import InfluenceScoreCard from "./components/InfluenceScoreCard";
import WhyMyScore from "./components/WhyMyScore";
import GraphSummary from "./components/GraphSummary";
import RecommendedMatches from "./components/RecommendedMatches";
import ProofCreator from "./components/ProofCreator";
import ProofsPanel from "./components/ProofsPanel";
import RecentClaims from "./components/RecentClaims";
import {
  computeLegitimacyScore,
  explainLegitimacyScore,
} from "./utils/computeLegitimacyScore";
import Feed from "./pages/Feed";

export default function App() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [legitimacyScore, setLegitimacyScore] = useState(0);
  const [legitimacyBreakdown, setLegitimacyBreakdown] = useState(null);
  const [legitimacyInputs, setLegitimacyInputs] = useState(null);
  const [rpcDegraded, setRpcDegraded] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [page, setPage] = useState("dashboard"); // 'dashboard' | 'feed'
  const ENV = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  const ENABLE_FEED_NAV = (typeof ENV !== 'undefined' && ENV.VITE_ENABLE_FEED_NAV);
  const ENABLE_PROOFS = (typeof ENV !== 'undefined' && ENV.VITE_ENABLE_PROOFS_PANEL === 'true');
console.log("FEED NAV ENABLED:", ENV.VITE_ENABLE_FEED_NAV);
  // Close WhyMyScore on ESC
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") setWhyExpanded(false);
    }
    if (whyExpanded) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [whyExpanded]);

  // Fetch Memory profile & rewards when wallet connects
  useEffect(() => {
    if (!isConnected || !address) {
      setProfile(null);
      setIdentities([]);
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

        setProfile(data);
        setIdentities(data.identities || []);

        const rewards = await estimateUpcomingRewards(address);
        if (!active) return;
        setRpcDegraded(!!rewards?.degraded);

        const inputs = await gatherLegitimacyInputs(address, data);
        if (!active) return;
        setLegitimacyInputs(inputs);

        const options = {
          thresholds: {
            walletAgeDaysForFull: 365,
            walletTxFull: 250,
            platformSoftCap: 5,
            platformHardCap: 10,
          },
          stats: {
            txCountQuantiles: { p50: 12, p75: 55, p90: 200 },
            followerLogQuantiles: { p50: 1.5, p75: 3.2, p90: 5.0 },
          },
          weights: {
            identity: 0.35,
            wallet: 0.28,
            social: 0.17,
            ens: 0.11,
            external: 0.05,
            overlap: 0.04,
          },
        };

        const score = computeLegitimacyScore(inputs, options);
        const result = explainLegitimacyScore(inputs, options);

        setLegitimacyScore(score);
        setLegitimacyBreakdown(result.breakdown);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111827] to-[#1f2937] text-gray-100 px-4 pt-4 pb-8">

      {/* ===================== */}
      {/* 🔹 APP HEADER */}
      {/* ===================== */}
      <header className="w-full max-w-xl mx-auto flex items-center justify-between mb-4">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2"
          aria-label="Go to home"
        >
          <img
            src="/icon.png"
            alt="MemBoard"
            className="block h-12 w-12"
          />
        </button>
        <div className="flex items-center gap-3">
          {isConnected && ENABLE_FEED_NAV && (
            <button
              onClick={() => setPage(page === 'feed' ? 'dashboard' : 'feed')}
              className="text-xs px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              {page === 'feed' ? 'Back to Dashboard' : 'Open Feed'}
            </button>
          )}
          <ConnectButton />
        </div>
      </header>

      {!isConnected && (
        <div className="card-glow p-8 w-full max-w-xl mx-auto mb-8 mt-2 rounded-2xl border border-white/10 bg-black/30">
          <p className="text-gray-400 text-lg mb-6 text-center">
            Connect your wallet, visualize your identity graph, and explore $MEM rewards.
          </p>

          {isConnected && address && (
            <div className="mt-2 flex items-center justify-center gap-3 text-xs">
              <span className="text-green-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Connected:{" "}
                <span className="font-medium">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
              </span>

              {rpcDegraded && (
                <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-300">
                  RPC degraded
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
      )}

      {/* ===================== */}
      {/* 🔹 MAIN CONTENT */}
      {/* ===================== */}
      {page === 'dashboard' && isConnected && !loading && legitimacyInputs && (
        <div className="w-full flex flex-col items-center">

          {identities.length > 0 && (
            <div className="text-center mb-8">
              <h2 className="text-lg font-semibold text-cyan-300">
                Connections
              </h2>
              <p className="text-gray-400">
                {profile.total} linked identities • {profile.verified} verified
              </p>
            </div>
          )}

          <div className="mb-10">
            <InfluenceScoreCard
              legitimacyScore={legitimacyScore}
              onInfoClick={() => setWhyExpanded(v => !v)}
            />
          </div>

          <InsightsBoard identities={identities} wallet={address} />

          <GraphSummary inputs={legitimacyInputs} />

          {ENABLE_PROOFS && (
            <div className="w-full max-w-xl mt-8">
              <div className="card-glow p-6 rounded-2xl border border-white/10 bg-white/5 shadow-xl">
                <ProofCreator inputs={legitimacyInputs} embedded />
                <div className="mt-6">
                  <ProofsPanel embedded />
                </div>
              </div>
            </div>
          )}

          {legitimacyInputs?.onchainData?.claims?.length > 0 && (
            <div className="w-full max-w-xl mt-8">
              <RecentClaims claims={legitimacyInputs.onchainData.claims} />
            </div>
          )}

          {/* <div className="w-full max-w-xl mt-12">
            <h2 className="text-xl font-semibold text-purple-300 mb-3 text-center">
              People Like You
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Based on shared creators, shared graph signals, and identity overlap.
            </p>

            <RecommendedMatches
              userWallet={address}
              userProfile={profile}
            />
          </div> */}

          <WhyMyScore
            breakdown={legitimacyBreakdown}
            score={legitimacyScore}
            expanded={whyExpanded}
            onClose={() => setWhyExpanded(false)}
          />
        </div>
      )}

      {page === 'feed' && isConnected && (
        <div className="w-full max-w-4xl mx-auto">
          <Feed wallet={address} userProfile={profile} />
        </div>
      )}

      <div className="mt-16">
        <Footer />
      </div>
    </div>
  );
}
