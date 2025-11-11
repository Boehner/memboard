import { FaExternalLinkAlt } from "react-icons/fa";

export default function RecentClaims({ claims = [] }) {
  if (!claims?.length)
    return (
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-md text-center text-gray-400">
        <p>No recent reward claims found.</p>
      </div>
    );

  return (
    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">
        💰 Recent Reward Claims
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-gray-300 text-sm">
          <thead className="text-gray-500 border-b border-gray-700">
            <tr>
              <th className="py-2">Block</th>
              <th className="py-2">Amount ($MEM)</th>
              <th className="py-2">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c, i) => (
              <tr
                key={i}
                className="hover:bg-gray-800/40 transition-colors border-b border-gray-800"
              >
                <td className="py-2 text-gray-400">{c.blockNumber}</td>
                <td className="py-2 text-green-400 font-medium">
                  {c.amount.toFixed(4)}
                </td>
                <td className="py-2">
                  <a
                    href={`https://basescan.org/tx/${c.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View <FaExternalLinkAlt size={10} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
