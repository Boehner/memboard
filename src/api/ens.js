// api/ens.js
// Enhanced ENS metadata fetch with namehash ID query, fallback list query & ensideas fallback.

import { ethers } from "ethers";

const ENS_GRAPH = "https://api.thegraph.com/subgraphs/name/ensdomains/ens";
const ENS_IDEAS_BASE = "https://api.ensideas.com/ens/resolve/";

function makeResult(partial) {
  return {
    name: partial.name ?? null,
    nameAgeDays: partial.nameAgeDays ?? null,
    renewalCount: partial.renewalCount ?? null,
    createdAt: partial.createdAt ?? null,
    address: partial.address ?? null,
    source: partial.source ?? null,
    status: partial.status ?? "unknown",
    reason: partial.reason ?? null,
    raw: partial.raw ?? null,
  };
}

async function graphRequest(query, variables) {
  const res = await fetch(ENS_GRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    return { error: `http-${res.status}`, statusText: res.statusText };
  }
  try {
    return await res.json();
  } catch (e) {
    return { error: "json-parse", exception: String(e) };
  }
}

async function fetchById(namehashValue) {
  const query = `query ($id: ID!) { domain(id: $id) { name createdAt registrations { registrationDate expiryDate } } }`;
  return graphRequest(query, { id: namehashValue });
}

async function fetchByList(name) {
  const query = `query ($name: String!) { domains(where: { name: $name }) { name createdAt registrations { registrationDate expiryDate } } }`;
  return graphRequest(query, { name });
}

async function fallbackEnsIdeas(ensName) {
  try {
    const r = await fetch(ENS_IDEAS_BASE + encodeURIComponent(ensName));
    if (!r.ok) return null;
    const j = await r.json();
    return j; // { name, address, avatar }
  } catch {
    return null;
  }
}

export async function fetchEnsMetadata(ensName) {
  if (!ensName || !ensName.endsWith(".eth")) {
    return makeResult({ name: ensName || null, status: "invalid", reason: "not-ens" });
  }

  const lower = ensName.toLowerCase();
  let namehashValue;
  try {
    namehashValue = ethers.namehash(lower);
  } catch (e) {
    return makeResult({ name: lower, status: "error", reason: "namehash-failure" });
  }

  // 1. Try ID query first
  let idResp = await fetchById(namehashValue);
  if (idResp?.error) {
    console.warn("ENS ID query error", idResp);
  }
  const idDomain = idResp?.data?.domain;
  if (idDomain) {
    const createdAtMs = Number(idDomain.createdAt) * 1000;
    const nameAgeDays = Number.isFinite(createdAtMs) ? Math.round((Date.now() - createdAtMs) / 86400000) : null;
    return makeResult({
      name: idDomain.name || lower,
      nameAgeDays,
      renewalCount: Array.isArray(idDomain.registrations) ? idDomain.registrations.length : null,
      createdAt: Number.isFinite(createdAtMs) ? createdAtMs : null,
      source: "subgraph-id",
      status: "ok",
      raw: idDomain
    });
  }

  // 2. Fallback list query
  let listResp = await fetchByList(lower);
  if (listResp?.error) {
    console.warn("ENS list query error", listResp);
  }
  const domains = listResp?.data?.domains || [];
  if (domains.length) {
    const domain = domains[0];
    const createdAtMs = Number(domain.createdAt) * 1000;
    const nameAgeDays = Number.isFinite(createdAtMs) ? Math.round((Date.now() - createdAtMs) / 86400000) : null;
    return makeResult({
      name: domain.name || lower,
      nameAgeDays,
      renewalCount: Array.isArray(domain.registrations) ? domain.registrations.length : null,
      createdAt: Number.isFinite(createdAtMs) ? createdAtMs : null,
      source: "subgraph-list",
      status: "ok",
      raw: domain
    });
  }

  // Capture subgraph errors for diagnostics
  const combinedErrors = [
    ...(idResp?.errors || []),
    ...(listResp?.errors || [])
  ];

  // 3. Fallback external resolution
  const ideas = await fallbackEnsIdeas(lower);
  if (ideas) {
    return makeResult({
      name: ideas.name || lower,
      address: ideas.address || null,
      source: "ensideas",
      status: "fallback",
      reason: "subgraph-not-found",
      raw: ideas
    });
  }

  // 4. Definitive not-found
  return makeResult({
    name: lower,
    source: null,
    status: combinedErrors.length ? "error" : "not-found",
    reason: combinedErrors.length ? "subgraph-errors" : "no-domain",
    raw: { errors: combinedErrors }
  });
}
