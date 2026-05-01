// api/vault.js
// Simple client-side vault for storing user-consented proofs.

const STORAGE_KEY = 'memboard:proofs:v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { proofs: [] };
  } catch (e) {
    return { proofs: [] };
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {}
}

export function listProofs() {
  return readStore().proofs || [];
}

export function saveProof(proof, { scopes = [], consent = true, note = '' } = {}) {
  const store = readStore();
  const entry = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8), proof, scopes, consent, note, createdAt: Date.now() };
  store.proofs = store.proofs || [];
  store.proofs.push(entry);
  writeStore(store);
  return entry;
}

export function removeProof(id) {
  const store = readStore();
  store.proofs = (store.proofs || []).filter(p => p.id !== id);
  writeStore(store);
}

export default { listProofs, saveProof, removeProof };
