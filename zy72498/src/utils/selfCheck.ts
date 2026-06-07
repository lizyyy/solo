import type { JunctionPhoto, BusCardRecord, SelfCheckReport, CommunityNameMap, SummaryVersion } from '@/types';
import { generateId, formatDateTime, calculateStringSimilarity } from './common';
import { applyNameMapping } from './nameMapper';

export function checkDuplicateImport(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[]
): SelfCheckReport['items']['duplicateImport'] {
  const issues: SelfCheckReport['items']['duplicateImport']['issues'] = [];
  
  const photoBatches = new Map<string, JunctionPhoto[]>();
  for (const photo of photos) {
    if (!photoBatches.has(photo.importBatch)) {
      photoBatches.set(photo.importBatch, []);
    }
    photoBatches.get(photo.importBatch)!.push(photo);
  }
  
  const busBatches = new Map<string, BusCardRecord[]>();
  for (const record of busRecords) {
    if (!busBatches.has(record.importBatch)) {
      busBatches.set(record.importBatch, []);
    }
    busBatches.get(record.importBatch)!.push(record);
  }
  
  const photoFileNames = photos.map(p => p.fileName);
  const duplicateFileNames = photoFileNames.filter(
    (name, index) => photoFileNames.indexOf(name) !== index
  );
  
  if (duplicateFileNames.length > 0) {
    const uniqueDuplicates = Array.from(new Set(duplicateFileNames));
    issues.push({
      batch: 'multiple',
      count: uniqueDuplicates.length,
      description: `检测到 ${uniqueDuplicates.length} 个重复的照片文件名：${uniqueDuplicates.slice(0, 3).join('、')}${uniqueDuplicates.length > 3 ? '...' : ''}`
    });
  }
  
  for (const [batch, batchPhotos] of photoBatches) {
    if (batchPhotos.length > 0) {
      const hashes = batchPhotos.map(p => `${p.communityName}-${p.junctionName}-${p.photoTime}`);
      const duplicates = hashes.filter((h, i) => hashes.indexOf(h) !== i);
      if (duplicates.length > 0) {
        issues.push({
          batch,
          count: duplicates.length,
          description: `批次 ${batch} 中有 ${duplicates.length} 条疑似重复的照片记录`
        });
      }
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

export function checkCommunityNames(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  nameMaps: CommunityNameMap[]
): SelfCheckReport['items']['communityName'] {
  const issues: SelfCheckReport['items']['communityName']['issues'] = [];
  
  const allNames = [
    ...photos.map(p => p.communityName),
    ...busRecords.map(b => b.communityName)
  ].filter(Boolean);
  
  const uniqueNames = Array.from(new Set(allNames));
  
  for (let i = 0; i < uniqueNames.length; i++) {
    for (let j = i + 1; j < uniqueNames.length; j++) {
      const similarity = calculateStringSimilarity(uniqueNames[i], uniqueNames[j]);
      
      const hasExistingMap = nameMaps.some(
        m => m.status === 'confirmed' &&
        ((m.oldName === uniqueNames[i] && m.newName === uniqueNames[j]) ||
         (m.oldName === uniqueNames[j] && m.newName === uniqueNames[i]))
      );
      
      const hasPendingMap = nameMaps.some(
        m => m.status === 'pending' &&
        ((m.oldName === uniqueNames[i] && m.newName === uniqueNames[j]) ||
         (m.oldName === uniqueNames[j] && m.newName === uniqueNames[i]))
      );
      
      if (similarity >= 0.6 && similarity < 1 && !hasExistingMap && !hasPendingMap) {
        issues.push({
          oldName: uniqueNames[i].length <= uniqueNames[j].length ? uniqueNames[i] : uniqueNames[j],
          newName: uniqueNames[i].length > uniqueNames[j].length ? uniqueNames[i] : uniqueNames[j],
          similarity,
          description: `「${uniqueNames[i]}」与「${uniqueNames[j]}」相似度 ${(similarity * 100).toFixed(1)}%，可能为同一小区新旧名称，已加入复核池待市政巡检员确认`
        });
      }
    }
  }
  
  const unmappedNames = uniqueNames.filter(name => {
    return !nameMaps.some(m => 
      m.status === 'confirmed' && 
      (m.oldName === name || m.newName === name)
    );
  });
  
  if (unmappedNames.length > 0 && uniqueNames.length > 5) {
    issues.push({
      oldName: unmappedNames[0],
      newName: '',
      similarity: 0,
      description: `有 ${unmappedNames.length} 个小区名称未建立映射关系，请确认是否需要处理`
    });
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

export function checkRecalculate(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  nameMaps: CommunityNameMap[],
  lastSummary?: SummaryVersion
): SelfCheckReport['items']['recalculate'] {
  const issues: SelfCheckReport['items']['recalculate']['issues'] = [];
  
  const supplementaryRecords = busRecords.filter(r => r.isSupplementary);
  
  if (supplementaryRecords.length > 0) {
    const canonicalCommunities = new Set(
      busRecords.map(r => applyNameMapping(r.communityName, nameMaps))
    );
    
    const currentTotalCards = busRecords.reduce((sum, r) => sum + r.cardCount, 0);
    const nonSupplementaryCards = busRecords.filter(r => !r.isSupplementary).reduce((sum, r) => sum + r.cardCount, 0);
    
    if (lastSummary) {
      const oldTotal = lastSummary.stats.totalBusRecords;
      const newTotal = busRecords.length;
      
      if (Math.abs(newTotal - oldTotal) / (oldTotal || 1) > 0.1) {
        issues.push({
          field: '公交记录总数',
          oldValue: oldTotal,
          newValue: newTotal,
          description: `补录后公交记录总数从 ${oldTotal} 变为 ${newTotal}，变化超过 10%`
        });
      }
    }
    
    if (nonSupplementaryCards > 0) {
      const changeRatio = (currentTotalCards - nonSupplementaryCards) / nonSupplementaryCards;
      if (Math.abs(changeRatio) > 0.2) {
        issues.push({
          field: '公交刷卡总量',
          oldValue: nonSupplementaryCards,
          newValue: currentTotalCards,
          description: `补录后公交刷卡总量变化 ${((changeRatio) * 100).toFixed(1)}%，请确认是否合理`
        });
      }
    }
    
    issues.push({
      field: '补录记录数',
      oldValue: 0,
      newValue: supplementaryRecords.length,
      description: `检测到 ${supplementaryRecords.length} 条补录公交数据，已自动触发重算`
    });
  }
  
  return {
    passed: issues.filter(i => i.field !== '补录记录数').length === 0,
    issues
  };
}

export function checkExportConsistency(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  nameMaps: CommunityNameMap[]
): SelfCheckReport['items']['exportConsistency'] {
  const issues: SelfCheckReport['items']['exportConsistency']['issues'] = [];
  
  try {
    const exportData = {
      photos,
      busRecords,
      nameMaps,
      exportTime: formatDateTime()
    };
    
    const jsonString = JSON.stringify(exportData);
    const parsedBack = JSON.parse(jsonString);
    
    if (parsedBack.photos.length !== photos.length) {
      issues.push({
        type: '照片数据',
        description: `导出前后照片数量不一致：导出 ${photos.length} 条，导入 ${parsedBack.photos.length} 条`
      });
    }
    
    if (parsedBack.busRecords.length !== busRecords.length) {
      issues.push({
        type: '公交数据',
        description: `导出前后公交记录数量不一致：导出 ${busRecords.length} 条，导入 ${parsedBack.busRecords.length} 条`
      });
    }
    
    const photoIds = photos.map(p => p.id).sort();
    const parsedPhotoIds = parsedBack.photos.map((p: JunctionPhoto) => p.id).sort();
    
    if (JSON.stringify(photoIds) !== JSON.stringify(parsedPhotoIds)) {
      issues.push({
        type: '照片ID',
        description: '导出前后照片ID不一致'
      });
    }
    
  } catch (error) {
    issues.push({
      type: '序列化错误',
      description: `数据序列化失败：${error instanceof Error ? error.message : '未知错误'}`
    });
  }
  
  const invalidPhotos = photos.filter(p => 
    !p.id || !p.communityName || !p.importBatch
  );
  
  if (invalidPhotos.length > 0) {
    issues.push({
      type: '照片数据完整性',
      description: `有 ${invalidPhotos.length} 条照片记录缺少必填字段`
    });
  }
  
  const invalidBusRecords = busRecords.filter(r => 
    !r.id || !r.communityName || r.cardCount == null
  );
  
  if (invalidBusRecords.length > 0) {
    issues.push({
      type: '公交数据完整性',
      description: `有 ${invalidBusRecords.length} 条公交记录缺少必填字段`
    });
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

export function runFullSelfCheck(
  photos: JunctionPhoto[],
  busRecords: BusCardRecord[],
  nameMaps: CommunityNameMap[],
  lastSummary?: SummaryVersion
): SelfCheckReport {
  const duplicateImport = checkDuplicateImport(photos, busRecords);
  const communityName = checkCommunityNames(photos, busRecords, nameMaps);
  const recalculate = checkRecalculate(photos, busRecords, nameMaps, lastSummary);
  const exportConsistency = checkExportConsistency(photos, busRecords, nameMaps);
  
  const overallPassed = 
    duplicateImport.passed &&
    communityName.passed &&
    recalculate.passed &&
    exportConsistency.passed;
  
  return {
    id: generateId(),
    runTime: formatDateTime(),
    items: {
      duplicateImport,
      communityName,
      recalculate,
      exportConsistency
    },
    overallPassed
  };
}
