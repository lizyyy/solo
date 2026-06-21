import type { ReportParams, ParamDiff, SedimentRecord, RecordDiff } from '@/types';

export const paramLabels: Record<string, string> = {
  sedimentThreshold: '淤积阈值',
  depthUnit: '深度单位',
  coordinateFormat: '坐标格式',
  includeAnomaly: '包含异常数据',
  dataSources: '数据来源',
  baselineDepth: '基准水深',
};

export const fieldLabels: Record<string, string> = {
  sedimentDepth: '淤积深度',
  sedimentLevel: '淤积等级',
  isNormal: '数据是否正常',
  anomalyType: '异常类型',
  anomalyDetail: '异常说明',
  remark: '备注/后补说明',
  baselineDepth: '基准水深',
  measuredDepth: '实测水深',
  cloudCoverRate: '云覆盖率',
  versionId: '所属版本',
  timestamp: '采集时间',
};

export function compareParams(
  oldParams: ReportParams,
  newParams: ReportParams
): ParamDiff[] {
  const keys = Object.keys(oldParams) as (keyof ReportParams)[];

  return keys.map((key) => {
    const oldVal = oldParams[key];
    const newVal = newParams[key];

    let changed = false;

    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      changed = JSON.stringify(oldVal.sort()) !== JSON.stringify(newVal.sort());
    } else {
      changed = oldVal !== newVal;
    }

    return {
      key,
      label: paramLabels[key] || key,
      oldValue: formatParamValue(oldVal),
      newValue: formatParamValue(newVal),
      changed,
    };
  });
}

function formatParamValue(val: unknown): string {
  if (typeof val === 'boolean') {
    return val ? '是' : '否';
  }
  if (Array.isArray(val)) {
    return val.join(', ');
  }
  if (typeof val === 'number') {
    return String(val);
  }
  return String(val);
}

export function compareRecords(
  oldRecords: SedimentRecord[],
  newRecords: SedimentRecord[]
): RecordDiff[] {
  const diffs: RecordDiff[] = [];

  const oldMap = new Map(oldRecords.map((r) => [r.id, r]));
  const newMap = new Map(newRecords.map((r) => [r.id, r]));

  for (const newRec of newRecords) {
    if (!oldMap.has(newRec.id)) {
      diffs.push({
        type: 'added',
        recordId: newRec.id,
        newRecord: newRec,
      });
    }
  }

  for (const oldRec of oldRecords) {
    if (!newMap.has(oldRec.id)) {
      diffs.push({
        type: 'removed',
        recordId: oldRec.id,
        oldRecord: oldRec,
      });
    }
  }

  for (const newRec of newRecords) {
    const oldRec = oldMap.get(newRec.id);
    if (!oldRec) continue;

    const changedFields: { field: string; oldValue: unknown; newValue: unknown }[] = [];

    const fields: (keyof SedimentRecord)[] = [
      'sedimentDepth',
      'sedimentLevel',
      'isNormal',
      'anomalyType',
      'anomalyDetail',
      'remark',
      'baselineDepth',
      'measuredDepth',
      'cloudCoverRate',
    ];

    for (const field of fields) {
      if (oldRec[field] !== newRec[field]) {
        changedFields.push({
          field,
          oldValue: oldRec[field],
          newValue: newRec[field],
        });
      }
    }

    if (changedFields.length > 0) {
      diffs.push({
        type: 'modified',
        recordId: newRec.id,
        oldRecord: oldRec,
        newRecord: newRec,
        changedFields,
      });
    }
  }

  return diffs;
}

export function getChangedParamCount(diffs: ParamDiff[]): number {
  return diffs.filter((d) => d.changed).length;
}
