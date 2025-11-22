// api/identityConsistency.js
export function computeIdentityConsistency(identities = []) {
  const handles = new Map();
  const pfps = new Map();

  identities.forEach(i => {
    const h = (i.username || i.handle || "").toLowerCase();
    if (h) handles.set(h, (handles.get(h) || 0) + 1);

    const p = i.avatar || null;
    if (p) pfps.set(p, (pfps.get(p) || 0) + 1);
  });

  // handle used on 2+ platforms
  const consistentHandles = [...handles.values()].filter(c => c >= 2).length;

  // same PFP used 2+ platforms
  const consistentPfps = [...pfps.values()].filter(c => c >= 2).length;
  console.log('Computed identity consistency:', {
  handleConsistency: handles.size ? consistentHandles / handles.size : 0,
  pfpConsistency: pfps.size ? consistentPfps / pfps.size : 0,
});
  return {
    handleConsistency: handles.size ? consistentHandles / handles.size : 0,
    pfpConsistency: pfps.size ? consistentPfps / pfps.size : 0,
  };
}
