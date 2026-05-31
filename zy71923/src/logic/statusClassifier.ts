import type { ExhibitionItem, ProcessingStatus, ResidencyRecord } from '../data/types';

export function classifyProcessingStatus(
  residencyRecord: ResidencyRecord,
  hasManualModification: boolean
): { status: ProcessingStatus; note: string } {
  if (hasManualModification) {
    return {
      status: 'manual-modified',
      note: '策展人已人工复核并调整，请查阅处理口径确认最终方案。'
    };
  }

  if (residencyRecord.unitError?.hasError) {
    return {
      status: 'pending',
      note: `存在尺寸单位冲突，来源：${residencyRecord.unitError.source}，需${residencyRecord.responsiblePerson}确认后再布展。`
    };
  }

  if (residencyRecord.status === '待确认') {
    return {
      status: 'pending',
      note: `等待${residencyRecord.responsiblePerson}确认：${residencyRecord.nextStep}`
    };
  }

  if (residencyRecord.changeType === 'conclusion-change' && residencyRecord.status !== '已确认') {
    return {
      status: 'pending',
      note: `结论变更处理中：${residencyRecord.nextStep}`
    };
  }

  return {
    status: 'confirmed',
    note: `所有数据一致，自动判断通过。${residencyRecord.issueDescription}`
  };
}

export function groupExhibitionItems(items: ExhibitionItem[]): Record<ProcessingStatus, ExhibitionItem[]> {
  return {
    confirmed: items.filter(i => i.processingStatus === 'confirmed'),
    pending: items.filter(i => i.processingStatus === 'pending'),
    'manual-modified': items.filter(i => i.processingStatus === 'manual-modified'),
  };
}

export function getStatusDisplayText(status: ProcessingStatus): string {
  const map: Record<ProcessingStatus, string> = {
    confirmed: '已确认',
    pending: '待补',
    'manual-modified': '人工改过',
  };
  return map[status];
}

export function getStatusCount(items: ExhibitionItem[]): Record<ProcessingStatus, number> {
  const groups = groupExhibitionItems(items);
  return {
    confirmed: groups.confirmed.length,
    pending: groups.pending.length,
    'manual-modified': groups['manual-modified'].length,
  };
}
