// api/walletLastTx.js

const BLOCKSCOUT_BASE = "https://base.blockscout.com/api";

export async function fetchWalletActivityTimestamp(address) {
  if (!address) return null;

  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    sort: "desc",
    page: "1",
    offset: "1"
  });

  const url = `${BLOCKSCOUT_BASE}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    if (!Array.isArray(json.result) || !json.result.length) return null;

    const lastTx = json.result[0];
    const tsSec = Number(lastTx.timeStamp || 0);
    return Number.isFinite(tsSec) ? tsSec * 1000 : null;
  } catch {
    return null;
  }
}
