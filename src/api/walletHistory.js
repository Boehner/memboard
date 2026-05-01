// api/walletHistory.js
// Lightweight wallet history summary that does NOT require traces.
// Attempts to use Covalent (if API key present), falls back to Blockscout (Base)
// and finally RPC-only best-effort.

const ENV = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
const COVALENT_KEY = ENV.VITE_COVALENT_API_KEY || ENV.VITE_COVALENT_API_KEY || null;
const COVALENT_PROXY = ENV.VITE_COVALENT_PROXY || ENV.VITE_COVALENT_PROXY || null;
const BLOCKSCOUT_BASE = "https://base.blockscout.com/api";
const BASE_CHAIN_ID = 8453;

// Pagination defaults (can be overridden via env)
// Admin-configurable pagination: increase defaults if you expect deeper history.
// WARNING: larger page sizes and page counts increase Covalent usage and potential cost.
const COVALENT_MAX_PAGES = Number(ENV.VITE_COVALENT_MAX_PAGES || ENV.VITE_COVALENT_MAX_PAGES || 8);
const COVALENT_PAGE_SIZE = Number(ENV.VITE_COVALENT_PAGE_SIZE || ENV.VITE_COVALENT_PAGE_SIZE || 300);

if (typeof window === 'undefined') {
  // Log server-side defaults (helpful during SSR or server runs)
  try { console.log('walletHistory: covalent defaults', { COVALENT_MAX_PAGES, COVALENT_PAGE_SIZE, proxy: (ENV.VITE_COVALENT_PROXY || ENV.VITE_COVALENT_PROXY || null) }); } catch {}
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function topNFromCounts(countMap, n = 10) {
  const items = Object.entries(countMap).map(([address, count]) => ({ address, count }));
  items.sort((a, b) => b.count - a.count);
  return items.slice(0, n);
}

// Covalent transactions_v2 paginated fetch (best-effort, limited pages)
async function fetchCovalentTxs(address) {
  if (!COVALENT_KEY && !COVALENT_PROXY) return null;
  const out = [];
  try {
    const maxPages = COVALENT_MAX_PAGES;
    const pageSize = COVALENT_PAGE_SIZE;

    for (let page = 0; page < maxPages; page++) {
      let json = null;
      if (COVALENT_PROXY) {
        // proxy mode: POST to proxy with { address, page, pageSize }
        const proxyRes = await fetch(COVALENT_PROXY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, page: page + 1, pageSize }),
        });
        if (!proxyRes.ok) break;
        json = await proxyRes.json();
      } else {
        const url = `https://api.covalenthq.com/v1/${BASE_CHAIN_ID}/address/${address}/transactions_v2/?&page-number=${page + 1}&page-size=${pageSize}&key=${COVALENT_KEY}`;
        const res = await fetch(url);
        if (!res.ok) break;
        json = await res.json();
      }

      const items = json?.data?.items || [];
      if (!items.length) break;
      out.push(...items);
      // stop early if last page smaller than pageSize
      if (items.length < pageSize) break;
    }
    return out;
  } catch (err) {
    console.warn('fetchCovalentTxs error', err);
    return null;
  }
}

// Blockscout txlist (single page best-effort)
async function fetchBlockscoutTxs(address, pageSize = 100) {
  try {
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(pageSize),
      sort: 'desc',
    });
    const url = `${BLOCKSCOUT_BASE}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json.result)) return null;
    return json.result;
  } catch (err) {
    console.warn('fetchBlockscoutTxs error', err);
    return null;
  }
}

export async function fetchWalletHistory(address) {
  if (!address) return {
    recentTxCount30d: null,
    recentTxCount90d: null,
    topContracts: [],
    activityCadenceScore: 0,
    source: null,
  };

  const now = Date.now();
  const cutoff30 = now - 30 * 24 * 60 * 60 * 1000;
  const cutoff90 = now - 90 * 24 * 60 * 60 * 1000;

  // Helpers to convert Covalent and Blockscout timestamps to ms
  function covalentTs(item) {
    // Covalent: block_signed_at ISO string
    const s = item?.block_signed_at;
    const t = s ? Date.parse(s) : null;
    return Number.isFinite(t) ? t : null;
  }
  function blockscoutTs(item) {
    const s = item?.timeStamp || item?.timestamp;
    const t = s ? Number(s) * 1000 : null;
    return Number.isFinite(t) ? t : null;
  }

  // Attempt Covalent
  const cov = await fetchCovalentTxs(address);
  let txs = null;
  let source = null;
  if (Array.isArray(cov) && cov.length) {
    txs = cov;
    source = 'covalent';
  } else {
    // Fallback to Blockscout (Base)
    const bs = await fetchBlockscoutTxs(address, 200);
    if (Array.isArray(bs) && bs.length) {
      txs = bs;
      source = 'blockscout';
    }
  }

  // If no external API, return nulls but include source 'rpc'
  if (!txs) {
    return {
      recentTxCount30d: null,
      recentTxCount90d: null,
      topContracts: [],
      activityCadenceScore: 0,
      source: 'rpc',
    };
  }

  // Aggregate
  let count30 = 0;
  let count90 = 0;
  const contractCounts = {};

  for (const tx of txs) {
    const ts = source === 'covalent' ? covalentTs(tx) : blockscoutTs(tx);
    if (!ts) continue;
    if (ts >= cutoff30) count30 += 1;
    if (ts >= cutoff90) count90 += 1;

    // top contract: use to_address (covalent: to_address, blockscout: to)
    const toAddr = tx.to_address || tx.to || null;
    if (toAddr && /^0x[a-fA-F0-9]{40}$/.test(String(toAddr))) {
      const a = toAddr.toLowerCase();
      contractCounts[a] = (contractCounts[a] || 0) + 1;
    }

    // Covalent: include log_events contract_address
    if (source === 'covalent' && Array.isArray(tx.log_events)) {
      tx.log_events.forEach((e) => {
        const ca = e.contract_address || e.raw_contract_address || null;
        if (ca && /^0x[a-fA-F0-9]{40}$/.test(String(ca))) {
          const a = ca.toLowerCase();
          contractCounts[a] = (contractCounts[a] || 0) + 1;
        }
      });
    }
  }

  const topContracts = topNFromCounts(contractCounts, 10);

  // Activity cadence score based on avg txs/day over 30 days
  const avg30 = count30 / 30;
  const activityCadenceScore = clamp01(Math.sqrt(avg30 / 2));

  return {
    recentTxCount30d: count30,
    recentTxCount90d: count90,
    topContracts,
    activityCadenceScore,
    source,
  };
}

export default fetchWalletHistory;
