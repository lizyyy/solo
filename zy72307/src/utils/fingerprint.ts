export interface FileFingerprint {
  contentHash: string;
  fileSize: number;
  rowCount: number;
  combined: string;
}

export function generateContentHash(data: Array<{ criterion: string; weight: string }>): string {
  const sortedData = [...data].sort((a, b) => 
    a.criterion.localeCompare(b.criterion) || a.weight.localeCompare(b.weight)
  );
  const content = sortedData.map(d => `${d.criterion}:${d.weight}`).join('|');
  
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function generateFingerprint(
  data: Array<{ criterion: string; weight: string }>,
  fileSize: number = 0,
  _fileName: string = ''
): FileFingerprint {
  const contentHash = generateContentHash(data);
  const rowCount = data.length;
  const combined = `${contentHash}-${rowCount}-${fileSize}`;
  
  return {
    contentHash,
    fileSize,
    rowCount,
    combined
  };
}

export function isDuplicateImport(
  newFingerprint: FileFingerprint,
  existingFingerprints: FileFingerprint[]
): boolean {
  return existingFingerprints.some(
    f => f.contentHash === newFingerprint.contentHash && 
         f.rowCount === newFingerprint.rowCount
  );
}

export function findMatchedBatchId(
  newFingerprint: FileFingerprint,
  existingBatches: Array<{ id: string; fingerprint: string; rowCount: number }>
): string | undefined {
  const match = existingBatches.find(
    b => {
      const [contentHash, rowCountStr] = b.fingerprint.split('-');
      return contentHash === newFingerprint.contentHash && 
             parseInt(rowCountStr) === newFingerprint.rowCount;
    }
  );
  return match?.id;
}

export function generateBatchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `BATCH-${timestamp}-${random}`.toUpperCase();
}
