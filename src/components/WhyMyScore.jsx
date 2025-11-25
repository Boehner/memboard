import { buildIntegrityActions } from "../utils/integrityActions";
import { computeIntegrityBadges } from "../utils/integrityBadges";
import IntegrityBadges from "../components/IntegrityBadges";
import TierBadge from "../components/TierBadge";
import TierXPBar from "../components/TierXPBar";

export default function WhyMyScore({
  score,
  breakdown,
  expanded = true,
  onClose,
}) {
  if (!breakdown || !expanded) return null;

  const meta = breakdown.meta || {};
  const actions = buildIntegrityActions({ score, breakdown });

  const getSignalColor = (value) => {
    if (value >= 75) return "text-cyan-300";
    if (value >= 45) return "text-amber-300";
    return "text-rose-400";
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto p-5">
      {/* BACKDROP */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onClose && onClose()}
        aria-hidden="true"
      />

      {/* MODAL */}
      <div className="relative card-glow w-full max-w-3xl mx-auto p-6 rounded-2xl border border-white/10 bg-black/40 shadow-xl">
        <div className="card-glow-overlay" />

        {/* CLOSE */}
        <button
          onClick={() => onClose && onClose()}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white/80"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-5 text-white tracking-wide">
          Why is my score {score}?
        </h2>
         <div className="mb-4">
            <TierBadge score={score} />
            <TierXPBar score={score} />
          </div>
        <IntegrityBadges badges={computeIntegrityBadges(breakdown)} />

        {/* ========================================================= */}
        {/* TOP SECTION: INTEGRITY ACTION ENGINE (PRIMARY CONTENT)   */}
        {/* ========================================================= */}
        <div className="mt-6 space-y-4">
          {actions.map((dim) => (
            <div
              key={dim.key}
              className="bg-white/5 p-4 rounded-lg border border-white/10"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">{dim.label}</span>
                <span className="text-xs uppercase tracking-wide opacity-70">
                  {dim.severity} • Priority {(dim.priority * 100).toFixed(1)}
                </span>
              </div>

              <p className="text-sm opacity-80 mb-3">{dim.summary}</p>

              <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
                {dim.actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* COLLAPSIBLE COMPONENT BREAKDOWN                           */}
        {/* ========================================================= */}
        <details className="mt-10 bg-black/30 rounded-lg border border-white/10 p-4">
          <summary className="cursor-pointer text-white font-medium text-lg">
            Component Breakdown
          </summary>

          <div className="mt-4 space-y-4">
            {Object.entries(breakdown).map(([key, dim]) => {
              if (key === "meta") return null;
              if (!dim || typeof dim.normalized !== "number") return null;

              const pct = Math.round(dim.normalized * 100);
              const contrib = Math.round(dim.weighted * 100);
              const label =
                key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();

              return (
                <div
                  key={key}
                  className="bg-white/5 p-4 rounded-lg border border-white/10"
                >
                  {/* HEADER */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-white">{label}</span>
                    <span
                      className={`text-xs font-semibold ${getSignalColor(pct)}`}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* BAR */}
                  <div className="relative w-full h-3 rounded-full bg-white/10 overflow-hidden mb-2">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-fuchsia-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* CONTRIBUTION */}
                  <div className="text-xs text-gray-400">
                    Contributes{" "}
                    <strong className="text-cyan-300">{contrib}</strong> points
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        {/* ========================================================= */}
        {/* META INFORMATION                                          */}
        {/* ========================================================= */}
        <div className="mt-10 p-5 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-semibold mb-3 text-white">
            Additional Factors
          </h3>
          <ul className="text-sm opacity-80 space-y-1">
            <li>
              Platforms Connected: <strong>{meta.platformCountRaw}</strong>
            </li>
            <li>
              Verified Identities: <strong>{meta.verifiedIdentities}</strong>
            </li>
            <li>
              Average Followers: <strong>{Math.round(meta.avgFollowers)}</strong>
            </li>
            <li>
              MEM Claims: <strong>{meta.claimsCount}</strong>
            </li>
            <li>
              MEM Balance: <strong>{Math.round(meta.memBalance)}</strong>
            </li>
            <li>
              ENS Age:{" "}
              <strong>
                {meta.ensAgeDays ? `${meta.ensAgeDays} days` : "No ENS"}
              </strong>
            </li>
            <li>
              Basename: <strong>{meta.hasBasename ? "Yes" : "No"}</strong>
            </li>
            <li>
              Wallet Age:{" "}
              <strong>
                {meta.walletAgeDays
                  ? `${meta.walletAgeDays} days`
                  : "Unknown"}
              </strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
