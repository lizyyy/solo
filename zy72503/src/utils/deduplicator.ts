import type { Conflict, KnowledgeLink, ImportResultItem } from '@/types';

export const generateUniqueKey = (sampleNumber: string, modelVersion: string): string => {
  return `${sampleNumber}_${modelVersion}`;
};

const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const labelPool: [string, string][] = [
  ['正常商品', '涉黄图片'],
  ['暴力内容', '正常内容'],
  ['广告引流', '正常推广'],
  ['政治敏感', '正常时政'],
  ['低俗内容', '正常着装'],
  ['侵权图片', '正常内容'],
];

export const deterministicGetLabel = (sampleNumber: string, modelVersion: string): string => {
  const hash = simpleHash(`${sampleNumber}_${modelVersion}`);
  const poolIndex = hash % labelPool.length;
  const labelIndex = hash % 2;
  return labelPool[poolIndex][labelIndex];
};

export const deterministicGetConfidence = (sampleNumber: string, modelVersion: string): number => {
  const hash = simpleHash(`${sampleNumber}_${modelVersion}_conf`);
  return 0.5 + (hash % 50) / 100;
};

export interface DedupResult {
  newConflicts: Conflict[];
  updatedConflicts: Conflict[];
  duplicateCount: number;
  modelChangedCount: number;
  noConflictCount: number;
  items: ImportResultItem[];
}

