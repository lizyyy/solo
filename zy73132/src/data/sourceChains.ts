import type { SourceChainItem } from '../types';

function createSourceChain(recordId: string, anomalyType: string): SourceChainItem[] {
  const baseItems: SourceChainItem[] = [
    {
      id: `sc-${recordId}-1`,
      recordId,
      type: 'original',
      label: '原始采集',
      content: '潮位仪自动采集，采样间隔1小时',
      operator: '系统自动',
      time: '2026-06-16T08:00:00',
      affectsConclusion: false,
      sequence: 1,
    },
  ];

  if (anomalyType === 'outlier') {
    return [
      ...baseItems,
      {
        id: `sc-${recordId}-2`,
        recordId,
        type: 'verbal_note',
        label: '口头备注',
        content: '值班员小宋口头说明：当天有风暴潮预警',
        operator: '小宋',
        time: '2026-06-16T10:30:00',
        affectsConclusion: true,
        sequence: 2,
      },
      {
        id: `sc-${recordId}-3`,
        recordId,
        type: 'manual_review',
        label: '人工标注',
        content: '标记为疑似异常，待现场复核',
        operator: '小宋',
        time: '2026-06-16T11:00:00',
        affectsConclusion: false,
        sequence: 3,
      },
    ];
  }

  if (anomalyType === 'unit_mismatch') {
    return [
      ...baseItems,
      {
        id: `sc-${recordId}-2`,
        recordId,
        type: 'old_bottle_id',
        label: '旧版导入',
        content: '从历史数据库迁移，原单位为厘米',
        operator: '系统迁移',
        time: '2026-06-15T14:00:00',
        affectsConclusion: true,
        sequence: 2,
      },
      {
        id: `sc-${recordId}-3`,
        recordId,
        type: 'verbal_note',
        label: '口头备注',
        content: '老李说这批是旧数据直接导入的',
        operator: '小宋',
        time: '2026-06-16T09:15:00',
        affectsConclusion: false,
        sequence: 3,
      },
    ];
  }

  if (anomalyType === 'bottle_mismatch') {
    return [
      ...baseItems,
      {
        id: `sc-${recordId}-2`,
        recordId,
        type: 'old_bottle_id',
        label: '旧版编号',
        content: '采样瓶使用2024版编号规则，与当前版本不一致',
        operator: '系统导入',
        time: '2026-06-16T07:45:00',
        affectsConclusion: true,
        sequence: 2,
      },
    ];
  }

  if (anomalyType === 'manual_change') {
    return [
      ...baseItems,
      {
        id: `sc-${recordId}-2`,
        recordId,
        type: 'manual_review',
        label: '人工改判',
        content: '原读数2.15m，经现场复核判定为仪器漂移，修正为1.25m',
        operator: '张工',
        time: '2026-06-16T15:30:00',
        affectsConclusion: true,
        sequence: 2,
      },
      {
        id: `sc-${recordId}-3`,
        recordId,
        type: 'verbal_note',
        label: '口头备注',
        content: '张工电话告知已附现场照片在共享盘',
        operator: '小宋',
        time: '2026-06-16T16:00:00',
        affectsConclusion: false,
        sequence: 3,
      },
    ];
  }

  return baseItems;
}

export const sourceChainsData: Record<string, SourceChainItem[]> = {};

export function getSourceChain(recordId: string, anomalyType: string): SourceChainItem[] {
  if (!sourceChainsData[recordId]) {
    sourceChainsData[recordId] = createSourceChain(recordId, anomalyType);
  }
  return sourceChainsData[recordId];
}
