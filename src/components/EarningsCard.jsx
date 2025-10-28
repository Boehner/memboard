export default function EarningsCard({ earnedMem }) {
  return (
    <div className="card text-center">
      <h3 className="text-lg font-medium mb-2">Earning Potential</h3>
      <p className="text-3xl font-bold text-green-400">{earnedMem} $MEM</p>
      <p className="text-sm text-gray-400 mt-1">
        Estimated per data query (simulated)
      </p>
    </div>
  );
}