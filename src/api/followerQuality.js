export function computeFollowerQuality(identities = []) {
  let real = 0;
  let bot = 0;

  identities.forEach(i => {
    const f = i.social?.followers;
    if (typeof f !== "number") return;

    if (f === 0) return;

    if (f < 20) bot++;
    else real++;
  });
  return {
    realFollowers: real,
    botFollowers: bot,
    ratio: real / Math.max(real + bot, 1),
  };
}
