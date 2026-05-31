import type { PitchDeviation, RecordingBatch } from '../types';

export function classifyDeviation(
  deviation: PitchDeviation,
  allDeviations: PitchDeviation[],
  batches: RecordingBatch[]
): PitchDeviation['category'] {
  if (deviation.isAnomaly) {
    return deviation.category || 'normal';
  }

  const sortedBatches = [...batches].sort((a, b) => 
    a.rehearsalDate.localeCompare(b.rehearsalDate)
  );
  const currentBatchIndex = sortedBatches.findIndex(b => b.id === deviation.batchId);
  
  const history = sortedBatches
    .slice(Math.max(0, currentBatchIndex - 2), currentBatchIndex + 1)
    .map(batch => allDeviations.find(
      d => d.studentId === deviation.studentId && 
           d.measure === deviation.measure && 
           d.batchId === batch.id
    ))
    .filter((d): d is PitchDeviation => d !== undefined && !d.isAnomaly);

  const absCents = Math.abs(deviation.deviationCents);

  const consecutiveHigh = history.filter(d => Math.abs(d.deviationCents) > 50).length;
  if (consecutiveHigh >= 3) {
    return 'persistent';
  }

  if (absCents > 50) {
    const beforeOk = currentBatchIndex > 0 
      ? Math.abs(history[history.length - 2]?.deviationCents || 0) <= 30
      : true;
    const afterOk = currentBatchIndex < sortedBatches.length - 1
      ? Math.abs(allDeviations.find(
          d => d.studentId === deviation.studentId && 
               d.measure === deviation.measure && 
               d.batchId === sortedBatches[currentBatchIndex + 1]?.id
        )?.deviationCents || 0) <= 30
      : true;
    
    if (beforeOk && afterOk) {
      return 'occasional';
    }
  }

  if (absCents > 30 && !deviation.reviewed) {
    return 'unreviewed';
  }

  return 'normal';
}

export function classifyAllDeviations(
  deviations: PitchDeviation[],
  batches: RecordingBatch[]
): PitchDeviation[] {
  return deviations.map(d => ({
    ...d,
    category: classifyDeviation(d, deviations, batches),
  }));
}

export function getCategoryLabel(category?: string): string {
  switch (category) {
    case 'persistent': return '持续跑偏';
    case 'occasional': return '偶发失误';
    case 'unreviewed': return '未复核';
    case 'normal': return '正常';
    default: return '未分类';
  }
}

export function getCategoryColor(category?: string): string {
  switch (category) {
    case 'persistent': return '#c0392b';
    case 'occasional': return '#e67e22';
    case 'unreviewed': return '#7f8c8d';
    case 'normal': return '#27ae60';
    default: return '#95a5a6';
  }
}

export function getAnomalyTypeLabel(type?: string): string {
  switch (type) {
    case 'key_change': return '转调';
    case 'part_change': return '换声部';
    case 'missing_measure': return '录音缺拍';
    case 'manual': return '手动标记';
    default: return '异常';
  }
}

export function getNoteSourceLabel(source: string): string {
  switch (source) {
    case 'monitor': return '声部长备注';
    case 'teacher': return '老师标注';
    case 'selection': return '选曲变更';
    default: return '备注';
  }
}
