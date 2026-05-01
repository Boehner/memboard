import { ethers } from 'ethers';

/*
Usage examples:

// Create a proof signed by a server-side private key
const proof = await createLegitimacyProof({
  wallet: '0xabc...',
  claims: [{ key: 'walletAgeDays', op: '>=', value: 365 }, { key: 'legitimacyScore', op: '>=', value: 70 }],
  expiresIn: 60*60*24*30,
  signer: ENV.SERVER_PRIVATE_KEY // 0x...
});

// Verify
const res = await verifyLegitimacyProof(proof);

// Persist to local vault with consent
// import vault from './vault';
// vault.saveProof(proof, { scopes: ['profile:read'], consent: true });

*/

// Simple canonicalize JSON (stable key order)
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

// Create a minimal legitimacy proof. signer can be either:
// - a private key string (0x...)
// - an ethers.Signer instance that supports signMessage
export async function createLegitimacyProof({ wallet, claims = [], expiresIn = 60 * 60 * 24 * 30, signer }) {
  if (!wallet) throw new Error('wallet required');
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresIn;

  const payload = {
    subject: wallet,
    issuedAt: now,
    expiresAt,
    claims,
    issuer: null,
  };

  // Determine issuer and signature
  let signature = null;
  let issuer = null;

  const message = canonicalize(payload);

  if (!signer) {
    throw new Error('signer (private key or ethers.Signer) required');
  }

  if (typeof signer === 'string') {
    // private key
    const walletSigner = new ethers.Wallet(signer);
    issuer = (await walletSigner.getAddress()).toLowerCase();
    signature = await walletSigner.signMessage(message);
  } else if (typeof signer.signMessage === 'function') {
    // ethers.Signer
    try {
      issuer = (await signer.getAddress()).toLowerCase();
    } catch (_) {
      issuer = null;
    }
    signature = await signer.signMessage(message);
  } else {
    throw new Error('Unsupported signer');
  }

  const proof = {
    payload,
    issuer,
    signature,
    algo: 'eth-personal-sign',
  };

  return proof;
}

export async function verifyLegitimacyProof(proof) {
  if (!proof || !proof.payload || !proof.signature) return { valid: false, reason: 'malformed' };

  const message = canonicalize(proof.payload);
  try {
    const recovered = ethers.verifyMessage(message, proof.signature).toLowerCase();
    const issuer = proof.issuer ? proof.issuer.toLowerCase() : null;
    if (issuer && recovered !== issuer) {
      return { valid: false, reason: 'bad-issuer', recovered, issuer };
    }

    const now = Math.floor(Date.now() / 1000);
    if (proof.payload.expiresAt && proof.payload.expiresAt < now) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, recovered, payload: proof.payload };
  } catch (err) {
    return { valid: false, reason: 'verify-error', error: err && err.message ? err.message : String(err) };
  }
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}

export function exportAsJWS(proof) {
  const header = { alg: proof.algo || 'eth-personal-sign', typ: 'JWT' };
  const payload = { ...proof.payload, issuer: proof.issuer };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const sig = proof.signature || '';
  return `${h}.${p}.${sig}`;
}

export function parseJWS(jws) {
  const [h, p, s] = (jws || '').split('.');
  if (!h || !p || !s) throw new Error('invalid jws');
  const header = JSON.parse(base64urlDecode(h));
  const payload = JSON.parse(base64urlDecode(p));
  return { header, payload, signature: s };
}

export default { createLegitimacyProof, verifyLegitimacyProof, exportAsJWS, parseJWS };

export function toVerifiableCredential(proof) {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'LegitimacyProof'],
    issuer: proof.issuer,
    issuanceDate: new Date(proof.payload.issuedAt * 1000).toISOString(),
    expirationDate: new Date(proof.payload.expiresAt * 1000).toISOString(),
    credentialSubject: {
      id: proof.payload.subject,
      claims: proof.payload.claims,
    },
    proof: {
      type: proof.algo || 'EthPersonalSign',
      signature: proof.signature,
    },
  };
}