const parseVersion = (v: string): number[] => {
  const match = v.match(/v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
};

const compareVersions = (a: string, b: string): number => {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
};

export const detectDuplicatesAndChanges = (
  newLinks: KnowledgeLink[],
  existingConflicts: Conflict[],
  existingLinks: KnowledgeLink[]
): DedupResult => {
  const result: DedupResult = {
    newConflicts: [],
    updatedConflicts: [],
    duplicateCount: 0,
    modelChangedCount: 0,
    noConflictCount: 0,
    items: [],
  };

  const batchId = newLinks.length > 0 ? newLinks[0].importBatch : `batch_${Date.now()}`;
  const now = new Date().toISOString();

  const existingConflictMap = new Map<string, Conflict>();
  existingConflicts.forEach((c) => {
    existingConflictMap.set(generateUniqueKey(c.sampleNumber, c.modelVersion), c);
  });

  const sampleVersions = new Map<string, string[]>();

  const addSampleVersion = (sampleNumber: string, version: string) => {
    const versions = sampleVersions.get(sampleNumber) || [];
    if (!versions.includes(version)) {
      versions.push(version);
      versions.sort((a, b) => compareVersions(a, b));
      sampleVersions.set(sampleNumber, versions);
    }
  };

  existingConflicts.forEach((c) => addSampleVersion(c.sampleNumber, c.modelVersion));
  existingLinks.forEach((link) => addSampleVersion(link.sampleNumber, link.modelVersion));

  const dedupedNewLinks: KnowledgeLink[] = [];
  const seenKeys = new Set<string>();
  
  newLinks.forEach((link) => {
    const key = generateUniqueKey(link.sampleNumber, link.modelVersion);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dedupedNewLinks.push(link);
    } else {
      result.duplicateCount++;
      result.items.push({
        sampleNumber: link.sampleNumber,
        modelVersion: link.modelVersion,
        url: link.url,
        status: 'duplicate',
        reason: '本次导入内重复，已跳过',
      });
    }
  });

  dedupedNewLinks.sort((a, b) => {
    if (a.sampleNumber !== b.sampleNumber) {
      return a.sampleNumber.localeCompare(b.sampleNumber);
    }
    return compareVersions(a.modelVersion, b.modelVersion);
  });

  dedupedNewLinks.forEach((link) => {
    const key = generateUniqueKey(link.sampleNumber, link.modelVersion);

    const existingConflict = existingConflictMap.get(key);
    if (existingConflict) {
      result.duplicateCount++;
      result.items.push({
        sampleNumber: link.sampleNumber,
        modelVersion: link.modelVersion,
        url: link.url,
        status: 'duplicate',
        conflictId: existingConflict.id,
        duplicateSourceBatch: existingConflict.importBatch,
        reason: `历史批次 ${existingConflict.importBatch} 已存在相同样本+版本的冲突记录，已跳过`,
      });
      addSampleVersion(link.sampleNumber, link.modelVersion);
      return;
    }

    const versions = sampleVersions.get(link.sampleNumber) || [];
    const versionExists = versions.includes(link.modelVersion);
    const isFirstEver = versions.length === 0;
    const prevVersion = versions.length > 0 ? versions[versions.length - 1] : null;
    const isModelChanged = !versionExists && !isFirstEver;

    if (isModelChanged) {
      const prevLabel = deterministicGetLabel(link.sampleNumber, prevVersion);
      const newLabel = deterministicGetLabel(link.sampleNumber, link.modelVersion);
      const prevConfidence = deterministicGetConfidence(link.sampleNumber, prevVersion);
      const newConfidence = deterministicGetConfidence(link.sampleNumber, link.modelVersion);

      const hasLabelConflict = prevLabel !== newLabel;

      if (hasLabelConflict) {
        const newConflict: Conflict = {
          id: `c_${simpleHash(key).toString(36)}_${simpleHash(batchId).toString(36)}`,
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          previousModelVersion: prevVersion,
          labelA: prevLabel,
          labelB: newLabel,
          confidenceA: prevConfidence,
          confidenceB: newConfidence,
          status: 'pending',
          sourceUrl: link.url,
          isModelVersionChanged: true,
          currentRemark: `模型版本从 ${prevVersion} 升级到 ${link.modelVersion}，标签从「${prevLabel}」变为「${newLabel}」，待运营复核人确认`,
          importBatch: batchId,
          createdAt: now,
          updatedAt: now,
        };

        result.modelChangedCount++;
        result.updatedConflicts.push(newConflict);
        result.items.push({
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          url: link.url,
          status: 'model_changed',
          previousModelVersion: prevVersion,
          previousLabel: prevLabel,
          newLabel: newLabel,
          conflictId: newConflict.id,
          reason: `模型版本 ${prevVersion} → ${link.modelVersion}，标签「${prevLabel}」→「${newLabel}」，标记为待复核`,
        });
      } else {
        result.noConflictCount++;
        result.items.push({
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          url: link.url,
          status: 'no_conflict',
          previousModelVersion: prevVersion,
          previousLabel: prevLabel,
          newLabel: newLabel,
          reason: `模型版本 ${prevVersion} → ${link.modelVersion}，标签均为「${newLabel}」，无冲突`,
        });
      }
    } else if (isFirstEver) {
      const labelA = deterministicGetLabel(link.sampleNumber, 'baseline');
      const labelB = deterministicGetLabel(link.sampleNumber, link.modelVersion);
      const confidenceA = deterministicGetConfidence(link.sampleNumber, 'baseline');
      const confidenceB = deterministicGetConfidence(link.sampleNumber, link.modelVersion);

      const hasConflict = labelA !== labelB;

      if (hasConflict) {
        const newConflict: Conflict = {
          id: `c_${simpleHash(key).toString(36)}_${simpleHash(batchId).toString(36)}`,
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          labelA,
          labelB,
          confidenceA,
          confidenceB,
          status: 'pending',
          sourceUrl: link.url,
          isModelVersionChanged: false,
          importBatch: batchId,
          createdAt: now,
          updatedAt: now,
        };

        result.newConflicts.push(newConflict);
        result.items.push({
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          url: link.url,
          status: 'new',
          conflictId: newConflict.id,
          previousLabel: labelA,
          newLabel: labelB,
          reason: `首次导入，检测到标签冲突：「${labelA}」 vs 「${labelB}」`,
        });
      } else {
        result.noConflictCount++;
        result.items.push({
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          url: link.url,
          status: 'no_conflict',
          reason: `首次导入，标签一致（${labelA}），无冲突`,
        });
      }
    } else if (versionExists) {
      const label = deterministicGetLabel(link.sampleNumber, link.modelVersion);
      const hasExistingConflict = existingConflictMap.has(key);
      
      if (hasExistingConflict) {
        result.duplicateCount++;
        const existingConflict = existingConflictMap.get(key)!;
        result.items.push({
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          url: link.url,
          status: 'duplicate',
          conflictId: existingConflict.id,
          duplicateSourceBatch: existingConflict.importBatch,
          reason: `历史批次 ${existingConflict.importBatch} 已存在相同冲突记录，已跳过`,
        });
      } else {
        result.noConflictCount++;
        result.items.push({
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          url: link.url,
          status: 'no_conflict',
          reason: `历史批次已导入过，标签一致（${label}），仍无冲突`,
        });
      }
    } else {
      result.duplicateCount++;
      result.items.push({
        sampleNumber: link.sampleNumber,
        modelVersion: link.modelVersion,
        url: link.url,
        status: 'duplicate',
        reason: '样本已存在且版本无变更，已跳过',
      });
    }

    addSampleVersion(link.sampleNumber, link.modelVersion);
  });

  return result;
};

