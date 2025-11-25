export function computeTier(score) {
  if (score >= 93) {
    return {
      id: "sovereign",
      label: "Sovereign",
      color: "from-pink-400 to-fuchsia-600",
      description:
        "One of the strongest identity signals. Multi-year presence, deeply consistent, highly reinforced across platforms.",
    };
  }
  if (score >= 80) {
    return {
      id: "trusted",
      label: "Trusted",
      color: "from-amber-300 to-yellow-500",
      description:
        "Trusted identity with strong wallet history, cross-platform alignment, and persistent reputation.",
    };
  }
  if (score >= 65) {
    return {
      id: "established",
      label: "Established",
      color: "from-green-400 to-emerald-500",
      description:
        "A well-established identity with healthy behavior, multi-platform connections, and consistent signals.",
    };
  }
  if (score >= 45) {
    return {
      id: "credible",
      label: "Credible",
      color: "from-blue-500 to-cyan-600",
      description:
        "A credible user with decent identity strength, wallet maturity, and social integrity.",
    };
  }
  if (score >= 25) {
    return {
      id: "emerging",
      label: "Emerging",
      color: "from-purple-500 to-purple-700",
      description:
        "An emerging identity with some signals but still building consistency, history, and presence.",
    };
  }
  return {
    id: "unverified",
    label: "Unverified",
    color: "from-gray-700 to-gray-900",
    description:
      "Low signal. Missing identity history, limited activity, or unclear cross-platform consistency.",
  };
}
