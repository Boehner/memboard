// api/socialGraph.js
//
// Real follower graph utilities.
// Uses Memory profile identities and any attached follower / following lists
// to build a set of social graph peers and compute overlap between wallets.

import { getMemoryProfile } from "./memory.js";
import { getFidFromAddress, getFarcasterFollowers, getFarcasterFollowing } from "./farcaster.js";

const ENV = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function norm(v) {
  return v ? String(v).trim().toLowerCase() : null;
}

function extractIds(list = []) {
  const out = new Set();
  list.forEach((item) => {
    if (!item) return;

    if (typeof item === "string") {
      const id = norm(item);
      if (id) out.add(id);
      return;
    }

    const id =
      norm(item.wallet) ||
      norm(item.address) ||
      norm(item.id) ||
      norm(item.username) ||
      norm(item.handle);
    if (id) out.add(id);
  });
  return out;
}

/**
 * Build follower / following ID sets + peer wallet candidates for a wallet.
 */
export async function getFollowerGraph(walletOrEns, profileArg = null) {
  const profile = profileArg || (await getMemoryProfile(walletOrEns));

  const followerIds = new Set();
  const followingIds = new Set();
  const peerWallets = new Set();

  (profile.identities || []).forEach((ident) => {
    const social = ident.social || {};
    const followersList = social.followersList || [];
    const followingList = social.followingList || [];

    const fSet = extractIds(followersList);
    const gSet = extractIds(followingList);

    fSet.forEach((id) => followerIds.add(id));
    gSet.forEach((id) => followingIds.add(id));

    // any explicit wallet/addr fields become peer wallet candidates
    followersList.forEach((item) => {
      const w = norm(item.wallet || item.address);
      if (w) peerWallets.add(w);
    });
    followingList.forEach((item) => {
      const w = norm(item.wallet || item.address);
      if (w) peerWallets.add(w);
    });
  });

  return {
    followerIds,
    followingIds,
    peerWallets,
  };
}

/**
 * Follower graph overlap between two wallets (0–1).
 * We treat the graph as the union of followerIds + followingIds for each.
 */
export async function computeFollowerGraphOverlap(walletA, walletB, profileA = null, profileB = null) {
  const [A, B] = await Promise.all([
    getFollowerGraph(walletA, profileA),
    getFollowerGraph(walletB, profileB),
  ]);

  const setA = new Set([...A.followerIds, ...A.followingIds]);
  const setB = new Set([...B.followerIds, ...B.followingIds]);

  if (!setA.size || !setB.size) {
    return { overlapScore: 0, sharedIds: [] };
  }

  const shared = [...setA].filter((id) => setB.has(id));
  const unionSize = new Set([...setA, ...setB]).size;
  const overlapScore = unionSize > 0 ? shared.length / unionSize : 0;

  return {
    overlapScore,
    sharedIds: shared,
  };
}

