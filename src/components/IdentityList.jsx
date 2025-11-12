import React from "react";
import { motion } from "framer-motion";
import { platformIcons } from "../utils/platformIcons";

// Helper to derive a simple platform URL display
function buildPlatformLine(id, primary) {
  const p = id.platform?.toLowerCase();
  if (!primary) return null;
  if (p === 'twitter' || p === 'x') return `x.com/${primary}`;
  if (p === 'github') return `github.com/${primary}`;
  if (p === 'farcaster') return `warpcast.com/${primary}`;
  if (p === 'lens') return `${primary}.lens`;
  if (p === 'zora') return `zora.co/${primary}`;
  if (p === 'ethereum' || p === 'ens') return primary.endsWith('.eth') ? primary : `${primary}.eth`;
  if (p === 'website') return id.url?.replace(/^https?:\/\//,'').replace(/\/$/,'') || primary;
  return `${p || 'profile'}/${primary}`;
}

function sanitizeHandle(raw) {
  if (!raw) return raw;
  return raw.replace(/^@/, '').trim();
}

function normalizeUrl(url) {
  if (!url) return null;
  if (/^mailto:/i.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}

function buildProfileUrl(id, primary) {
  const p = id.platform?.toLowerCase();
  const handle = sanitizeHandle(primary || id.username || id.handle);
  if (!p) return null;
  switch (p) {
    case 'twitter':
    case 'x':
      return handle ? `https://x.com/${handle}` : null;
    case 'github':
      return handle ? `https://github.com/${handle}` : null;
    case 'farcaster':
      return handle ? `https://warpcast.com/${handle}` : null;
    case 'lens':
      return handle ? `https://hey.xyz/u/${handle}` : null;
    case 'zora':
      return handle ? `https://zora.co/${handle}` : null;
    case 'ethereum':
      // Prefer address if present else ENS domain viewer
      if (id.address && id.address.startsWith('0x')) return `https://basescan.org/address/${id.address}`;
      if (id.ens) return `https://ens.app/${id.ens}`;
      return null;
    case 'ens':
      if (id.ens || primary) return `https://ens.app/${id.ens || primary}`;
      return null;
    case 'website':
      return normalizeUrl(id.url || primary);
    case 'email':
      const email = id.email || primary;
      return email && /.+@.+\..+/.test(email) ? `mailto:${email}` : null;
    case 'talent-protocol':
      return handle ? `https://app.talentprotocol.com/${handle}` : null;
    default:
      // Fallback: if explicit URL provided, normalize; else null.
      if (id.url) return normalizeUrl(id.url);
      return null;
  }
}

function selectPrimaryLabel(id) {
  // Priority chain
  const raw = id.username || id.handle || id.displayName || id.name || id.ens || id.domain || id.address || id.id;
  if (!raw) return { label: 'unknown', isHandle: false };
  // Determine if this looks handle-like for @ prefix: alphanum + _ + length <= 32.
  const handleRegex = /^[a-z0-9_]{1,32}$/i;
  const isLikelyHandle = handleRegex.test(raw) && !raw.includes('.') && !raw.startsWith('0x');
  // If it's an address shorten
  let label = raw;
  if (raw.startsWith('0x') && raw.length > 12) {
    label = `${raw.slice(0,6)}...${raw.slice(-4)}`;
  }
  return { label, isHandle: isLikelyHandle };
}

export default function IdentityList({ identities }) {
  return (
    <div className="space-y-3">
  {identities.map((id, index) => {
  const Icon = platformIcons[id.platform] || platformIcons.default;
  const verified = id.sources?.some(s => s.verified);
  const { label: primaryLabel, isHandle } = selectPrimaryLabel(id);
  const rawPrimary = isHandle ? (id.username || id.handle) : (id.username || id.handle || id.ens || id.domain);
  const platformLine = buildPlatformLine(id, rawPrimary);

    const followers = id.social?.followers;
    const formattedFollowers = typeof followers === 'number' ? followers.toLocaleString() : null;
    const profileUrl = buildProfileUrl(id, rawPrimary);

        // Build a stable composite key to avoid duplicates when multiple identities share same id/address.
        const keyParts = [id.platform, id.id, id.address, id.username, id.handle, id.ens, id.domain].filter(Boolean);
        let compositeKey = keyParts.join('|');
        if (!compositeKey) compositeKey = `identity-${index}`;
        // Append index only if another identical composite appears (cheap uniqueness guard)
        // We can't track seen across renders easily here without state; simple suffix ensures React uniqueness.
        compositeKey = compositeKey + `#${index}`;

        return (
          <motion.div
            key={compositeKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="card-glow flex items-center justify-between p-4 group focus-within:ring-2 focus-within:ring-cyan-400/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.15)]"
            aria-label={`${id.platform || 'platform'} identity for ${isHandle ? '@' : ''}${primaryLabel}`}
          >
            <div className="card-glow-overlay" />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-500/30 shadow-[0_0_12px_rgba(0,255,255,0.3)] ring-1 ring-white/10 group-hover:ring-cyan-400/40 shrink-0">
                {id.avatar ? (
                  <img src={id.avatar} alt={id.platform} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <Icon className="w-5 h-5 text-cyan-300" />
                )}
              </div>
              <div className="leading-tight truncate">
                <p className="text-sm font-semibold text-white truncate">{isHandle ? `@${primaryLabel}` : primaryLabel}</p>
                {platformLine && (
                  <p className="text-xs text-gray-400 truncate">{platformLine}</p>
                )}
                {/* Hover / focus details */}
                <div className="select-none mt-1 overflow-hidden max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 group-focus-within:max-h-20 group-focus-within:opacity-100 transition-all duration-300 ease-out">
                  <div className="text-[11px] text-gray-300 flex flex-wrap items-center gap-2">
                    {formattedFollowers ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                        <svg className="w-3.5 h-3.5 text-cyan-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a4 4 0 100 8 4 4 0 000-8zM3 17a7 7 0 1114 0H3z" /></svg>
                        <span className="tabular-nums">{formattedFollowers}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white-500">No follower data</span>
                    )}
                    {profileUrl && (
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 text-cyan-300 hover:from-cyan-500/30 hover:to-purple-500/30 hover:text-cyan-200 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400/50 pointer-events-auto"
                        tabIndex={0}
                        aria-label={`Open ${id.platform} profile in new tab`}
                      >
                        <span>Profile</span>
                        <span className="text-[10px]">↗</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center pl-3 ml-3 border-l border-white/10">
              {verified ? (
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20" aria-label="Verified">
                  <path d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 6.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z" />
                </svg>
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-gray-500 px-2 py-1 rounded-md bg-white/5 border border-white/10">Unverified</span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
