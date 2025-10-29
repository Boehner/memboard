import React from "react";
import { motion } from "framer-motion";
import { platformIcons } from "../utils/platformIcons";
import { platformThemes } from "../utils/platformThemes";

export default function IdentityList({ identities }) {
  return (
    <>
      {identities.map((id, index) => {
        const Icon = platformIcons[id.platform] || null;
        const theme = platformThemes[id.platform] || platformThemes.default;
        const verified = id.sources?.some((s) => s.verified);

        return (
          <motion.div
            key={id.id || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.03, y: -4 }}
            className={`group relative p-5 rounded-2xl border backdrop-blur-md flex flex-col justify-between transition-all duration-300 ${theme} hover:border-blue-400/40 hover:shadow-lg`}
          >
            <div className="flex items-center gap-3">
              {Icon ? (
                <Icon className="w-8 h-8" />
              ) : id.avatar ? (
                <img
                  src={id.avatar}
                  alt={id.platform}
                  className="w-8 h-8 rounded-full object-cover border border-gray-600"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-700 rounded-full" />
              )}

              <div className="flex flex-col">
                <span className="text-base font-semibold capitalize flex items-center gap-1">
                  {id.platform}
                  {verified && (
  <span className="text-blue-400 text-xs ml-1 animate-pulse">✔</span>
)}
                </span>
                {id.username && (
                  <span className="text-sm text-gray-300">@{id.username}</span>
                )}
                {id.social?.followers && (
                  <span className="text-xs text-gray-400">
                    {id.social.followers.toLocaleString()} followers
                  </span>
                )}
              </div>
            </div>

            {id.url && (
              <a
                href={id.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-blue-400 text-sm font-medium hover:text-blue-300"
              >
                View Profile →
              </a>
            )}
          </motion.div>
        );
      })}
    </>
  );
}
