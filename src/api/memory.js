export async function getMemoryProfile(walletAddress) {
  try {
    const response = await fetch(`https://api.memory.build/v1/profile/${walletAddress}`);
    if (!response.ok) throw new Error("API response error");
    const data = await response.json();
    return data;
  } catch (err) {
    console.warn("Falling back to demo data:", err);
    return {
      username: "Demo Creator",
      connections: ["Twitter", "Base Wallet", "Zora"],
      queryCount: 12,
      earnedMem: 48.7,
    };
  }
}