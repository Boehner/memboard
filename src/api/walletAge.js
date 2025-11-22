// api/walletAge.js
// Strategy: attempt Etherscan V2 (only if API key present), else Covalent.
// Removed deprecated BaseScan V1 fallback to avoid migration warnings.

const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"; // optional (needs key)
const BLOCKSCOUT_BASE = "https://base.blockscout.com/api"; // public compatible API
const BASE_CHAIN_ID = 8453;
const ETHERSCAN_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY;
const COVALENT_KEY = import.meta.env.VITE_COVALENT_API_KEY;

async function tryEtherscanV2(address) {
  if (!ETHERSCAN_KEY) return null; // skip if no key; reduces NOTOK spam
  const params = new URLSearchParams({
    chainid: String(BASE_CHAIN_ID),
    module: "account",
    action: "txlist",
    address,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: "1",
    sort: "asc",
    apikey: ETHERSCAN_KEY,
  });
  const url = `${ETHERSCAN_V2_BASE}?${params.toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status === "0") {
    const msg = (json.result || json.message || "").toLowerCase();
    if (msg.includes("free api access") || msg.includes("notok")) return null; // fallback path
  }
  const arr = json.result;
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[0];
}

async function tryBlockscout(address) {
  // Blockscout exposes an Etherscan-compatible API without requiring a key.
  // We mimic the minimal earliest tx query (offset=1 asc) like Etherscan.
  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: "1",
    sort: "asc"
  });
  const url = `${BLOCKSCOUT_BASE}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    // Blockscout sometimes returns { status: '0', message: 'NOTOK', result: 'Error!' }
    if (json.status !== '1' || !Array.isArray(json.result) || !json.result.length) return null;
    return json.result[0];
  } catch (_) {
    return null;
  }
}


async function tryCovalent(address) {
  if (!COVALENT_KEY) return null;
  // Covalent transactions_v2 returns most recent first; fetch small page and take last as earliest.
  const url = `https://api.covalenthq.com/v1/${BASE_CHAIN_ID}/address/${address}/transactions_v2/?page-size=25&key=${COVALENT_KEY}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const items = json?.data?.items;
    if (!Array.isArray(items) || !items.length) return null;
    const earliest = items[items.length - 1];
    // Covalent field: block_signed_at ISO timestamp
    const ts = Date.parse(earliest.block_signed_at);
    if (!Number.isFinite(ts)) return null;
    return { timeStamp: Math.floor(ts / 1000) };
  } catch (_) {
    return null;
  }
}

export async function fetchWalletAge(address) {
  if (!address) return { firstActivityTimestamp: null };
  try {
    let firstTx = await tryEtherscanV2(address);
    if (!firstTx) firstTx = await tryBlockscout(address);
    if (!firstTx) firstTx = await tryCovalent(address);
    if (!firstTx) return { firstActivityTimestamp: null };

    const tsRaw = firstTx.timeStamp || firstTx.timestamp || firstTx.block_timestamp;
    const tsMs = typeof tsRaw === "string" ? Number(tsRaw) * 1000 : Number(tsRaw) * 1000;
    if (!Number.isFinite(tsMs) || tsMs <= 0) return { firstActivityTimestamp: null };
    const ageDays = Math.round((Date.now() - tsMs) / 86400000);
    console.log("Wallet age fetch success:", { address, tsMs, ageDays });
    const source = firstTx.blockSignedAt
      ? "covalent"
      : firstTx.hash && ETHERSCAN_KEY
        ? "etherscan-v2"
        : firstTx.hash
          ? "blockscout"
          : "unknown";
    return { firstActivityTimestamp: tsMs, ageDays, source };
  } catch (err) {
    console.error("Wallet age fetch error (multi-source):", err);
    return { firstActivityTimestamp: null };
  }
}
