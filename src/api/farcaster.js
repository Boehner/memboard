// api/farcaster.js
//
// Keyless Farcaster social graph using public Hub endpoints.
// Uses hub.pinata.cloud (free).

const HUB = "https://hub.pinata.cloud";

function norm(v) {
  return v ? String(v).trim().toLowerCase() : null;
}

/* --------------------------------------
   Find FID from a wallet address
-------------------------------------- */
export async function getFidFromAddress(address) {
  const url = `${HUB}/v1/verificationsByAddress?address=${address}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json?.verifications?.length) return null;
    return json.verifications[0]?.fid || null;
  } catch (err) {
    console.warn("FID lookup error:", err);
    return null;
  }
}

/* --------------------------------------
   Get following list
-------------------------------------- */
export async function getFarcasterFollowing(fid) {
  const url = `${HUB}/v1/followingByFid?fid=${fid}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const list = json?.users || [];

    const wallets = new Set();

    list.forEach((u) => {
      (u?.verifications || []).forEach((a) => wallets.add(norm(a)));
      if (u?.custody_address) wallets.add(norm(u.custody_address));
    });

    return [...wallets];
  } catch (err) {
    console.warn("Following error:", err);
    return [];
  }
}

/* --------------------------------------
   Get followers list
-------------------------------------- */
export async function getFarcasterFollowers(fid) {
  const url = `${HUB}/v1/followersByFid?fid=${fid}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const list = json?.users || [];

    const wallets = new Set();

    list.forEach((u) => {
      (u?.verifications || []).forEach((a) => wallets.add(norm(a)));
      if (u?.custody_address) wallets.add(norm(u.custody_address));
    });

    return [...wallets];
  } catch (err) {
    console.warn("Followers error:", err);
    return [];
  }
}

/* --------------------------------------
   Unified Farcaster graph for a wallet
-------------------------------------- */
export async function getFarcasterGraph(address) {
  const fid = await getFidFromAddress(address);
  if (!fid) {
    return {
      fid: null,
      followerWallets: [],
      followingWallets: [],
    };
  }

  const [followers, following] = await Promise.all([
    getFarcasterFollowers(fid),
    getFarcasterFollowing(fid),
  ]);

  return {
    fid,
    followerWallets: followers,
    followingWallets: following,
  };
}
