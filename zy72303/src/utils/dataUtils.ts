import { v4 as uuidv4 } from 'uuid';
import type {
  ParameterRecord,
  DetourComparisonResult,
  ParameterVersion,
  CalculationParameters,
  Stakeholder,
  RecordStatus,
  ParameterRecordVersion,
  HistoryDiff,
  PathResult,
  GraphNode,
} from '../types';
import { formatPathDescription } from './graphAlgorithms';

export { formatPathDescription };

export function generateImportHash(record: Partial<ParameterRecord>): string {
  const key = `${record.sourceNode}-${record.targetNode}-${record.numerator}-${record.denominator}-${record.edgeWeight}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function deduplicateRecords(
  newRecords: ParameterRecord[],
  existingRecords: ParameterRecord[]
): { records: ParameterRecord[]; duplicatesCount: number; skippedCount: number } {
  const existingHashes = new Set(existingRecords.map(r => r.importHash));
  let duplicatesCount = 0;
  let skippedCount = 0;
  
  const records = newRecords.filter(newRecord => {
    if (existingHashes.has(newRecord.importHash)) {
      duplicatesCount++;
      return false;
    }
    if (newRecord.denominator === 0 && !newRecord.denominatorDisplayEmpty) {
      skippedCount++;
      return false;
    }
    return true;
  });
  
  return { records, duplicatesCount, skippedCount };
}

export function createParameterRecordVersion(
  record: ParameterRecord,
  changes: Partial<ParameterRecord>,
  author: Stakeholder,
  description: string
): ParameterRecordVersion {
  return {
    version: record.currentVersion + 1,
    timestamp: Date.now(),
    author,
    changes,
    changeDescription: description,
  };
}

export function computeHistoryDiff(
  record: ParameterRecord,
  fromVersion: number,
  toVersion: number
): HistoryDiff[] {
  const diffs: HistoryDiff[] = [];
  
  if (fromVersion >= toVersion) return diffs;
  if (fromVersion < 1 || toVersion > record.currentVersion) return diffs;
  
  let baseRecord: Partial<ParameterRecord> = {};
  for (let v = 1; v <= fromVersion; v++) {
    const versionData = record.versions.find(vd => vd.version === v);
    if (versionData) {
      baseRecord = { ...baseRecord, ...versionData.changes };
    }
  }
  
  let currentRecord = { ...baseRecord };
  
  for (let v = fromVersion + 1; v <= toVersion; v++) {
    const versionData = record.versions.find(vd => vd.version === v);
    if (versionData) {
      Object.keys(versionData.changes).forEach(key => {
        const fieldKey = key as keyof ParameterRecord;
        const oldVal = currentRecord[fieldKey];
        const newVal = versionData.changes[fieldKey];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          diffs.push({
            fieldName: key,
            oldValue: oldVal,
            newValue: newVal,
            changedAt: versionData.timestamp,
            changedBy: versionData.author,
          });
        }
      });
      currentRecord = { ...currentRecord, ...versionData.changes };
    }
  }
  
  return diffs;
}

export function generateExplanation(
  record: ParameterRecord,
  shortestPath: PathResult,
  alternativePath: PathResult,
  detourRatio: number | null,
  parameters: CalculationParameters,
  _nodes: GraphNode[]
): {
  whyKept: string;
  missingMaterials: string[];
  nextAction: string;
  nextStakeholder: Stakeholder;
} {
  const whyKept: string[] = [];
  const missingMaterials: string[] = [];
  let nextStakeholder: Stakeholder = 'alan';
  
  if (record.status === 'zero_denominator') {
    whyKept.push('分母为0，属于异常值，未自动过滤，留待数据复核人确认');
    whyKept.push(`原始备注："${record.remark}"`);
    missingMaterials.push('分母为0的原因说明');
    missingMaterials.push('手算反例验证');
    nextStakeholder = 'data_reviewer';
  } else if (detourRatio === null) {
    whyKept.push('最短路权重为0，无法计算绕行比例，需人工复核');
    missingMaterials.push('最短路权重验证');
    missingMaterials.push('路径有效性确认');
    nextStakeholder = 'data_reviewer';
  } else if (detourRatio >= parameters.detourThreshold) {
    whyKept.push(`绕行比例 ${detourRatio.toFixed(2)} 超过阈值 ${parameters.detourThreshold}，属于显著绕行`);
    whyKept.push(`最短路长度：${shortestPath.totalWeight.toFixed(2)}，备选路径长度：${alternativePath.totalWeight.toFixed(2)}`);
    whyKept.push(`路径节点：${shortestPath.nodes.join('→')} vs ${alternativePath.nodes.join('→')}`);
    nextStakeholder = 'alan';
  } else {
    whyKept.push(`绕行比例 ${detourRatio.toFixed(2)} 在阈值 ${parameters.detourThreshold} 以内，属于可接受范围`);
    whyKept.push('保留用于课堂演示，说明绕行判断标准');
    nextStakeholder = 'alan';
  }
  
  if (record.reviewStatus !== 'approved') {
    missingMaterials.push('数据复核人审批意见');
  }
  
  if (!record.manualCounterexample && record.status === 'zero_denominator') {
    missingMaterials.push('运营规划阿岚的手算反例');
  }
  
  const nextAction = nextStakeholder === 'data_reviewer'
    ? '请数据复核人确认分母为0的情况，并判断是否需要修正或提供更多上下文'
    : nextStakeholder === 'alan'
    ? '请运营规划阿岚检查绕行路线是否合理，必要时提供手算反例'
    : '系统自动处理完成';
  
  return {
    whyKept: whyKept.join('；'),
    missingMaterials,
    nextAction,
    nextStakeholder,
  };
}

export function createComparisonResult(
  record: ParameterRecord,
  shortestPath: PathResult,
  alternativePath: PathResult,
  detourRatio: number | null,
  parameterVersion: ParameterVersion,
  nodes: GraphNode[]
): DetourComparisonResult {
  const explanation = generateExplanation(
    record,
    shortestPath,
    alternativePath,
    detourRatio,
    parameterVersion.parameters,
    nodes
  );
  
  return {
    id: uuidv4(),
    parameterRecordId: record.id,
    batchId: record.batchId,
    parameterVersion,
    shortestPath,
    alternativePath,
    detourRatio,
    detourDistance: alternativePath.totalWeight - shortestPath.totalWeight,
    isSignificantDetour: detourRatio !== null && detourRatio >= parameterVersion.parameters.detourThreshold,
    thresholdUsed: parameterVersion.parameters.detourThreshold,
    calculationTimestamp: Date.now(),
    explanation,
    status: record.status,
    demoUpdated: false,
  };
}

export function getStakeholderName(stakeholder: Stakeholder): string {
  switch (stakeholder) {
    case 'data_reviewer': return '数据复核人';
    case 'alan': return '运营规划阿岚';
    case 'system': return '系统';
  }
}

export function getStatusName(status: RecordStatus): string {
  switch (status) {
    case 'normal': return '正常';
    case 'zero_denominator': return '分母为0';
    case 'needs_review': return '待复核';
    case 'counterexample_provided': return '已提供反例';
    case 'demo_ready': return '演示就绪';
  }
}

export function formatDenominatorDisplay(denominator: number | null, displayEmpty: boolean): string {
  if (displayEmpty || denominator === 0 || denominator === null) {
    return '';
  }
  return denominator.toString();
}

export function parseDenominatorInput(input: string): { value: number | null; displayEmpty: boolean } {
  if (input.trim() === '') {
    return { value: 0, displayEmpty: true };
  }
  const num = parseFloat(input);
  if (isNaN(num)) {
    return { value: 0, displayEmpty: true };
  }
  if (num === 0) {
    return { value: 0, displayEmpty: true };
  }
  return { value: num, displayEmpty: false };
}

export function generateClassroomNote(
  result: DetourComparisonResult,
  record: ParameterRecord
): string {
  const parts: string[] = [];
  
  parts.push(`【${record.sourceNode} → ${record.targetNode}】`);
  parts.push(`绕行比例：${result.detourRatio !== null ? result.detourRatio.toFixed(2) + '倍' : '无法计算'}`);
  parts.push(`判断标准：使用参数版本 ${result.parameterVersion.version}`);
  parts.push(`取舍理由：${result.parameterVersion.reasoning}`);
  
  if (result.status === 'zero_denominator') {
    parts.push('⚠️ 注意：分母为0，已标记为异常，等待数据复核人确认');
  }
  
  if (record.manualCounterexample) {
    parts.push(`💡 手算反例：${record.manualCounterexample}`);
  }
  
  parts.push(`📌 下一步：${result.explanation.nextAction}`);
  parts.push(`👤 负责人：${getStakeholderName(result.explanation.nextStakeholder)}`);
  
  return parts.join('\n');
}
