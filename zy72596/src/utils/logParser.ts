export function computeSourceHash(lineNumber: number, content: string, batchId: string): string {
  const str = `${batchId}:${lineNumber}:${content.trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function parseTrainingLogs(text: string, batchId: string): Array<{
  lineNumber: number;
  content: string;
  sourceHash: string;
}> {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  return lines.map((line, idx) => ({
    lineNumber: idx + 1,
    content: line.trim(),
    sourceHash: computeSourceHash(idx + 1, line, batchId),
  }));
}
