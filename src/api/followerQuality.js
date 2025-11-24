const PLATFORM_WEIGHTS = {
  twitter: 1.3,
  x: 1.3,
  farcaster: 1.2,
  lens: 1.15,
  github: 1.25,
  youtube: 1.2,
  instagram: 1.1,
  zora: 1.05,
  email: 0.4,
  website: 0.5,
  default: 0.8,
};

function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function computeFollowerQuality(identities = []) {
  let weightedReal = 0;
  let weightedBot = 0;

  identities.forEach((id) => {
    const platform = (id.platform || "default").toLowerCase();
    const weight = PLATFORM_WEIGHTS[platform] ?? PLATFORM_WEIGHTS.default;

    const social = id.social || {};
    const followers = typeof social.followers === "number" ? social.followers : 0;
    const following = typeof social.following === "number" ? social.following : null;
    const engagementRaw =
      typeof social.engagementRate === "number"
        ? social.engagementRate
        : typeof social.engagement === "number"
        ? social.engagement
        : null;

    if (followers <= 0 && !following) return;

    let botScore = 0;
    let realScore = 0;

   if (followers < 10 && following && following > 50) {
      botScore += 0.7;
    }

    if (following && following > 0) {
      const ratio = followers / Math.max(following, 1);
      if (ratio < 0.1 && following > 100) {
        botScore += 0.5;
      } else if (ratio < 0.25 && following > 50) {
        botScore += 0.3;
      }
    }

    if (engagementRaw !== null && followers > 1000) {
      const engagementRate =
        engagementRaw > 1 ? engagementRaw / followers : engagementRaw;
      if (engagementRate < 0.002) {
        botScore += 0.4;
      }
    }

    const followerLog = Math.log10(followers + 1);
    if (followerLog > 0.5) {
      realScore += followerLog * 0.5;
    }

    if (following && following > 0) {
      const ratio = followers / Math.max(following, 1);
      if (ratio >= 0.5 && ratio <= 4) {
        realScore += 0.3;
      } else if (ratio > 4 && followers > 200) {
        realScore += 0.4;
      }
    }
    if (followers > 0 && followers < 50 && !following) {
      realScore += 0.2;
    }

    realScore *= weight;
    botScore *= clamp01(1.3 - weight * 0.4);

    weightedReal += realScore;
    weightedBot += botScore;
  });

  const total = weightedReal + weightedBot;

  return {
    realFollowers: weightedReal,
    botFollowers: weightedBot,
    ratio: total > 0 ? weightedReal / total : 0.5,
  };
}
