export interface DiffResult {
  field: string;
  before: any;
  after: any;
}

export function calculateDiff(before: any, after: any, fields?: string[]): DiffResult[] {
  const diffs: DiffResult[] = [];
  const keys = fields || Object.keys({ ...before, ...after });

  for (const key of keys) {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    
    if (beforeVal !== afterVal) {
      diffs.push({
        field: key,
        before: beforeVal,
        after: afterVal
      });
    }
  }

  return diffs;
}

export function formatDiffForDisplay(diffs: DiffResult[]): string {
  return diffs.map(d => `${d.field}: ${d.before} -> ${d.after}`).join('\n');
}