// Analyze a set of Memory identities and optionally enrich via platform APIs
// Returns: { platformsPresent, followersByPlatform, graphCompletenessScore, syncSuggestions }
export async function fetchSocialGraph(identities = [], options = {}) {
  const platformsPresent = new Set();
  const followersByPlatform = {};

  // Collect basic platform presence and follower lists
  (identities || []).forEach((ident) => {
    const platform = (ident.platform || "unknown").toLowerCase();
    platformsPresent.add(platform);

    const social = ident.social || {};
    const followers = social.followersList || [];
    const normalized = [...extractIds(followers)];

    if (!followersByPlatform[platform]) followersByPlatform[platform] = new Set();
    normalized.forEach((id) => followersByPlatform[platform].add(id));
  });

  // Convert sets to arrays for output
  const platforms = [...platformsPresent];
  const followersByPlatformOut = {};
  Object.keys(followersByPlatform).forEach((p) => {
    followersByPlatformOut[p] = [...followersByPlatform[p]];
  });

  // Basic completeness heuristic: fraction of common major platforms present
  const major = ["x", "twitter", "farcaster", "github", "ens"];
  const presentMajor = major.filter((m) => platforms.includes(m));
  const graphCompletenessScore = Math.min(1, presentMajor.length / major.length);

  // Sync suggestions: check if the same handle appears across multiple platforms
  const handleMap = new Map();
  (identities || []).forEach((ident) => {
    const handle = ident.username || ident.handle || ident.id || null;
    if (!handle) return;
    const h = handle.toLowerCase();
    const platform = (ident.platform || "unknown").toLowerCase();
    const s = handleMap.get(h) || new Set();
    s.add(platform);
    handleMap.set(h, s);
  });

  const syncSuggestions = [];
  handleMap.forEach((platformSet, handle) => {
    if (platformSet.size >= 2) {
      syncSuggestions.push(`${handle}: same handle across ${[...platformSet].join(", ")}`);
    }
  });

  // Optional edges: Farcaster and X (Twitter) enrichers — run and await so
  // `fetchSocialGraph` returns enriched data immediately. These calls are
  // best-effort and will not throw on individual failures.
  if (options.fetchFarcaster || ENV.VITE_FETCH_FARCASTER === "true") {
    try {
      await fetchFarcasterEdges(identities, followersByPlatform);
    } catch (err) {
      console.warn('fetchSocialGraph: Farcaster fetch failed', err && err.message ? err.message : err);
    }
  }

  if ((options.fetchX || ENV.VITE_FETCH_X === "true") && (options.xToken || ENV.VITE_X_BEARER || options.xProxy)) {
    try {
      await fetchXEdges(identities, followersByPlatform, options.xToken || ENV.VITE_X_BEARER, options);
    } catch (err) {
      console.warn('fetchSocialGraph: X fetch failed', err && err.message ? err.message : err);
    }
  }

  const enriched = {
    farcaster: {
      followers: followersByPlatformOut.farcaster || [],
      following: followersByPlatformOut.farcasterFollowing || [],
    },
    x: {
      followers: followersByPlatformOut.x || followersByPlatformOut.twitter || [],
    },
  };

  return {
    platformsPresent: platforms,
    followersByPlatform: followersByPlatformOut,
    enriched,
    graphCompletenessScore,
    syncSuggestions,
  };
}

// --- Platform enrichers (stubs) ---
async function fetchFarcasterEdges(identities = [], followersByPlatform) {
  // For each identity that includes a wallet/address or platform 'farcaster', try to find FID
  const wallets = new Set();
  (identities || []).forEach((ident) => {
    const platform = (ident.platform || "").toLowerCase();
    if (platform === "farcaster") {
      if (ident.custodyAddress) wallets.add(norm(ident.custodyAddress));
      if (ident.wallet) wallets.add(norm(ident.wallet));
      if (ident.address) wallets.add(norm(ident.address));
    } else {
      // Even non-farcaster identities may include wallet verifications
      if (ident.wallet) wallets.add(norm(ident.wallet));
      if (ident.address) wallets.add(norm(ident.address));
    }
  });

  for (const w of wallets) {
    if (!w) continue;
    try {
      const fid = await getFidFromAddress(w);
      if (!fid) continue;
      const [followers, following] = await Promise.all([
        getFarcasterFollowers(fid),
        getFarcasterFollowing(fid),
      ]);

      if (!followersByPlatform.farcaster) followersByPlatform.farcaster = new Set();
      if (!followersByPlatform.farcasterFollowing) followersByPlatform.farcasterFollowing = new Set();

      followers.forEach((x) => followersByPlatform.farcaster.add(x));
      following.forEach((x) => followersByPlatform.farcasterFollowing.add(x));
    } catch (err) {
      console.warn('fetchFarcasterEdges: error for', w, err && err.message ? err.message : err);
    }
  }

  // Normalize into arrays (mutating the passed structure)
  if (followersByPlatform.farcaster instanceof Set) followersByPlatform.farcaster = [...followersByPlatform.farcaster];
  if (followersByPlatform.farcasterFollowing instanceof Set) followersByPlatform.farcasterFollowing = [...followersByPlatform.farcasterFollowing];

  return true;
}

