import React from "react";

export default function GraphSummary({ inputs }) {
  if (!inputs) return null;
  const wg = inputs.walletGraph;
  const sg = inputs.socialGraph;

  return (
    <div className="w-full max-w-xl mt-6">
      {inputs.walletActivity?.historySummary && (
        <div className="mb-4 p-4 rounded-lg bg-black/30 border border-white/6">
          <h3 className="text-sm font-semibold text-emerald-300 mb-2">Activity Summary</h3>
          <div className="text-sm text-gray-300">30d txs: {inputs.walletActivity.historySummary.recentTxCount30d ?? '—'}</div>
          <div className="text-sm text-gray-300">90d txs: {inputs.walletActivity.historySummary.recentTxCount90d ?? '—'}</div>
          <div className="text-sm text-gray-400 mt-2">Cadence score: {Math.round((inputs.walletActivity.historySummary.activityCadenceScore || 0) * 100)}%</div>
          {(inputs.walletActivity.historySummary.topContracts || []).length > 0 && (
            <div className="mt-2 text-sm text-gray-300">
              Top contracts:
              <div className="flex gap-2 flex-wrap mt-1">
                {inputs.walletActivity.historySummary.topContracts.slice(0,6).map((c) => (
                  <div key={c.address} className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center gap-2">
                    <div className="font-mono text-xs">{c.address}</div>
                    <div className="text-gray-400 text-2xs">{c.count}</div>
                    <a
                      href={`https://base.blockscout.com/address/${c.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-300 text-xs underline"
                    >
                      view
                    </a>
                    <button
                      onClick={() => {
                        try { navigator.clipboard.writeText(c.address); } catch (e) {}
                      }}
                      className="text-gray-400 text-2xs"
                    >
                      copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-gray-400 mt-3">Note: Activity data is API-derived and may be partial if no Covalent proxy or API key is configured.</div>
        </div>
      )}
      {wg && (
        <div className="mb-4 p-4 rounded-lg bg-black/30 border border-white/6">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">Linked Wallets (soft links)</h3>
          <div className="flex gap-2 flex-wrap">
            {(wg.links || []).slice(0, 12).map((l) => (
              <div key={l.address} className="px-2 py-1 bg-gray-800 rounded text-xs">
                <div className="font-mono text-xs">{l.address}</div>
                <div className="text-gray-400 text-2xs">{Math.round((l.confidence || 0) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sg && (
        <div className="p-4 rounded-lg bg-black/30 border border-white/6">
          <h3 className="text-sm font-semibold text-purple-300 mb-2">Social Graph Summary</h3>
          <div className="text-sm text-gray-300 mb-1">Platforms: {(sg.platformsPresent || []).join(', ')}</div>
          <div className="text-sm text-gray-400">Completeness: {Math.round(((sg.graphCompletenessScore || 0) * 100))}%</div>
          {sg.enriched?.farcaster && (
            <div className="mt-2 text-sm text-gray-300">Farcaster: {sg.enriched.farcaster.followers.length} followers, {sg.enriched.farcaster.following.length} following</div>
          )}
          {sg.enriched?.x && (
            <div className="mt-1 text-sm text-gray-300">X followers: {sg.enriched.x.followers.length}</div>
          )}
        </div>
      )}
      {inputs.suggestions && (
        <div className="mt-4 p-4 rounded-lg bg-black/20 border border-white/4">
          <h3 className="text-sm font-semibold text-yellow-300 mb-2">Suggestions</h3>
          <div className="text-sm text-gray-300 mb-2">Suggested accounts and mini-apps based on your legitimacy signals.</div>
          {(inputs.suggestions.suggestedAccounts || []).slice(0,6).map(s => (
            <div key={s.id} className="mb-2 p-2 bg-gray-900/40 rounded">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.display}</div>
                <div className="text-xs text-gray-400">{Math.round((s.confidence||0)*100)}%</div>
              </div>
              <div className="text-xs text-gray-400 mt-1">{(s.why||[]).slice(0,2).join(' • ')}</div>
              {(s.riskFlags || []).length > 0 && <div className="text-2xs text-red-400 mt-1">Risk: {(s.riskFlags||[]).join(', ')}</div>}
            </div>
          ))}

          {(inputs.suggestions.suggestedMiniApps || []).slice(0,6).map(m => (
            <div key={m.id} className="mt-2 p-2 bg-gray-900/20 rounded text-sm text-gray-300">
              <div className="flex items-center justify-between">
                <div>{m.display}</div>
                <div className="text-xs text-gray-400">{Math.round((m.confidence||0)*100)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
