import type { CommunityNameMap, JunctionPhoto, BusCardRecord } from '@/types';
import { calculateStringSimilarity, generateId, formatDateTime } from './common';

const SIMILARITY_THRESHOLD = 0.6;

export function findNameSimilarities(names: string[]): Array<{ oldName: string; newName: string; similarity: number }> {
  const results: Array<{ oldName: string; newName: string; similarity: number }> = [];
  const uniqueNames = Array.from(new Set(names)).filter(Boolean);
  
  for (let i = 0; i < uniqueNames.length; i++) {
    for (let j = i + 1; j < uniqueNames.length; j++) {
      const similarity = calculateStringSimilarity(uniqueNames[i], uniqueNames[j]);
      if (similarity >= SIMILARITY_THRESHOLD && similarity < 1) {
        const shorter = uniqueNames[i].length <= uniqueNames[j].length ? uniqueNames[i] : uniqueNames[j];
        const longer = uniqueNames[i].length > uniqueNames[j].length ? uniqueNames[i] : uniqueNames[j];
        results.push({
          oldName: shorter,
          newName: longer,
          similarity
        });
      }
    }
  }
  
  return results;
}

export function detectCommunityNamesFromData(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[]
): string[] {
  const photoCommunities = photos.map(p => p.communityName).filter(Boolean);
  const busCommunities = busRecords.map(b => b.communityName).filter(Boolean);
  return Array.from(new Set([...photoCommunities, ...busCommunities]));
}

export function autoDetectNameMaps(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  existingMaps: CommunityNameMap[]
): CommunityNameMap[] {
  const allNames = detectCommunityNamesFromData(photos, busRecords);
  const similarities = findNameSimilarities(allNames);
  
  const existingPairs = new Set(
    existingMaps.map(m => `${m.oldName}|${m.newName}`)
  );
  
  const newMaps: CommunityNameMap[] = [];
  
  for (const sim of similarities) {
    const pairKey = `${sim.oldName}|${sim.newName}`;
    const reverseKey = `${sim.newName}|${sim.oldName}`;
    
    if (!existingPairs.has(pairKey) && !existingPairs.has(reverseKey)) {
      newMaps.push({
        id: generateId(),
        oldName: sim.oldName,
        newName: sim.newName,
        status: 'pending',
        source: 'auto-detect',
        similarity: sim.similarity,
        reviewedAt: formatDateTime()
      });
    }
  }
  
  return newMaps;
}

export function applyNameMapping(
  communityName: string,
  nameMaps: CommunityNameMap[]
): string {
  const confirmedMap = nameMaps.find(
    m => m.status === 'confirmed' && 
    (m.oldName === communityName || m.newName === communityName)
  );
  
  if (confirmedMap) {
    return confirmedMap.newName;
  }
  
  return communityName;
}

export function getCanonicalCommunityNames(
  names: string[],
  nameMaps: CommunityNameMap[]
): string[] {
  const canonical = names.map(name => applyNameMapping(name, nameMaps));
  return Array.from(new Set(canonical));
}
