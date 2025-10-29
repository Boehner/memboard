import React from "react";
import {
  FaTwitter,
  FaGithub,
  FaEthereum,
  FaEnvelope,
  FaUserCircle,
  FaRegEye,
  FaGlobe,
} from "react-icons/fa";

export const platformIcons = {
  twitter: (props) => <FaTwitter {...props} className="text-sky-400" />,
  github: (props) => <FaGithub {...props} className="text-gray-300" />,
  ethereum: (props) => <FaEthereum {...props} className="text-amber-400" />,
  lens: (props) => <FaRegEye {...props} className="text-green-400" />,
  zora: (props) => <FaGlobe {...props} className="text-white" />,
  farcaster: (props) => <FaUserCircle {...props} className="text-purple-400" />,
  "talent-protocol": (props) => <FaGlobe {...props} className="text-sky-300" />,
  email: (props) => <FaEnvelope {...props} className="text-red-400" />,
  website: (props) => <FaGlobe {...props} className="text-gray-300" />,
  factory: (props) => <FaUserCircle {...props} className="text-amber-300" />,
  default: (props) => <FaUserCircle {...props} className="text-gray-400" />,
};
