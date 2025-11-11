import React from "react";
import { FaEthereum, FaGithub, FaTwitter, FaGlobe, FaUserCircle } from "react-icons/fa";
import { SiLens, SiSolana, SiFarcaster, SiZora, SiMaildotru } from "react-icons/si";

const platformIcons = {
  ethereum: <FaEthereum className="text-purple-400" />,
  solana: <SiSolana className="text-green-400" />,
  github: <FaGithub className="text-gray-300" />,
  twitter: <FaTwitter className="text-sky-400" />,
  farcaster: <SiFarcaster className="text-indigo-400" />,
  lens: <SiLens className="text-lime-400" />,
  zora: <SiZora className="text-pink-400" />,
  email: <SiMaildotru className="text-yellow-300" />,
  website: <FaGlobe className="text-blue-300" />,
  "talent-protocol": <FaUserCircle className="text-amber-300" />,
  factory: <FaGlobe className="text-blue-500" />,
  ens: <FaEthereum className="text-violet-300" />,
  default: <FaUserCircle className="text-gray-500" />
};

export default function ProfileSummary({ profile }) {
  // profile is either an array or { identities: [] }
  const identities = Array.isArray(profile) ? profile : profile.identities || [];

  if (identities.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
        No linked identities found.
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-[#111829] rounded-xl shadow-md p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-4 text-gray-200">
        Linked Identities
      </h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {identities.map((item, i) => {
          const Icon = platformIcons[item.platform] || platformIcons.default;

          return (
            <a
              key={i}
              href={item.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-[#1a2032] hover:bg-[#1e2740] rounded-lg transition-colors border border-gray-700"
            >
              <div className="text-2xl">{Icon}</div>
              <div className="flex flex-col text-sm">
                <span className="font-semibold text-gray-200">
                  {item.username || item.platform}
                </span>
                {item.social?.followers && (
                  <span className="text-gray-400 text-xs">
                    {item.social.followers.toLocaleString()} followers
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
