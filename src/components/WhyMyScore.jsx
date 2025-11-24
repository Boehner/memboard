export default function WhyMyScore({ score, breakdown, expanded = true, onClose }) {
  if (!breakdown || !expanded) return null;

  const sections = [
    { key: "identity", label: "Identity Trust", action: "Ensure you are consistent in your identity across platforms. Use verified platforms and align your details for greater authenticity." },
    { key: "wallet", label: "Wallet Authenticity", action: "Build a trustworthy wallet by increasing legitimate transactions and avoiding suspicious activity." },
    { key: "social", label: "Social Quality", action: "Engage meaningfully with real users. Avoid bots and focus on genuine interactions to establish a trustworthy presence." },
    { key: "ens", label: "ENS Credibility", action: "Link your ENS name to a legitimate, long-term project and renew it regularly to improve its credibility." },
    { key: "memory", label: "MEM Activity", action: "Engage actively in the MEM ecosystem by claiming rewards and building your MEM balance, focusing on authentic participation." },
    { key: "external", label: "External Reputation", action: "Work on establishing a solid reputation by connecting with well-known platforms and verified networks." },
    { key: "overlap", label: "Cross-Platform Overlap", action: "Ensure your presence is spread across multiple reputable platforms, with consistent identities across each." },
  ];

  const meta = breakdown.meta || {};

  const getSignalColor = (value) => {
    if (value >= 75) return "text-cyan-300";
    if (value >= 45) return "text-amber-300";
    return "text-rose-400";
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto p-5">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onClose && onClose()}
        aria-hidden="true"
      />
      {/* Modal card */}
      <div className="relative card-glow w-full max-w-3xl mx-auto p-6 rounded-2xl border border-white/10 bg-black/40">
        <div className="card-glow-overlay" />
        <button
          onClick={() => onClose && onClose()}
          aria-label="Close"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white/80"
        >
          ✕
        </button>
        <h2 className="text-2xl font-semibold mb-5 text-white tracking-wide">Why is my score {score}?</h2>

      <div className="flex flex-col gap-4">
        {sections.map((s) => {
          const dim = breakdown[s.key];
          if (!dim) return null;

          const pct = Math.round(dim.normalized * 100); // component health (normalized)
          const weightPct = Math.round(dim.weight * 100); // share of final score
          const contrib = Math.round(dim.weighted * 100); // actual points added to 0–100 total

          return (
            <div key={s.key} className="bg-white/5 p-4 rounded-lg border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-medium text-gray-100">{s.label}</span>
                <span className="text-[11px] text-gray-400 flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-black/30 border border-white/10">
                    Adds <strong className="text-cyan-300">{contrib}</strong> pts
                  </span>
                  <span className="px-2 py-1 rounded-md bg-black/30 border border-white/10" title="How much this component can influence your total score.">
                    Weight <strong>{weightPct}%</strong>
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wide text-gray-400">Component Health</span>
                <span className={`text-xs font-semibold ${getSignalColor(pct)}`}>{pct}%</span>
              </div>

              {/* Gradient progress bar */}
              <div className="relative w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-fuchsia-500 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
                <div className="absolute inset-0 pointer-events-none mix-blend-overlay" />
              </div>

              <div className="mt-3 text-xs text-gray-400 leading-relaxed">
                This component currently contributes <strong className="text-cyan-300">{contrib}</strong> of your <strong>{score}</strong> total score. Improve it by: {s.action}
              </div>
            </div>
          );
        })}
      </div>

      {/* Metadata */}
      <div className="mt-10 p-5 bg-white/5 rounded-lg border border-white/10">
        <h3 className="text-lg font-semibold mb-3 text-white">Additional Factors</h3>
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
            Basename:{" "}
            <strong>
              {meta.hasBasename ? "Yes" : "No"}
            </strong>
          </li>
          <li>
            Wallet Age:{" "}
            <strong>
              {meta.walletAgeDays ? `${meta.walletAgeDays} days` : "Unknown"}
            </strong>
          </li>
        </ul>
      </div>
    </div>
  </div>
  );
}