const hashToTime = (str: string): string => {
    const hash = simpleHash(str);
    const date = new Date(1700000000000 + (hash % 10000000000));
    return date.toISOString();
  };

export const parseKnowledgeLinks = (text: string, batchId?: string): KnowledgeLink[] => {
  const lines = text.split('\n').filter((line) => line.trim());
  const actualBatchId = batchId || `batch_${Date.now()}`;
  const importedAt = hashToTime(actualBatchId);

  return lines.map((line, index) => {
    const trimmed = line.trim();
    
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : trimmed;

    let sampleNumber = '';
    
    const imgPattern = trimmed.match(/(IMG[-_]?\d{4}[-_]?\d{3,})/i);
    if (imgPattern) {
      sampleNumber = imgPattern[1].toUpperCase().replace(/_/g, '-');
    }
    
    if (!sampleNumber) {
      const numPattern = trimmed.match(/(\d{6,})/);
      if (numPattern) {
        sampleNumber = `IMG-DEFAULT-${numPattern[1]}`;
      }
    }
    
    if (!sampleNumber) {
      const pathPattern = trimmed.match(/\/([^\/?#]+)(?:[?#]|$)/);
      if (pathPattern) {
        const name = pathPattern[1].replace(/\.[^.]+$/, '');
        sampleNumber = name.toUpperCase().substring(0, 20);
      }
    }
    
    if (!sampleNumber) {
      sampleNumber = `SAMPLE-${String(index + 1).padStart(4, '0')}`;
    }

    let modelVersion = 'v3.2.0';
    
    const versionParam = trimmed.match(/[?&]v=([^&]+)/i);
    if (versionParam) {
      modelVersion = versionParam[1].startsWith('v') 
        ? versionParam[1] 
        : `v${versionParam[1]}`;
    }
    
    const versionInPath = trimmed.match(/\/v(\d+\.\d+\.\d+)\//i);
    if (versionInPath) {
      modelVersion = `v${versionInPath[1]}`;
    }
    
    const explicitVersion = trimmed.match(/model[-_]?version[:\s]+v?(\d+\.\d+\.\d+)/i);
    if (explicitVersion) {
      modelVersion = `v${explicitVersion[1]}`;
    }

    return {
      id: `kl_${actualBatchId}_${index}`,
      url,
      sampleNumber,
      modelVersion,
      importedAt,
      importBatch: actualBatchId,
    };
  });
};

export const getBatches = (links: KnowledgeLink[]): { batchId: string; count: number; importedAt: string }[] => {
  const batchMap = new Map<string, { count: number; importedAt: string }>();
  links.forEach((link) => {
    const existing = batchMap.get(link.importBatch);
    if (existing) {
      existing.count++;
    } else {
      batchMap.set(link.importBatch, { count: 1, importedAt: link.importedAt });
    }
  });
  return Array.from(batchMap.entries())
    .map(([batchId, data]) => ({
      batchId,
      count: data.count,
      importedAt: data.importedAt,
    }))
    .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
};
