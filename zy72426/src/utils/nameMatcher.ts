import type { SongRecord } from '@/types';

const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
    .replace(/\s+/g, '');
};

const calculateSimilarity = (a: string, b: string): number => {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;

  const longer = normA.length > normB.length ? normA : normB;
  const shorter = normA.length > normB.length ? normB : normA;

  if (longer.length === 0) return 1;

  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }

  return matches / longer.length;
};

export const findNameMappingCandidates = (records: SongRecord[]): Map<string, string[]> => {
  const groups = new Map<string, string[]>();
  const processed = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const recordA = records[i];
    if (processed.has(recordA.id)) continue;

    const groupMembers: string[] = [recordA.id];
    processed.add(recordA.id);

    for (let j = i + 1; j < records.length; j++) {
      const recordB = records[j];
      if (processed.has(recordB.id)) continue;

      const liveSimilarity = calculateSimilarity(recordA.liveName, recordB.liveName);
      const copyrightSimilarity = calculateSimilarity(recordA.copyrightName, recordB.copyrightName);
      const crossSimilarity1 = calculateSimilarity(recordA.liveName, recordB.copyrightName);
      const crossSimilarity2 = calculateSimilarity(recordA.copyrightName, recordB.liveName);

      const maxSimilarity = Math.max(liveSimilarity, copyrightSimilarity, crossSimilarity1, crossSimilarity2);

      if (maxSimilarity >= 0.6) {
        groupMembers.push(recordB.id);
        processed.add(recordB.id);
      }
    }

    if (groupMembers.length >= 2) {
      const groupId = `group_${Date.now()}_${i}`;
      groups.set(groupId, groupMembers);
    }
  }

  return groups;
};

export const isNameMappingCandidate = (recordA: SongRecord, recordB: SongRecord): boolean => {
  const liveSimilarity = calculateSimilarity(recordA.liveName, recordB.liveName);
  const copyrightSimilarity = calculateSimilarity(recordA.copyrightName, recordB.copyrightName);
  const crossSimilarity1 = calculateSimilarity(recordA.liveName, recordB.copyrightName);
  const crossSimilarity2 = calculateSimilarity(recordA.copyrightName, recordB.liveName);

  return Math.max(liveSimilarity, copyrightSimilarity, crossSimilarity1, crossSimilarity2) >= 0.6;
};
