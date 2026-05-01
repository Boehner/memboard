import React, { useEffect, useState } from 'react';
import vault from '../api/vault';
import { exportAsJWS } from '../api/proofs';

function downloadJSON(obj, filename = 'proof.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ProofsPanel({ embedded = false }) {
  const [proofs, setProofs] = useState([]);

  useEffect(() => setProofs(vault.listProofs()), []);

  const content = (
    <>
      <h4 className="text-sm font-semibold text-cyan-300 mb-3">Saved Proofs</h4>
      {proofs.length === 0 && <div className="text-xs text-gray-300">No saved proofs</div>}
      {proofs.map(p => (
        <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-white/5 rounded mb-2">
          <div className="text-xs text-white">{p.proof.payload.subject} • {new Date(p.createdAt).toLocaleString()}</div>
          <div className="flex gap-2">
            <button onClick={() => downloadJSON(p.proof, `proof-${p.id}.json`)} className="text-xs bg-white/10 text-white px-2 py-1 rounded">Download</button>
            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(p.proof)); }} className="text-xs bg-white/10 text-white px-2 py-1 rounded">Copy</button>
            <button onClick={async () => {
              try {
                const jws = exportAsJWS(p.proof);
                const url = `${location.origin}/?sharedProof=${encodeURIComponent(jws)}`;
                await navigator.clipboard.writeText(url);
                alert('Share link copied to clipboard');
              } catch (e) { alert('share failed'); }
            }} className="text-xs bg-white/10 text-white px-2 py-1 rounded">Share</button>
            <button onClick={async () => {
              try {
                const token = prompt('Signer token (if required)');
                const signerUrl = import.meta.env.VITE_PROOF_SIGNER_PROXY || '/sign-proof';
                const res = await fetch(signerUrl.replace('/sign-proof','/revoke'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token?{Authorization: `Bearer ${token}`}:{}) }, body: JSON.stringify({ id: p.proof.id }) });
                if (res.ok) { vault.removeProof(p.id); setProofs(vault.listProofs()); alert('Revoked'); } else { alert('revoke failed'); }
              } catch (e) { alert('revoke error'); }
            }} className="text-xs bg-red-700 text-white px-2 py-1 rounded">Revoke</button>
          </div>
        </div>
      ))}
    </>
  );

  return embedded
    ? content
    : (
      <div className="card-glow p-6 rounded-2xl border border-white/10 bg-white/5 shadow-xl">{content}</div>
    );
}
