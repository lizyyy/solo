import type { BattleRecord, Anomaly, AnomalyType, AnomalySeverity } from '@/types';
import { generateRecordFingerprint } from './fingerprint';

export function detectAnomalies(records: BattleRecord[], versionId: string): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const seenBattleIds = new Map<string, BattleRecord>();
  
  records.forEach(record => {
    const { dataFingerprint, ...recordWithoutFingerprint } = record;
    const expectedFingerprint = generateRecordFingerprint(recordWithoutFingerprint);
    const actualFingerprint = dataFingerprint;
    
    if (expectedFingerprint !== actualFingerprint) {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'mismatch',
        'high',
        '数据指纹不匹配',
        `记录 ${record.id} 的数据指纹与实际内容不符，可能已被篡改。期望指纹: ${expectedFingerprint}，实际指纹: ${actualFingerprint}`,
        '请检查该记录是否被非法修改，如确认无误可重新导入覆盖。',
        record,
        'dataFingerprint',
        expectedFingerprint,
        actualFingerprint
      ));
    }
    
    const existing = seenBattleIds.get(record.battleId);
    if (existing) {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'duplicate',
        'medium',
        `战报ID重复: ${record.battleId}`,
        `战报ID ${record.battleId} 在记录 ${existing.id} 和 ${record.id} 中重复出现。`,
        '请核实哪条是正确记录，删除重复项或修正战报ID。',
        record,
        'battleId',
        existing.id,
        record.id
      ));
    }
    seenBattleIds.set(record.battleId, record);
    
    if (record.score < 0 || record.score > 100000) {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'out_of_range',
        'medium',
        `分数超出正常范围: ${record.score}`,
        `玩家 ${record.playerName} 的分数 ${record.score} 超出正常范围 [0, 100000]。`,
        '请核实战报分数是否正确，如为特殊情况可标记忽略。',
        record,
        'score',
        '0-100000',
        record.score
      ));
    }
    
    if (record.settlement < 0 || record.settlement > 50000) {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'out_of_range',
        'high',
        `结算值超出正常范围: ${record.settlement}`,
        `玩家 ${record.playerName} 的结算值 ${record.settlement} 超出正常范围 [0, 50000]。`,
        '请核实结算计算是否正确，该异常会影响最终对账结果。',
        record,
        'settlement',
        '0-50000',
        record.settlement
      ));
    }
    
    if (record.score > 0 && record.settlement === 0) {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'mismatch',
        'critical',
        '战报与结算不一致',
        `玩家 ${record.playerName} 战报分数 ${record.score} 但结算为 0，存在严重不一致。`,
        '这是高危异常！必须核实结算公式是否正确，或战报数据是否完整导入。',
        record,
        'settlement',
        record.score * 0.5,
        0
      ));
    }
    
    if (Math.abs(record.score - record.settlement * 2) > record.score * 0.1) {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'mismatch',
        'high',
        '战报与结算差异过大',
        `玩家 ${record.playerName} 战报 ${record.score} 与结算 ${record.settlement}*2 差异超过10%。`,
        '请检查结算公式是否应用正确，是否有特殊加成或扣除未计入。',
        record,
        'settlement',
        record.score * 0.5,
        record.settlement
      ));
    }
    
    if (!record.playerName || record.playerName.trim() === '') {
      anomalies.push(createAnomaly(
        record.id,
        versionId,
        'missing_data',
        'low',
        '玩家名称为空',
        `记录 ${record.id} 的玩家名称为空。`,
        '请补充玩家名称，或确认该记录是否有效。',
        record,
        'playerName',
        '非空字符串',
        record.playerName || '(空)'
      ));
    }
  });
  
  const uniqueAnomalies = deduplicateAnomalies(anomalies);
  
  uniqueAnomalies.forEach(anomaly => {
    records.find(r => r.id === anomaly.recordId)!.status = 
      anomaly.severity === 'critical' || anomaly.severity === 'high' ? 'anomaly' : 'warning';
  });
  
  return uniqueAnomalies;
}

function createAnomaly(
  recordId: string,
  versionId: string,
  type: AnomalyType,
  severity: AnomalySeverity,
  description: string,
  explanation: string,
  suggestion: string,
  _record: BattleRecord,
  fieldName?: string,
  expectedValue?: number | string,
  actualValue?: number | string
): Anomaly {
  return {
    id: crypto.randomUUID(),
    versionId,
    recordId,
    type,
    severity,
    fieldName,
    expectedValue,
    actualValue,
    description,
    explanation,
    suggestion,
    status: 'open',
    detectedAt: new Date().toISOString()
  };
}

function deduplicateAnomalies(anomalies: Anomaly[]): Anomaly[] {
  const seen = new Set<string>();
  return anomalies.filter(a => {
    const key = `${a.recordId}-${a.type}-${a.fieldName || 'none'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    mismatch: '数据不匹配',
    duplicate: '重复数据',
    out_of_range: '超出范围',
    missing_data: '缺失数据'
  };
  return labels[type];
}

export function getSeverityLabel(severity: AnomalySeverity): string {
  const labels: Record<AnomalySeverity, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '严重'
  };
  return labels[severity];
}

export function getSeverityColor(severity: AnomalySeverity): string {
  const colors: Record<AnomalySeverity, string> = {
    low: 'text-warning-500 bg-warning-50',
    medium: 'text-warning-600 bg-warning-100',
    high: 'text-danger-500 bg-danger-50',
    critical: 'text-white bg-danger-600'
  };
  return colors[severity];
}
