// src/components/ScoreDebugPanel.jsx
import React from "react";
import { motion } from "framer-motion";

const DIMENSION_LABELS = {
  identity: "Identity Strength",
  wallet: "Wallet Authenticity",
  social: "Social Graph Quality",
  ens: "ENS / Naming",
  memory: "Memory Activity",
  external: "External Reputation",
  overlap: "Network Overlap",
};

function formatPercent(x) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function levelLabel(norm) {
  if (norm == null) return "Unknown";
  if (norm >= 0.8) return "Strong";
  if (norm >= 0.5) return "Moderate";
  if (norm > 0.2) return "Weak";
  return "Very Weak";
}

export default function ScoreDebugPanel({ debug, address }) {
  if (!debug) {
    return (
      <div className="card-glow p-4 text-sm text-gray-400">
        <div className="card-glow-overlay" />
        <p>No score debug data available yet.</p>
        <p className="text-xs text-gray-500 mt-1">
          Connect a wallet or recompute the score to see the breakdown.
        </p>
      </div>
    );
  }

  const { score, breakdown } = debug;
  if (!breakdown) {
    return (
      <div className="card-glow p-4 text-sm text-red-300">
        <div className="card-glow-overlay" />
        <p>Score computed, but breakdown was not returned.</p>
      </div>
    );
  }

  const {
    identity,
    wallet,
    social,
    ens,
    memory,
    external,
    overlap,
    meta = {},
  } = breakdown;

  const dims = { identity, wallet, social, ens, memory, external, overlap };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-glow p-5 text-sm text-gray-200"
    >
      <div className="card-glow-overlay" />

      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Legitimacy Score Debug
          </p>
          <h2 className="text-lg font-semibold text-white">
            {address ? (
              <>
                Score for{" "}
                <span className="font-mono text-cyan-300">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
              </>
            ) : (
              "Current Wallet Score"
            )}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Final Score</p>
          <p className="text-2xl font-bold text-cyan-300 tabular-nums">
            {score}
            <span className="text-sm text-gray-500 ml-1">/100</span>
          </p>
        </div>
      </div>

      {/* Dimensions table */}
      <div className="mt-3 border border-white/10 rounded-xl overflow-hidden bg-black/30">
        <div className="grid grid-cols-12 px-3 py-2 text-[11px] text-gray-400 bg-white/5 border-b border-white/10">
          <div className="col-span-4">Component</div>
          <div className="col-span-2 text-right">Weight</div>
          <div className="col-span-2 text-right">Normalized</div>
          <div className="col-span-2 text-right">Points</div>
          <div className="col-span-2 text-right">Level</div>
        </div>

        {Object.entries(dims).map(([key, data]) => {
          if (!data) return null;
          const { normalized, weight, weighted } = data;
          const pctOfScore = weighted ?? 0; // this is already norm * weight (0–1 overall)
          return (
            <div
              key={key}
              className="grid grid-cols-12 items-center px-3 py-2 text-[12px] border-t border-white/5"
            >
              <div className="col-span-4 flex flex-col">
                <span className="font-medium text-gray-100">
                  {DIMENSION_LABELS[key] || key}
                </span>
                <span className="text-[11px] text-gray-500">
                  key: <span className="font-mono">{key}</span>
                </span>
              </div>

              <div className="col-span-2 text-right tabular-nums text-gray-300">
                {formatPercent(weight)}
              </div>

              <div className="col-span-2 text-right tabular-nums text-gray-300">
                {normalized != null ? normalized.toFixed(3) : "—"}
              </div>

              <div className="col-span-2 text-right tabular-nums">
                {/* weighted is proportion of final score (0–1) */}
                <span className="text-cyan-300">
                  {(pctOfScore * 100).toFixed(1)}
                </span>
              </div>

              <div className="col-span-2 text-right text-[11px] text-gray-300">
                {levelLabel(normalized)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual bars */}
      <div className="mt-4 space-y-2">
        {Object.entries(dims).map(([key, data]) => {
          if (!data) return null;
          const { normalized } = data;
          const label = DIMENSION_LABELS[key] || key;
          return (
            <div key={key}>
              <div className="flex justify-between text-[11px] text-gray-400 mb-0.5">
                <span>{label}</span>
                <span className="tabular-nums">
                  {normalized != null ? (normalized * 100).toFixed(1) : "—"}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all"
                  style={{ width: `${clampBarWidth(normalized)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Meta info: shows which APIs are populating correctly */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] text-gray-400">
        <MetaCard
          label="Identities"
          value={breakdown.meta?.totalIdentities ?? "—"}
          hint="Total linked identities"
        />
        <MetaCard
          label="Verified"
          value={breakdown.meta?.verifiedIdentities ?? "—"}
          hint="Verified identities via Memory"
        />
        <MetaCard
          label="Platforms"
          value={Array.isArray(breakdown.meta?.platforms)
            ? breakdown.meta.platforms.length
            : "—"}
          hint="Distinct platforms detected"
        />
        <MetaCard
          label="Avg Followers"
          value={
            breakdown.meta?.avgFollowers != null
              ? Math.round(breakdown.meta.avgFollowers)
              : "—"
          }
          hint="Across linked social identities"
        />
        <MetaCard
          label="$MEM Balance"
          value={
            breakdown.meta?.memBalance != null
              ? breakdown.meta.memBalance.toFixed
                ? breakdown.meta.memBalance.toFixed(2)
                : breakdown.meta.memBalance
              : "—"
          }
          hint="On-chain $MEM tokens detected"
        />
        <MetaCard
          label="$MEM Claims"
          value={breakdown.meta?.claimsCount ?? "-"}
          hint="RewardClaim events found"
        />
      </div>

      {/* Raw meta (dev-only glance) */}
      <details className="mt-4 text-[11px] text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300">
          Raw meta & debug JSON
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto bg-black/60 border border-white/10 rounded-lg p-2 text-[10px] text-gray-300">
{JSON.stringify(breakdown.meta ?? {}, null, 2)}
        </pre>
      </details>
    </motion.div>
  );
}

function MetaCard({ label, value, hint }) {
  return (
    <div className="metric-card relative">
      <div className="metric-card-overlay" />
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-100 tabular-nums">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

// local helper so we don't crash if normalized is undefined
function clampBarWidth(norm) {
  if (norm == null || Number.isNaN(norm)) return 0;
  const v = Math.max(0, Math.min(1, norm));
  return v * 100;
}
