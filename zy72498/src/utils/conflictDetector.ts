import type { JunctionPhoto, BusCardRecord, ConflictRecord, CommunityNameMap } from '@/types';
import { generateId, formatDateTime, calculateStringSimilarity } from './common';
import { applyNameMapping } from './nameMapper';

const EXPECTED_RATIO_THRESHOLD = 0.3;

export function detectPhotoBusConflicts(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  nameMaps: CommunityNameMap[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  
  const photosByCommunity = new Map<string, JunctionPhoto[]>();
  for (const photo of photos) {
    const canonical = applyNameMapping(photo.communityName, nameMaps);
    if (!photosByCommunity.has(canonical)) {
      photosByCommunity.set(canonical, []);
    }
    photosByCommunity.get(canonical)!.push(photo);
  }
  
  const busByCommunity = new Map<string, BusCardRecord[]>();
  for (const record of busRecords) {
    const canonical = applyNameMapping(record.communityName, nameMaps);
    if (!busByCommunity.has(canonical)) {
      busByCommunity.set(canonical, []);
    }
    busByCommunity.get(canonical)!.push(record);
  }
  
  const allCommunities = new Set([
    ...photosByCommunity.keys(),
    ...busByCommunity.keys()
  ]);
  
  for (const community of allCommunities) {
    const communityPhotos = photosByCommunity.get(community) || [];
    const communityBus = busByCommunity.get(community) || [];
    
    const hasSafeInfrastructure = communityPhotos.some(
      p => p.hasCrosswalk || p.hasTrafficLight
    );
    
    const totalCardCount = communityBus.reduce((sum, r) => sum + r.cardCount, 0);
    
    if (communityPhotos.length > 0 && communityBus.length > 0) {
      if (!hasSafeInfrastructure && totalCardCount > 50) {
        conflicts.push({
          id: generateId(),
          type: 'photo-bus-mismatch',
          severity: 'error',
          description: `小区「${community}」公交刷卡量高(${totalCardCount}次)但路口照片显示缺少安全过街设施`,
          evidenceA: {
            source: '路口照片',
            data: {
              photoCount: communityPhotos.length,
              hasCrosswalk: communityPhotos.some(p => p.hasCrosswalk),
              hasTrafficLight: communityPhotos.some(p => p.hasTrafficLight),
              samplePhotos: communityPhotos.slice(0, 3).map(p => ({
                fileName: p.fileName,
                junctionName: p.junctionName
              }))
            }
          },
          evidenceB: {
            source: '公交刷卡时段',
            data: {
              totalCardCount,
              recordCount: communityBus.length,
              peakSlot: communityBus.reduce((max, r) => 
                r.cardCount > max.cardCount ? r : max, communityBus[0]
              )?.timeSlot || 'N/A'
            }
          },
          status: 'pending',
          relatedCommunity: community,
          handledAt: formatDateTime()
        });
      }
      
      if (hasSafeInfrastructure && totalCardCount < 5) {
        conflicts.push({
          id: generateId(),
          type: 'photo-bus-mismatch',
          severity: 'warning',
          description: `小区「${community}」有安全设施但公交刷卡量偏低(${totalCardCount}次)，请确认数据完整性`,
          evidenceA: {
            source: '路口照片',
            data: {
              hasCrosswalk: communityPhotos.some(p => p.hasCrosswalk),
              hasTrafficLight: communityPhotos.some(p => p.hasTrafficLight)
            }
          },
          evidenceB: {
            source: '公交刷卡时段',
            data: {
              totalCardCount,
              recordCount: communityBus.length
            }
          },
          status: 'pending',
          relatedCommunity: community,
          handledAt: formatDateTime()
        });
      }
    }
    
    if (communityPhotos.length > 0 && communityBus.length === 0) {
      conflicts.push({
        id: generateId(),
        type: 'data-inconsistency',
        severity: 'warning',
        description: `小区「${community}」有路口照片但缺少公交刷卡数据`,
        evidenceA: {
          source: '路口照片',
          data: { photoCount: communityPhotos.length }
        },
        evidenceB: {
          source: '公交刷卡时段',
          data: { recordCount: 0, note: '无数据' }
        },
        status: 'pending',
        relatedCommunity: community,
        handledAt: formatDateTime()
      });
    }
    
    if (communityBus.length > 0 && communityPhotos.length === 0) {
      conflicts.push({
        id: generateId(),
        type: 'data-inconsistency',
        severity: 'warning',
        description: `小区「${community}」有公交刷卡数据但缺少路口照片`,
        evidenceA: {
          source: '路口照片',
          data: { photoCount: 0, note: '无照片' }
        },
        evidenceB: {
          source: '公交刷卡时段',
          data: { recordCount: communityBus.length, totalCardCount }
        },
        status: 'pending',
        relatedCommunity: community,
        handledAt: formatDateTime()
      });
    }
  }
  
  return conflicts;
}

export function detectDataInconsistencies(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  
  for (const photo of photos) {
    if (!photo.communityName || photo.communityName.trim() === '') {
      conflicts.push({
        id: generateId(),
        type: 'data-inconsistency',
        severity: 'error',
        description: `照片「${photo.fileName}」缺少小区名称`,
        evidenceA: {
          source: '路口照片',
          data: { fileName: photo.fileName, communityName: photo.communityName || '(空)' }
        },
        evidenceB: {
          source: '数据规范',
          data: { requirement: '小区名称必填' }
        },
        status: 'pending',
        handledAt: formatDateTime()
      });
    }
    
    if (!photo.junctionName || photo.junctionName.trim() === '') {
      conflicts.push({
        id: generateId(),
        type: 'data-inconsistency',
        severity: 'warning',
        description: `照片「${photo.fileName}」缺少路口名称`,
        evidenceA: {
          source: '路口照片',
          data: { fileName: photo.fileName, junctionName: photo.junctionName || '(空)' }
        },
        evidenceB: {
          source: '数据规范',
          data: { requirement: '路口名称建议填写' }
        },
        status: 'pending',
        handledAt: formatDateTime()
      });
    }
  }
  
  for (const record of busRecords) {
    if (record.cardCount < 0) {
      conflicts.push({
        id: generateId(),
        type: 'data-inconsistency',
        severity: 'error',
        description: `小区「${record.communityName}」公交刷卡量为负数(${record.cardCount})`,
        evidenceA: {
          source: '公交刷卡时段',
          data: { communityName: record.communityName, cardCount: record.cardCount, timeSlot: record.timeSlot }
        },
        evidenceB: {
          source: '数据规范',
          data: { requirement: '刷卡量不能为负' }
        },
        status: 'pending',
        relatedCommunity: record.communityName,
        handledAt: formatDateTime()
      });
    }
  }
  
  return conflicts;
}

export function detectAllConflicts(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  nameMaps: CommunityNameMap[]
): ConflictRecord[] {
  return [
    ...detectPhotoBusConflicts(photos, busRecords, nameMaps),
    ...detectDataInconsistencies(photos, busRecords)
  ];
}

export function detectCommunityNameConflicts(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  const allNames = [
    ...photos.map(p => p.communityName),
    ...busRecords.map(b => b.communityName)
  ].filter(Boolean);
  
  const uniqueNames = Array.from(new Set(allNames));
  
  for (let i = 0; i < uniqueNames.length; i++) {
    for (let j = i + 1; j < uniqueNames.length; j++) {
      const similarity = calculateStringSimilarity(uniqueNames[i], uniqueNames[j]);
      if (similarity >= 0.7 && similarity < 1) {
        conflicts.push({
          id: generateId(),
          type: 'community-name-ambiguity',
          severity: 'warning',
          description: `检测到疑似新旧小区名称：「${uniqueNames[i]}」与「${uniqueNames[j]}」（相似度${(similarity * 100).toFixed(1)}%）`,
          evidenceA: {
            source: '数据中的名称A',
            data: { name: uniqueNames[i], occurences: allNames.filter(n => n === uniqueNames[i]).length }
          },
          evidenceB: {
            source: '数据中的名称B',
            data: { name: uniqueNames[j], occurences: allNames.filter(n => n === uniqueNames[j]).length }
          },
          status: 'pending',
          handledAt: formatDateTime()
        });
      }
    }
  }
  
  return conflicts;
}
