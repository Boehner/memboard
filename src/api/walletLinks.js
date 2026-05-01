// api/walletLinks.js
// Fetch soft 'wallet links' for a given wallet using Memory identities.
// Starts simple: collect other wallets mentioned in the Memory identity cluster
// as soft links. Later this module can add onchain indexing (port 8092)
// and ownership checks.

import { getMemoryProfile } from "./memory.js";

function norm(v) {
  if (!v) return null;
  try {
    return String(v).trim().toLowerCase();
  } catch {
    return null;
  }
}

// Normalizes any identity item and extracts wallet/address-like fields
function extractWalletsFromIdentity(ident = {}) {
  const candidates = new Set();

  function addIfAddr(v) {
    const n = norm(v);
    if (n && n.startsWith("0x")) candidates.add(n);
  }

  const topFields = [
    "wallet",
    "address",
    "owner",
    "ownerAddress",
    "primaryAddress",
    "ethAddress",
    "custodyAddress",
  ];
  topFields.forEach((f) => addIfAddr(ident[f]));

  const arrayFields = [
    "accounts",
    "linked",
    "connections",
    "addresses",
    "associated",
    "associatedAddresses",
    "proofs",
    "following",
    "followers",
    "social",
  ];

  arrayFields.forEach((field) => {
    const val = ident[field];
    if (!val) return;

    // If field is an object with nested arrays (e.g., social.following)
    if (!Array.isArray(val) && typeof val === "object") {
      Object.values(val).forEach((sub) => {
        if (Array.isArray(sub)) {
          sub.forEach((item) => {
            addIfAddr(item?.address || item?.wallet || item?.owner || item);
          });
        } else {
          addIfAddr(sub?.address || sub?.wallet || sub);
        }
      });
      return;
    }

    // If field is array
    if (Array.isArray(val)) {
      val.forEach((item) => {
        addIfAddr(item?.address || item?.wallet || item?.owner || item);
      });
    }
  });

  return [...candidates];
}

// Public: fetchWalletLinks(wallet)
// Returns { wallet, links: [{ address, source, confidence }], meta }
export async function fetchWalletLinks(walletOrEns) {
  const profile = await getMemoryProfile(walletOrEns);
  const root = norm(walletOrEns);

  const seen = new Map();

  // Treat Memory identities as 'soft links' — other wallets appearing in the
  // same identity cluster are likely controlled by the same person.
  (profile.identities || []).forEach((ident) => {
    const wallets = extractWalletsFromIdentity(ident);
    wallets.forEach((addr) => {
      if (!addr || addr === root) return;
      const existing = seen.get(addr) || { address: addr, sources: new Set(), count: 0 };
      existing.count += 1;
      existing.sources.add("memory-identity");
      seen.set(addr, existing);
    });
  });

  // Produce normalized output with simple confidence score based on counts
  const links = [...seen.values()].map((item) => {
    const confidence = Math.min(1, item.count / (profile.identities?.length || 1));
    return {
      address: item.address,
      source: Array.from(item.sources),
      count: item.count,
      confidence,
    };
  });

  // Sort by confidence desc, then count
  links.sort((a, b) => (b.confidence - a.confidence) || (b.count - a.count));

  // Meta contains hooks for future: onchain index (8092) and ownership checks
  const meta = {
    fromMemory: true,
    identityCount: profile.identities?.length || 0,
    // placeholder for later implementation
    onchainIndexing: { enabled: false, port: 8092 },
    ownershipChecks: { enabled: false },
  };

  return { wallet: root, links, meta };
}

export default fetchWalletLinks;
