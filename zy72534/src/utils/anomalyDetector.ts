import { Sample } from '../types';

export function detectAnomalies(samples: Sample[]): Sample[] {
  const sampleNoGroups = new Map<string, Sample[]>();
  
  samples.forEach(sample => {
    const existing = sampleNoGroups.get(sample.sampleNo) || [];
    sampleNoGroups.set(sample.sampleNo, [...existing, sample]);
  });

  return samples.map(sample => {
    const group = sampleNoGroups.get(sample.sampleNo) || [];
    const uniqueVersions = new Set(group.map(s => s.currentModelVersion));
    const isAnomaly = uniqueVersions.size > 1;
    
    return {
      ...sample,
      isAnomaly,
      status: isAnomaly ? 'pending_review' : sample.status,
    };
  });
}

export function getAnomalySamples(samples: Sample[]): Sample[] {
  return samples.filter(s => s.isAnomaly);
}

export function formatAnomalyExplanation(sample: Sample): string {
  const versions = sample.versions.map(v => v.modelVersion);
  const uniqueVersions = [...new Set(versions)];
  return `样本编号 ${sample.sampleNo} 在灰度批次中出现了 ${uniqueVersions.length} 个不同模型版本（${uniqueVersions.join(' → ')}），但样本编号未更新，需运营复核确认是否为同一素材。`;
}
