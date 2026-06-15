export function generateContentFingerprint(name: string, data: Record<string, unknown>): string {
  const stable: Record<string, unknown> = {};
  const transientKeys = new Set(['timestamp', 'importTime', 'createdAt', 'updatedAt']);
  for (const key of Object.keys(data).sort()) {
    if (!transientKeys.has(key)) {
      stable[key] = data[key];
    }
  }
  const raw = JSON.stringify({ name, ...stable });
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
