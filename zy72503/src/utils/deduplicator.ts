import type { Conflict, KnowledgeLink } from '@/types';

export const generateUniqueKey = (sampleNumber: string, modelVersion: string): string => {
  return `${sampleNumber}_${modelVersion}`;
};

export interface DedupResult {
  newConflicts: Conflict[];
  updatedConflicts: Conflict[];
  duplicateCount: number;
  modelChangedCount: number;
}

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
  };

  const existingMap = new Map<string, Conflict>();
  existingConflicts.forEach((c) => {
    existingMap.set(generateUniqueKey(c.sampleNumber, c.modelVersion), c);
  });

  const sampleLatestVersion = new Map<string, string>();
  existingLinks.forEach((link) => {
    const current = sampleLatestVersion.get(link.sampleNumber);
    if (!current || link.modelVersion > current) {
      sampleLatestVersion.set(link.sampleNumber, link.modelVersion);
    }
  });
  existingConflicts.forEach((c) => {
    const current = sampleLatestVersion.get(c.sampleNumber);
    if (!current || c.modelVersion > current) {
      sampleLatestVersion.set(c.sampleNumber, c.modelVersion);
    }
  });

  const processedKeys = new Set<string>();

  newLinks.forEach((link) => {
    const key = generateUniqueKey(link.sampleNumber, link.modelVersion);
    
    if (processedKeys.has(key)) {
      result.duplicateCount++;
      return;
    }
    processedKeys.add(key);

    const existingConflict = existingMap.get(key);
    const previousVersion = sampleLatestVersion.get(link.sampleNumber);
    const isModelChanged = previousVersion && previousVersion !== link.modelVersion;

    if (existingConflict) {
      result.duplicateCount++;
      return;
    }

    if (isModelChanged) {
      result.modelChangedCount++;
      const labels = generateMockLabels();
      result.updatedConflicts.push({
        id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sampleNumber: link.sampleNumber,
        modelVersion: link.modelVersion,
        previousModelVersion: previousVersion,
        labelA: labels[0],
        labelB: labels[1],
        confidenceA: Math.random() * 0.3 + 0.5,
        confidenceB: Math.random() * 0.3 + 0.5,
        status: 'pending',
        sourceUrl: link.url,
        isModelVersionChanged: true,
        currentRemark: `模型版本从${previousVersion}升级到${link.modelVersion}，标签结果变更，待运营复核`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      if (Math.random() > 0.5) {
        const labels = generateMockLabels();
        result.newConflicts.push({
          id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sampleNumber: link.sampleNumber,
          modelVersion: link.modelVersion,
          labelA: labels[0],
          labelB: labels[1],
          confidenceA: Math.random() * 0.3 + 0.5,
          confidenceB: Math.random() * 0.3 + 0.5,
          status: 'pending',
          sourceUrl: link.url,
          isModelVersionChanged: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        result.duplicateCount++;
      }
    }

    if (!previousVersion || link.modelVersion > previousVersion) {
      sampleLatestVersion.set(link.sampleNumber, link.modelVersion);
    }
  });

  return result;
};

const labelPool: [string, string][] = [
  ['正常商品', '涉黄图片'],
  ['暴力内容', '正常内容'],
  ['广告引流', '正常推广'],
  ['政治敏感', '正常时政'],
  ['低俗内容', '正常着装'],
  ['侵权图片', '正常内容'],
];

const generateMockLabels = (): [string, string] => {
  return labelPool[Math.floor(Math.random() * labelPool.length)] as [string, string];
};

export const parseKnowledgeLinks = (text: string): KnowledgeLink[] => {
  const lines = text.split('\n').filter((line) => line.trim());
  const batchId = `batch_${Date.now()}`;
  const now = new Date().toISOString();

  return lines.map((line, index) => {
    const trimmed = line.trim();
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : trimmed;
    
    const sampleMatch = trimmed.match(/(IMG[-_]\d+[-_]\d+)/i) || trimmed.match(/(\d{6,})/);
    const sampleNumber = sampleMatch ? sampleMatch[0].toUpperCase() : `AUTO-${index + 1}`;
    
    const versionMatch = trimmed.match(/v\d+\.\d+\.\d+/i);
    const modelVersion = versionMatch ? versionMatch[0] : 'v3.2.0';

    return {
      id: `kl_${Date.now()}_${index}`,
      url,
      sampleNumber,
      modelVersion,
      importedAt: now,
      importBatch: batchId,
    };
  });
};