async function fetchXEdges(identities = [], followersByPlatform, bearerToken, options = {}) {
  // Support two modes:
  //  - proxy mode: caller provides `options.xProxy` (URL) — we'll POST { username }
  //    to the proxy and expect { followers: [], following: [] } in response.
  //  - direct mode: use X API v2 with `bearerToken` (not recommended client-side).

  const proxy = options.xProxy || null;
  const token = bearerToken || null;

  const handles = new Set();
  (identities || []).forEach((ident) => {
    const maybe = (ident.username || ident.handle || "").toLowerCase();
    if (maybe) handles.add(maybe.replace(/^@/, ""));
  });

  if (!handles.size) return false;

  // Helper: exponential backoff
  async function callWithRetries(fn, maxAttempts = 4) {
    let attempt = 0;
    let backoff = 500;
    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (attempt >= maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, backoff));
        backoff *= 2;
      }
    }
  }

  // Accumulate results in Sets
  if (!followersByPlatform.x) followersByPlatform.x = new Set();
  if (!followersByPlatform.twitter) followersByPlatform.twitter = new Set();

  const base = "https://api.twitter.com/2";

  for (const h of handles) {
    try {
      let followers = [];
      let following = [];

      if (proxy) {
        // Proxy mode: delegate to server-side endpoint that keeps secrets
        const res = await callWithRetries(async () => {
          const r = await fetch(proxy, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: h }),
          });
          if (!r.ok) throw new Error(`Proxy ${r.status}`);
          return r.json();
        });
        followers = Array.isArray(res.followers) ? res.followers : [];
        following = Array.isArray(res.following) ? res.following : [];
      } else if (token) {
        // Direct mode: use X API v2 with pagination and retries
        // 1) lookup user id
        const lookup = await callWithRetries(async () => {
          const r = await fetch(`${base}/users/by/username/${encodeURIComponent(h)}?user.fields=id`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) throw new Error(`Lookup ${r.status}`);
          return r.json();
        });
        const userId = lookup?.data?.id;
        if (!userId) continue;

        // Helper to fetch pages
        async function fetchAllPages(url) {
          const out = [];
          let next = null;
          do {
            const q = new URL(url);
            if (next) q.searchParams.set("pagination_token", next);
            const page = await callWithRetries(async () => {
              const r = await fetch(q.toString(), { headers: { Authorization: `Bearer ${token}` } });
              if (!r.ok) throw new Error(`Page ${r.status}`);
              return r.json();
            });
            (page?.data || []).forEach((d) => {
              if (d.username) out.push(d.username.toLowerCase());
            });
            next = page?.meta?.next_token || null;
            // stop if pages grow too large
            if (out.length > 2000) break;
          } while (next);
          return out;
        }

        const folUrl = `${base}/users/${userId}/followers?max_results=1000&user.fields=username`;
        const fowUrl = `${base}/users/${userId}/following?max_results=1000&user.fields=username`;

        try {
          followers = await fetchAllPages(folUrl);
        } catch (err) {
          console.warn('fetchXEdges: followers fetch failed for', h, err && err.message ? err.message : err);
        }
        try {
          following = await fetchAllPages(fowUrl);
        } catch (err) {
          console.warn('fetchXEdges: following fetch failed for', h, err && err.message ? err.message : err);
        }
      } else {
        // No proxy or token
        continue;
      }

      followers.forEach((u) => followersByPlatform.x.add(u.toLowerCase()));
      following.forEach((u) => followersByPlatform.x.add(u.toLowerCase()));
    } catch (err) {
      console.warn('fetchXEdges: error for', h, err && err.message ? err.message : err);
    }
  }

  // Convert to arrays
  if (followersByPlatform.x instanceof Set) followersByPlatform.x = [...followersByPlatform.x];
  if (followersByPlatform.twitter instanceof Set) followersByPlatform.twitter = [...followersByPlatform.twitter];

  return true;
}
