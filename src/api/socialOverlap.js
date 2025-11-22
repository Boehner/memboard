export function computeSocialOverlap(identities = []) {
  // Extract all non-null handles/usernames
  const handles = identities
    .map(i => i.username || i.handle)
    .filter(Boolean)
    .map(h => h.toLowerCase());

  if (handles.length <= 1) {
    return { overlapScore: 0 };
  }

  // Count occurrences of each handle
  const counts = handles.reduce((map, h) => {
    map[h] = (map[h] || 0) + 1;
    return map;
  }, {});

  const distinct = Object.keys(counts).length;

  // How many handles appear on ≥ 2 platforms?
  const overlappingHandles = Object.values(counts).filter(c => c >= 2).length;

  // Overlap score = proportion of distinct handles that overlap
  const overlapScore = distinct > 0 ? overlappingHandles / distinct : 0;

  return { overlapScore };
}
