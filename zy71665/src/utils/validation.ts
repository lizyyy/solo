import type { MeasurementRecord, Anomaly, AnomalyType } from '@/types';

export function detectAnomalies(records: MeasurementRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const connectorMap = new Map<string, string[]>();
  for (const record of records) {
    for (const cid of record.connectorIds) {
      if (!connectorMap.has(cid)) connectorMap.set(cid, []);
      connectorMap.get(cid)!.push(record.id);
    }
  }

  for (const record of records) {
    if (record.powerUnit === 'mW' && (record.inputPower > 0 || record.outputPower > 0)) {
      anomalies.push({
        id: crypto.randomUUID(),
        recordId: record.id,
        type: 'unit_error',
        severity: 'warning',
        message: `记录 ${record.id.slice(0, 8)}：功率值使用 mW（线性单位），未转换为 dBm（对数单位），直接相减将导致损耗计算错误`,
        suggestion: '将功率值转换为 dBm 后再计算损耗：P(dBm) = 10·lg(P(mW))',
      });
    }

    if (record.fiberLength === 0) {
      anomalies.push({
        id: crypto.randomUUID(),
        recordId: record.id,
        type: 'zero_length',
        severity: 'error',
        message: `记录 ${record.id.slice(0, 8)}：光纤长度为 0，无法计算每公里损耗系数`,
        suggestion: '检查长度字段是否漏填，或单位选择是否正确（如实际为 m 却选了 km）',
      });
    }

    for (const cid of record.connectorIds) {
      const recordIds = connectorMap.get(cid) || [];
      if (recordIds.length > 1) {
        anomalies.push({
          id: crypto.randomUUID(),
          recordId: record.id,
          type: 'duplicate_connector',
          severity: 'warning',
          message: `记录 ${record.id.slice(0, 8)}：接头编号 "${cid}" 在 ${recordIds.length} 条记录中重复出现`,
          suggestion: '检查是否误录或系统导出重复行，删除重复的接头编号',
        });
        break;
      }
    }
  }

  return anomalies;
}

export function groupAnomaliesByType(anomalies: Anomaly[]): Record<AnomalyType, Anomaly[]> {
  return {
    unit_error: anomalies.filter((a) => a.type === 'unit_error'),
    zero_length: anomalies.filter((a) => a.type === 'zero_length'),
    duplicate_connector: anomalies.filter((a) => a.type === 'duplicate_connector'),
  };
}

export function validateRecord(record: Partial<MeasurementRecord>): string[] {
  const errors: string[] = [];
  if (record.fiberLength !== undefined && record.fiberLength < 0) {
    errors.push('光纤长度不能为负数');
  }
  if (record.inputPower !== undefined && record.outputPower !== undefined) {
    if (record.powerUnit === 'mW' && (record.inputPower < 0 || record.outputPower < 0)) {
      errors.push('mW 功率值不能为负数');
    }
  }
  if (record.wavelength !== undefined && record.wavelength <= 0) {
    errors.push('波长必须为正数');
  }
  if (record.connectorCount !== undefined && record.connectorCount < 0) {
    errors.push('接头数量不能为负数');
  }
  return errors;
}
