export function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function hashData(data: unknown): string {
  const str = JSON.stringify(data, Object.keys(data as object).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function calculateChecksum(players: unknown[], clues: unknown[], conflicts: unknown[], gaps: unknown[]): string {
  const combined = JSON.stringify({
    players: players.map(p => JSON.stringify(p)),
    clues: clues.map(c => JSON.stringify(c)),
    conflicts: conflicts.map(c => JSON.stringify(c)),
    gaps: gaps.map(g => JSON.stringify(g)),
  });
  
  let checksum = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    checksum = ((checksum << 7) - checksum) + char;
    checksum = checksum & checksum;
  }
  return Math.abs(checksum).toString(16).padStart(16, '0');
}
