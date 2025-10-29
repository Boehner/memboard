export async function getMemoryProfile(walletOrENS) {
  const API_URL = `https://api.memoryproto.co/identities/wallet/${walletOrENS}`;
  const API_KEY = import.meta.env.VITE_MEMORY_API_KEY;

  try {
    const response = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const raw = await response.json();
    console.log("Fetched Memory Identity:", raw);

    // --- Normalize data ---
    const identities =
      Array.isArray(raw)
        ? raw
        : raw.identities ||
          raw.connections ||
          raw.linked ||
          raw.results ||
          raw.identity ||
          [];

    return {
      wallet: walletOrENS,
      identities,
      total: identities.length,
      verified: identities.filter((i) =>
        i.sources?.some((s) => s.verified)
      ).length,
    };
  } catch (err) {
    console.error("Error fetching Memory identity:", err);
    return {
      wallet: walletOrENS,
      identities: [],
      total: 0,
      verified: 0,
    };
  }
}
