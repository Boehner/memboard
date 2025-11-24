export default function ScoreBox({ title, score, breakdown, onCopyLabel = 'Copy JSON' }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ score, breakdown }, null, 2));
      // eslint-disable-next-line no-alert
      alert('Copied score JSON to clipboard');
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-gray-400">{title}</div>
          <div className="text-2xl font-semibold text-white">{score ?? '—'}</div>
        </div>
        <div>
          <button onClick={handleCopy} className="px-3 py-1 bg-green-600 text-sm rounded">{onCopyLabel}</button>
        </div>
      </div>

      <pre className="max-h-64 overflow-auto bg-black/60 border border-white/10 rounded-lg p-3 text-[11px] text-gray-300">
{JSON.stringify(breakdown ?? {}, null, 2)}
      </pre>
    </div>
  );
}
