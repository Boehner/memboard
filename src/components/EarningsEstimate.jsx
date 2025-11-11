import { motion } from "framer-motion";
import CountUp from "react-countup";

export default function EarningsEstimate({ identities = [] }) {
  const safeCount = Array.isArray(identities) ? identities.length : 0;
  const estimatedMem = (safeCount * 2.5).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mt-10 max-w-md w-full px-6 py-5 rounded-2xl
                 bg-gradient-to-r from-blue-900/30 to-cyan-800/20
                 border border-blue-600/30 text-center
                 backdrop-blur-md shadow-md"
    >
      <h3 className="text-xl font-semibold text-blue-300 mb-2">
        Estimated $MEM Earnings
      </h3>
      <p className="text-2xl font-bold text-blue-400">
        <CountUp end={estimatedMem} duration={2.2} decimals={2} /> $MEM
      </p>
      <p className="text-sm text-gray-400 mt-2">
        Based on {safeCount} linked identities
      </p>
    </motion.div>
  );
}
