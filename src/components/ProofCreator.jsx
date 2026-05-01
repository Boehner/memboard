import React, { useMemo, useState } from 'react';
import { createLegitimacyProof } from '../api/proofs';
import vault from '../api/vault';
import { ethers } from 'ethers';
import { explainLegitimacyScore } from '@/utils/computeLegitimacyScore';

export default function ProofCreator({ inputs, embedded = false }) {
  if (!inputs) return null;

  const defaultSubject = (inputs.profile && (inputs.profile.address || inputs.profile.wallet)) || (inputs.identities && inputs.identities[0] && inputs.identities[0].id) || '';

  const [subject, setSubject] = useState(defaultSubject);
  const [expiresIn, setExpiresIn] = useState(60 * 60 * 24 * 30);
  const [selected, setSelected] = useState({ age: true, legitimacy: true, activity: false });
  const [status, setStatus] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const legit = useMemo(() => {
    try { return explainLegitimacyScore(inputs); } catch { return null; }
  }, [inputs]);

  const currentVals = {
    ageDays: inputs.walletActivity?.ageDays ?? null,
    legitimacyScore: legit?.score ?? null,
    activityCadenceScore: inputs.walletActivity?.historySummary?.activityCadenceScore ?? null,
  };

  function buildClaims() {
    const claims = [];
    if (selected.age) claims.push({ key: 'walletAgeDays', op: '>=', value: 365, actual: currentVals.ageDays });
    if (selected.legitimacy) claims.push({ key: 'legitimacyScore', op: '>=', value: 70, actual: currentVals.legitimacyScore });
    if (selected.activity) claims.push({ key: 'activityCadenceScore', op: '>=', value: 0.5, actual: currentVals.activityCadenceScore });
    return claims;
  }

  async function signClient() {
    setStatus('requesting-wallet');
    try {
      if (!window.ethereum) throw new Error('No injected wallet');
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const claims = buildClaims();
      const proof = await createLegitimacyProof({ wallet: subject, claims, expiresIn, signer });
      const entry = vault.saveProof(proof, { scopes: ['legitimacy'], consent: true });
      setStatus('saved:' + entry.id);
    } catch (err) {
      setStatus('error:' + (err.message || String(err)));
    }
  }

  async function ensureServerSession(proxyBase) {
    try {
      if (sessionId) return sessionId;
      const url = proxyBase.replace(/\/$/, '') + '/create-session';
      const headers = { 'Content-Type': 'application/json' };
      const token = import.meta?.env?.VITE_PROOF_SIGNER_TOKEN;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method: 'POST', headers, body: JSON.stringify({ userId: subject || 'anonymous', ttl: Math.max(3600, Number(expiresIn)||3600) })
      });
      const json = await res.json();
      if (!res.ok || !json?.id) throw new Error(json?.error || ('session ' + res.status));
      setSessionId(json.id);
      return json.id;
    } catch (e) {
      throw e;
    }
  }

  async function signServer() {
    setStatus('requesting-server');
    try {
      const proxy = (import.meta.env.VITE_PROOF_SIGNER_PROXY || '').trim();
      if (!proxy) throw new Error('VITE_PROOF_SIGNER_PROXY not set');
      const claims = buildClaims();
      const sid = await ensureServerSession(proxy);
      const url = proxy.replace(/\/$/, '') + '/sign-proof';
      const headers = { 'Content-Type': 'application/json' };
      const token = import.meta?.env?.VITE_PROOF_SIGNER_TOKEN;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method: 'POST', headers, body: JSON.stringify({ wallet: subject, claims, expiresIn, consent: true, sessionId: sid })
      });
      const proof = await res.json();
      if (!proof || !proof.signature) throw new Error('bad server response');
      const entry = vault.saveProof(proof, { scopes: ['legitimacy'], consent: true });
      setStatus('saved:' + entry.id);
    } catch (err) {
      setStatus('error:' + (err.message || String(err)));
    }
  }

  const content = (
    <>
      <h4 className="text-lg font-semibold text-cyan-300 mb-3">Create Legitimacy Proof</h4>
      <div className="mb-2 text-sm text-gray-200">Subject wallet</div>
      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        className="w-full p-2 rounded text-xs text-white placeholder-gray-400 bg-white/10 border border-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        placeholder="0x... or ENS/Farcaster handle"
      />

      <div className="mt-3 text-sm text-gray-200">Claims</div>
      <label className="block text-xs text-white mt-1">
        <input
          type="checkbox"
          className="mr-1 accent-cyan-500"
          checked={selected.age}
          onChange={() => setSelected(s => ({...s, age: !s.age}))}
        />
        Wallet age {'>'}= 365 (current: {currentVals.ageDays ?? '-'})
      </label>
      <label className="block text-xs text-white mt-1">
        <input
          type="checkbox"
          className="mr-1 accent-cyan-500"
          checked={selected.legitimacy}
          onChange={() => setSelected(s => ({...s, legitimacy: !s.legitimacy}))}
        />
        Legitimacy score {'>'}= 70 (current: {currentVals.legitimacyScore ?? '-'})
      </label>
      <label className="block text-xs text-white mt-1">
        <input
          type="checkbox"
          className="mr-1 accent-cyan-500"
          checked={selected.activity}
          onChange={() => setSelected(s => ({...s, activity: !s.activity}))}
        />
        Activity cadence {'>'}= 0.5 (current: {currentVals.activityCadenceScore ?? '-'})
      </label>

      <div className="mt-3 text-sm text-gray-200">Expires in (seconds)</div>
      <input
        type="number"
        value={expiresIn}
        onChange={e => setExpiresIn(Number(e.target.value))}
        className="w-full p-2 rounded text-xs text-white placeholder-gray-400 bg-white/10 border border-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        placeholder="2592000"
      />

      <div className="flex gap-2 mt-4">
        <button onClick={signClient} className="px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-md text-xs">Sign with Wallet</button>
        <button onClick={signServer} className="px-3 py-2 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded-md text-xs">Request Server Signature</button>
      </div>
      {status && <div className="mt-3 text-xs text-gray-300">{status}</div>}
    </>
  );

  return embedded
    ? content
    : (
      <div className="card-glow p-6 rounded-2xl border border-white/10 bg-white/5 shadow-xl">{content}</div>
    );
}
