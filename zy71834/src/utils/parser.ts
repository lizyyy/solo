import type {
  TestRecord, UnitEntry, TerrainRule, Anomaly, SourceType, AnomalyType
} from '@/types';

export const generateHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const detectSourceType = (filename: string, content: string): SourceType => {
  const lowerName = filename.toLowerCase();
  const lowerContent = content.toLowerCase();
  if (lowerName.includes('late') || lowerName.includes('晚到') || lowerContent.includes('晚到')) {
    return 'late_attachment';
  }
  if (lowerName.includes('dup') || lowerName.includes('重复') || lowerContent.includes('重复')) {
    return 'duplicate';
  }
  if (lowerName.includes('manual') || lowerName.includes('更正') || lowerContent.includes('人工更正')) {
    return 'manual_correction';
  }
  return 'normal';
};

export const deduplicateRecords = (records: TestRecord[]): TestRecord[] => {
  const seen = new Map<string, TestRecord>();
  const result: TestRecord[] = [];
  for (const record of records) {
    const key = `${record.round}-${generateHash(record.content)}`;
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      result.push({
        ...record,
        status: 'duplicate',
        sourceType: 'duplicate',
        duplicateOfId: existing.id,
      });
    } else {
      seen.set(key, record);
      result.push({ ...record, status: 'valid' });
    }
  }
  return result;
};

export const detectBoundaryCrossing = (
  record: TestRecord, terrainRules: TerrainRule[]
): Anomaly | null => {
  if (record.movementPath && record.movementPath.length > 0) {
    for (const pos of record.movementPath) {
      const terrain = terrainRules.find(t => t.gridPosition === pos);
      if (terrain && terrain.passable === false) {
        return {
          id: `anom-${Math.random().toString(36).substring(2, 9)}`,
          recordId: record.id,
          type: 'boundary_crossing',
          severity: 'critical',
          status: 'pending',
          description: `单位移动路径跨越不可通行地形${pos}`,
          evidence: {
            expected: `移动路径应避开${pos}（${terrain.description}）`,
            actual: `移动路径包含${pos}`,
          },
        };
      }
    }
  }
  return null;
};

export const detectReportMismatch = (record: TestRecord): Anomaly | null => {
  if (record.battleReport && record.settlementData) {
    const report = record.battleReport.toLowerCase();
    const data = record.settlementData as Record<string, unknown>;
    if (report.includes('击沉') && data.targetSunk === false) {
      return {
        id: `anom-${Math.random().toString(36).substring(2, 9)}`,
        recordId: record.id,
        type: 'report_mismatch',
        severity: 'critical',
        status: 'pending',
        description: '战报与结算数据不一致：战报称目标被击沉，但结算显示未沉没',
        evidence: {
          expected: `战报描述："${record.battleReport}"`,
          actual: `结算数据：targetSunk: ${data.targetSunk}`,
        },
      };
    }
    if (report.includes('命中') && typeof data.damage === 'number' && data.damage === 0) {
      return {
        id: `anom-${Math.random().toString(36).substring(2, 9)}`,
        recordId: record.id,
        type: 'report_mismatch',
        severity: 'warning',
        status: 'pending',
        description: '战报与结算数据不一致：战报称命中目标，但结算伤害为0',
        evidence: {
          expected: `战报描述："${record.battleReport}"`,
          actual: `结算数据：damage: ${data.damage}`,
        },
      };
    }
  }
  return null;
};

export const detectTurnOrderError = (
  record: TestRecord, prevRecord?: TestRecord
): Anomaly | null => {
  if (prevRecord && record.round < prevRecord.round) {
    return {
      id: `anom-${Math.random().toString(36).substring(2, 9)}`,
      recordId: record.id,
      type: 'turn_order_error',
      severity: 'warning',
      status: 'pending',
      description: `回合顺序错误：当前记录回合${record.round}早于前一记录回合${prevRecord.round}`,
      evidence: {
        expected: `回合应大于等于前一记录${prevRecord.round}`,
        actual: `当前回合${record.round}`,
      },
    };
  }
  if (prevRecord && record.timestamp < prevRecord.timestamp) {
    return {
      id: `anom-${Math.random().toString(36).substring(2, 9)}`,
      recordId: record.id,
      type: 'turn_order_error',
      severity: 'warning',
      status: 'pending',
      description: '时间顺序错误：当前记录时间早于前一记录',
      evidence: {
        expected: '时间应晚于前一记录',
        actual: `当前时间${record.timestamp.toISOString()}`,
      },
    };
  }
  return null;
};

export const detectAllAnomalies = (
  records: TestRecord[],
  terrainRules: TerrainRule[]
): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  let prevRecord: TestRecord | undefined;
  for (const record of records) {
    if (record.status === 'duplicate') continue;
    const boundary = detectBoundaryCrossing(record, terrainRules);
    if (boundary) anomalies.push(boundary);
    const mismatch = detectReportMismatch(record);
    if (mismatch) anomalies.push(mismatch);
    const order = detectTurnOrderError(record, prevRecord);
    if (order) anomalies.push(order);
    prevRecord = record;
  }
  return anomalies;
};

export const parseMaterialPack = async (file: File): Promise<{
  testRecords: TestRecord[];
  unitEntries: UnitEntry[];
  terrainRules: TerrainRule[];
  anomalies: Anomaly[];
}> => {
  const text = await file.text();
  const data = JSON.parse(text);
  const rawRecords = (data.testRecords || []).map((r: any) => ({
    ...r,
    timestamp: new Date(r.timestamp),
    sourceType: detectSourceType(file.name, r.content),
  }));
  const deduped = deduplicateRecords(rawRecords);
  const unitEntries = (data.unitEntries || []).map((u: any) => ({
    ...u,
    isManualCorrection: u.isManualCorrection || detectSourceType(u.source || '', '') === 'manual_correction',
  }));
  const terrainRules = data.terrainRules || [];
  const anomalies = detectAllAnomalies(deduped, terrainRules);
  const recordAnomalyMap = new Map<string, string[]>();
  for (const anomaly of anomalies) {
    const existing = recordAnomalyMap.get(anomaly.recordId) || [];
    recordAnomalyMap.set(anomaly.recordId, [...existing, anomaly.id]);
  }
  const testRecords = deduped.map(r => ({
    ...r,
    anomalies: recordAnomalyMap.get(r.id) || [],
  }));
  return { testRecords, unitEntries, terrainRules, anomalies };
};

export const getAnomalyTypeLabel = (type: AnomalyType): string => {
  const labels: Record<AnomalyType, string> = {
    boundary_crossing: '边界格穿越',
    report_mismatch: '战报结算不一致',
    turn_order_error: '回合顺序错误',
  };
  return labels[type];
};

export const getSourceTypeLabel = (type: SourceType): string => {
  const labels: Record<SourceType, string> = {
    normal: '正常记录',
    late_attachment: '晚到附件',
    duplicate: '重复项',
    manual_correction: '人工更正',
  };
  return labels[type];
};
