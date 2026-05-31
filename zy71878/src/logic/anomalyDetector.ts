import type { DataRecord, AnomalyReason, AnomalyType } from '../types';

const UNIT_GROUPS: Record<string, string[]> = {
  throughput: ['pcs/h', '件/小时', 'units/hr', '个/小时'],
  time: ['s', 'sec', '秒', 'min', '分钟', 'h', '小时'],
  capacity: ['units', '件', '个', 'pcs'],
  percentage: ['%', 'percent', '百分比'],
};

const DRIFT_THRESHOLD = 0.05;
const getUnitGroup = (unit: string): string | null => {
  for (const [group, units] of Object.entries(UNIT_GROUPS)) {
    if (units.some(u => unit.toLowerCase().includes(u.toLowerCase()))) {
      return group;
    }
  }
  return null;
};

const checkDrift = (records: DataRecord[]): Map<string, AnomalyReason> => {
  const anomalies = new Map<string, AnomalyReason>();
  const runGroups = new Map<string, DataRecord[]>();

  records.forEach(r => {
    const runId = r.data.runId;
    if (runId && r.type === 'data' && typeof r.data.value === 'number') {
      if (!runGroups.has(runId)) {
        runGroups.set(runId, []);
      }
      runGroups.get(runId)!.push(r);
    }
  });

  runGroups.forEach((group, runId) => {
    if (group.length < 2) return;
    
    const values = group.map(r => r.data.value as number);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );

    group.forEach((record, idx) => {
      const value = record.data.value as number;
      const relativeDiff = Math.abs(value - mean) / mean;
      const sigmaDiff = Math.abs(value - mean) / (stdDev || 1);

      if (relativeDiff > DRIFT_THRESHOLD || sigmaDiff > 2) {
        const others = group.filter((_, i) => i !== idx).map(r => ({
          id: r.id,
          value: r.data.value,
          timestamp: r.timestamp,
        }));

        anomalies.set(record.id, {
          type: 'drift',
          description: `重复运行结果偏差超过阈值（偏差: ${(relativeDiff * 100).toFixed(1)}%）`,
          details: {
            runId,
            value,
            mean,
            stdDev,
            relativeDiff,
            sigmaDiff,
            threshold: DRIFT_THRESHOLD,
            comparisonRecords: others,
          },
        });
      }
    });
  });

  return anomalies;
};

const checkUnitMismatch = (records: DataRecord[]): Map<string, AnomalyReason> => {
  const anomalies = new Map<string, AnomalyReason>();
  const typeUnits = new Map<string, Set<string>>();

  records.forEach(r => {
    if (r.type === 'data' && r.data.unit) {
      const key = r.title.split(' - ')[0];
      if (!typeUnits.has(key)) {
        typeUnits.set(key, new Set());
      }
      typeUnits.get(key)!.add(r.data.unit);
    }
  });

  records.forEach(r => {
    if (r.type !== 'data' || !r.data.unit) return;
    
    const key = r.title.split(' - ')[0];
    const units = typeUnits.get(key);
    if (!units || units.size <= 1) return;

    const unitGroups = new Set<string>();
    units.forEach(u => {
      const group = getUnitGroup(u);
      if (group) unitGroups.add(group);
    });

    if (unitGroups.size > 1) {
      anomalies.set(r.id, {
        type: 'unit_mismatch',
        description: `检测到单位混用：${r.data.unit} 与其他记录单位量纲不一致`,
        details: {
          currentUnit: r.data.unit,
          allUnits: Array.from(units),
          unitGroups: Array.from(unitGroups),
        },
      });
    }
  });

  return anomalies;
};

const checkConstraintOverride = (records: DataRecord[]): Map<string, AnomalyReason> => {
  const anomalies = new Map<string, AnomalyReason>();
  const sortedRecords = [...records].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const originalConstraints = new Map<string, Record<string, unknown>>();
  
  sortedRecords.forEach(r => {
    if (!r.data.constraints) return;
    
    const key = r.title.split(' - ')[0];
    const original = originalConstraints.get(key);
    
    if (original) {
      const overridden: string[] = [];
      const details: Record<string, { original: unknown; new: unknown }> = {};
      
      for (const [k, v] of Object.entries(r.data.constraints)) {
        if (original[k] !== undefined && original[k] !== v) {
          overridden.push(k);
          details[k] = { original: original[k], new: v };
        }
      }
      
      if (overridden.length > 0) {
        anomalies.set(r.id, {
          type: 'constraint_override',
          description: `约束条件被覆盖：${overridden.join(', ')}`,
          details: {
            originalConstraints: original,
            newConstraints: r.data.constraints,
            overriddenFields: overridden,
            changes: details,
          },
        });
      }
    } else {
      originalConstraints.set(key, r.data.constraints);
    }
  });

  return anomalies;
};

const checkLateAttachments = (records: DataRecord[]): Map<string, AnomalyReason> => {
  const anomalies = new Map<string, AnomalyReason>();

  records.forEach(r => {
    const lateAttachments = r.attachments.filter(a => a.arrivedLate);
    if (lateAttachments.length > 0) {
      anomalies.set(r.id, {
        type: 'late_attachment',
        description: `存在晚到附件：${lateAttachments.map(a => a.name).join(', ')}`,
        details: {
          lateAttachments: lateAttachments.map(a => ({
            name: a.name,
            delayedHours: a.delayedHours,
          })),
        },
      });
    }
  });

  return anomalies;
};

const checkDuplicates = (records: DataRecord[]): Map<string, AnomalyReason> => {
  const anomalies = new Map<string, AnomalyReason>();
  const seen = new Map<string, DataRecord>();

  records.forEach(r => {
    const fingerprint = `${r.source}-${r.title}-${JSON.stringify(r.data.value || '')}`;
    const existing = seen.get(fingerprint);
    
    if (existing) {
      anomalies.set(r.id, {
        type: 'duplicate',
        description: `检测到重复记录，与 ${existing.timestamp} 的记录内容一致`,
        details: {
          duplicateOf: existing.id,
          duplicateTimestamp: existing.timestamp,
          duplicateAuthor: existing.author,
        },
      });
    } else {
      seen.set(fingerprint, r);
    }
  });

  return anomalies;
};

export const detectAnomalies = (records: DataRecord[]): DataRecord[] => {
  const allAnomalies: Map<string, AnomalyReason>[] = [
    checkDrift(records),
    checkUnitMismatch(records),
    checkConstraintOverride(records),
    checkLateAttachments(records),
    checkDuplicates(records),
  ];

  return records.map(record => {
    let anomalyReason: AnomalyReason | undefined;
    
    for (const anomalyMap of allAnomalies) {
      const found = anomalyMap.get(record.id);
      if (found) {
        anomalyReason = found;
        break;
      }
    }

    if (anomalyReason && record.status !== 'corrected' && record.status !== 'duplicate') {
      return {
        ...record,
        status: 'pending' as const,
        anomalyReason,
      };
    }

    return record;
  });
};

export const anomalyTypeToIcon: Record<AnomalyType, string> = {
  drift: 'trending-down',
  unit_mismatch: 'ruler',
  constraint_override: 'lock-open',
  late_attachment: 'clock',
  duplicate: 'copy',
};
