export default function DataProfile({ profile }) {
  if (!profile) return null;
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-2">{profile.username}</h2>
      <p>🔗 Connections: {profile.connections?.join(", ") || "None"}</p>
      <p>📊 Data Queries: {profile.queryCount}</p>
      <p>💰 Earned: {profile.earnedMem} $MEM</p>
    </div>
  );
}