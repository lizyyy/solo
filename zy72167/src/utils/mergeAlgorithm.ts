import type { CarbonRecord, MergeGroup, MatchDetail, RecordStatus } from '@/types';
import { editDistanceSimilarity, containsSimilarity } from './stringSimilarity';
import { getPinyin, normalizeAddress, extractKeywords } from './pinyin';

export interface MatchResult {
  recordA: CarbonRecord;
  recordB: CarbonRecord;
  matchDetail: MatchDetail;
}

export function calculateMatchScore(
  recordA: CarbonRecord,
  recordB: CarbonRecord
): MatchDetail {
  const nameA = recordA.pointName;
  const nameB = recordB.pointName;
  const addrA = recordA.address;
  const addrB = recordB.address;

  const editDistanceScore = Math.max(
    editDistanceSimilarity(nameA, nameB),
    editDistanceSimilarity(addrA, addrB)
  );

  const pinyinA = getPinyin(nameA + addrA);
  const pinyinB = getPinyin(nameB + addrB);
  const pinyinScore = editDistanceSimilarity(pinyinA, pinyinB);

  const normA = normalizeAddress(nameA + addrA);
  const normB = normalizeAddress(nameB + addrB);
  const keywordsA = new Set(extractKeywords(normA));
  const keywordsB = new Set(extractKeywords(normB));
  
  let keywordScore = 0;
  if (keywordsA.size > 0 && keywordsB.size > 0) {
    const intersection = [...keywordsA].filter(k => keywordsB.has(k));
    keywordScore = Math.round((intersection.length / Math.max(keywordsA.size, keywordsB.size)) * 100);
  }
  const containScore = containsSimilarity(normA, normB);
  keywordScore = Math.max(keywordScore, containScore);

  let locationScore = 0;
  if (recordA.location && recordB.location) {
    const dx = recordA.location.lng - recordB.location.lng;
    const dy = recordA.location.lat - recordB.location.lat;
    const distance = Math.sqrt(dx * dx + dy * dy) * 111000;
    
    if (distance < 50) {
      locationScore = 100;
    } else if (distance < 100) {
      locationScore = 80;
    } else if (distance < 200) {
      locationScore = 50;
    } else {
      locationScore = Math.max(0, 100 - distance / 5);
    }
  }

  const totalScore = Math.round(
    editDistanceScore * 0.4 +
    pinyinScore * 0.3 +
    keywordScore * 0.2 +
    locationScore * 0.1
  );

  const reason = generateMatchReason(
    editDistanceScore,
    pinyinScore,
    keywordScore,
    locationScore,
    totalScore,
    nameA,
    nameB
  );

  return {
    recordIdA: recordA.id,
    recordIdB: recordB.id,
    nameA,
    nameB,
    editDistanceScore,
    pinyinScore,
    keywordScore,
    locationScore,
    totalScore,
    reason,
  };
}

function generateMatchReason(
  editScore: number,
  pinyinScore: number,
  keywordScore: number,
  locationScore: number,
  totalScore: number,
  nameA: string,
  nameB: string
): string {
  const reasons: string[] = [];
  
  if (editScore >= 70) {
    reasons.push(`编辑距离相似度${editScore}%`);
  }
  if (pinyinScore >= 70) {
    reasons.push(`拼音相似度${pinyinScore}%`);
  }
  if (keywordScore >= 70) {
    reasons.push(`地址关键词匹配度${keywordScore}%`);
  }
  if (locationScore >= 80) {
    reasons.push(`经纬度距离50米内`);
  } else if (locationScore >= 50) {
    reasons.push(`地理位置相近`);
  }
  
  if (reasons.length === 0) {
    return `综合匹配得分${totalScore}分，建议人工确认`;
  }
  
  return reasons.join(' + ');
}

export function findMatches(records: CarbonRecord[]): MatchResult[] {
  const results: MatchResult[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const pairKey = [records[i].id, records[j].id].sort().join('-');
      if (processed.has(pairKey)) continue;
      
      const matchDetail = calculateMatchScore(records[i], records[j]);
      if (matchDetail.totalScore >= 60) {
        results.push({
          recordA: records[i],
          recordB: records[j],
          matchDetail,
        });
        processed.add(pairKey);
      }
    }
  }

  return results.sort((a, b) => b.matchDetail.totalScore - a.matchDetail.totalScore);
}

export function createMergeGroups(
  records: CarbonRecord[],
  operator: string
): { groups: MergeGroup[]; updatedRecords: CarbonRecord[] } {
  const matches = findMatches(records);
  const groups: MergeGroup[] = [];
  const recordToGroup = new Map<string, string>();
  const now = new Date().toISOString();

  matches.forEach(({ recordA, recordB, matchDetail }) => {
    const groupIdA = recordToGroup.get(recordA.id);
    const groupIdB = recordToGroup.get(recordB.id);

    if (groupIdA && groupIdB && groupIdA === groupIdB) {
      const group = groups.find(g => g.id === groupIdA)!;
      group.matchDetails.push(matchDetail);
      return;
    }

    if (groupIdA && groupIdB) {
      return;
    }

    if (groupIdA) {
      const group = groups.find(g => g.id === groupIdA)!;
      group.mergedRecordIds.push(recordB.id);
      group.recordCount = group.mergedRecordIds.length;
      group.totalCarbon += recordB.carbonAmount;
      group.matchDetails.push(matchDetail);
      recordToGroup.set(recordB.id, groupIdA);
      return;
    }

    if (groupIdB) {
      const group = groups.find(g => g.id === groupIdB)!;
      group.mergedRecordIds.push(recordA.id);
      group.recordCount = group.mergedRecordIds.length;
      group.totalCarbon += recordA.carbonAmount;
      group.matchDetails.push(matchDetail);
      recordToGroup.set(recordA.id, groupIdB);
      return;
    }

    const canonicalName = recordA.pointName.length >= recordB.pointName.length 
      ? recordA.pointName 
      : recordB.pointName;
    
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const group: MergeGroup = {
      id: groupId,
      canonicalName,
      standardAddress: recordA.address || recordB.address,
      totalCarbon: recordA.carbonAmount + recordB.carbonAmount,
      recordCount: 2,
      confidenceScore: matchDetail.totalScore,
      mergeReason: matchDetail.reason,
      status: matchDetail.totalScore >= 85 ? 'pending' : 'needs_review',
      mergedRecordIds: [recordA.id, recordB.id],
      operator,
      createdAt: now,
      matchDetails: [matchDetail],
    };

    groups.push(group);
    recordToGroup.set(recordA.id, groupId);
    recordToGroup.set(recordB.id, groupId);
  });

  const updatedRecords = records.map(record => {
    const groupId = recordToGroup.get(record.id);
    if (groupId) {
      const group = groups.find(g => g.id === groupId)!;
      const newStatus: RecordStatus = group.status === 'needs_review' ? 'needs_confirmation' : 'auto_merged';
      return {
        ...record,
        mergeGroupId: groupId,
        status: newStatus,
        updatedAt: now,
      };
    }
    return record;
  });

  return { groups, updatedRecords };
}
