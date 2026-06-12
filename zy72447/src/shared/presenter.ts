import {
  ReconciliationResult,
  GroupSignupRecord,
  ContractRecord,
  RecordStatus,
  ReviewReason,
  OperationLog,
  ManualEdit
} from '../types';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.PENDING_IMPORT]: '待导入',
  [RecordStatus.IMPORTED]: '已导入',
  [RecordStatus.MATCHED]: '已匹配',
  [RecordStatus.NEEDS_REVIEW]: '待复核',
  [RecordStatus.CONFIRMED]: '已确认',
  [RecordStatus.REJECTED]: '已驳回',
  [RecordStatus.SUPERSEDED]: '已替换'
};

export const REASON_LABELS: Record<ReviewReason, string> = {
  [ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP]: '临时替补仅在群里提及',
  [ReviewReason.CONTRACT_MISSING]: '缺少合同页截图',
  [ReviewReason.GROUP_RECORD_MISSING]: '缺少排练群接龙记录',
  [ReviewReason.INFO_MISMATCH]: '信息不一致',
  [ReviewReason.MANUAL_REVIEW_REQUIRED]: '需人工复核'
};

export const FIELD_LABELS: Record<string, string> = {
  id: '核对结果ID',
  resultId: '核对结果ID',
  status: '状态值',
  statusLabel: '状态',
  performerName: '表演者',
  songName: '曲目',
  isLateContractRefresh: '是否晚到材料',
  reviewReasons: '复核原因代码',
  reviewReasonsLabel: '复核原因',
  reviewNotes: '复核备注',
  reviewedBy: '复核人',
  reviewedAt: '复核时间',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  groupOriginalRowNumber: '接龙原始行号',
  groupRawContent: '接龙原始内容',
  groupPerformerName: '接龙解析姓名',
  groupSongName: '接龙解析曲目',
  groupIsTempSubstitute: '是否临时替补',
  groupSubstituteNote: '替补备注',
  groupImportBatchId: '接龙导入批次',
  groupImportedAt: '接龙导入时间',
  groupManualEdits: '接龙人工改动',
  groupManualEditsCount: '接龙人工改动次数',
  contractRawContent: '合同原始内容',
  contractPerformerName: '合同解析姓名',
  contractSongName: '合同解析曲目',
  contractReference: '合同编号',
  contractPerformanceDate: '演出日期',
  contractImportBatchId: '合同导入批次',
  contractImportedAt: '合同导入时间',
  contractManualEdits: '合同人工改动',
  contractManualEditsCount: '合同人工改动次数'
};

export interface DetailRow {
  id: string;
  resultId: string;
  status: RecordStatus;
  statusLabel: string;
  performerName: string;
  songName: string;
  isLateContractRefresh: boolean;
  reviewReasons: ReviewReason[];
  reviewReasonsLabel: string;
  reviewNotes: string;
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;

  groupOriginalRowNumber: number | '';
  groupRawContent: string;
  groupPerformerName: string;
  groupSongName: string;
  groupIsTempSubstitute: boolean;
  groupSubstituteNote: string;
  groupImportBatchId: string;
  groupImportedAt: string;
  groupManualEdits: string;
  groupManualEditsCount: number;

  contractRawContent: string;
  contractPerformerName: string;
  contractSongName: string;
  contractReference: string;
  contractPerformanceDate: string;
  contractImportBatchId: string;
  contractImportedAt: string;
  contractManualEdits: string;
  contractManualEditsCount: number;
}

export interface SummaryItem {
  label: string;
  value: number;
  key: string;
}

export interface LogRow {
  id: string;
  operationType: string;
  entityType: string;
  entityId: string;
  operator: string;
  timestamp: string;
  batchId: string;
  notes: string;
  oldStateSummary: string;
  newStateSummary: string;
}

function formatManualEdits(edits: ManualEdit[] | undefined): string {
  if (!edits || edits.length === 0) return '';
  return edits
    .map((e) => {
      const reason = e.reason ? ` [${e.reason}]` : '';
      return `${e.fieldName}: ${e.oldValue || '(空)'} → ${e.newValue || '(空)'} (${e.editedBy}${reason})`;
    })
    .join('; ');
}

export function buildDetailRow(
  result: ReconciliationResult,
  groupRecord?: GroupSignupRecord,
  contractRecord?: ContractRecord
): DetailRow {
  return {
    id: result.id,
    resultId: result.id,
    status: result.status,
    statusLabel: STATUS_LABELS[result.status] || result.status,
    performerName: result.matchedPerformerName || '',
    songName: result.matchedSongName || '',
    isLateContractRefresh: result.isLateContractRefresh,
    reviewReasons: result.reviewReasons,
    reviewReasonsLabel: result.reviewReasons.map((r) => REASON_LABELS[r] || r).join('；'),
    reviewNotes: result.reviewNotes || '',
    reviewedBy: result.reviewedBy || '',
    reviewedAt: result.reviewedAt || '',
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,

    groupOriginalRowNumber: groupRecord?.originalRowNumber ?? '',
    groupRawContent: groupRecord?.rawContent || '',
    groupPerformerName: groupRecord?.performerName || '',
    groupSongName: groupRecord?.songName || '',
    groupIsTempSubstitute: groupRecord?.isTemporarySubstitute || false,
    groupSubstituteNote: groupRecord?.substituteNote || '',
    groupImportBatchId: groupRecord?.importBatchId || '',
    groupImportedAt: groupRecord?.importedAt || '',
    groupManualEdits: formatManualEdits(groupRecord?.manualEdits),
    groupManualEditsCount: groupRecord?.manualEdits?.length || 0,

    contractRawContent: contractRecord?.rawContent || '',
    contractPerformerName: contractRecord?.performerName || '',
    contractSongName: contractRecord?.songName || '',
    contractReference: contractRecord?.contractReference || '',
    contractPerformanceDate: contractRecord?.performanceDate || '',
    contractImportBatchId: contractRecord?.importBatchId || '',
    contractImportedAt: contractRecord?.importedAt || '',
    contractManualEdits: formatManualEdits(contractRecord?.manualEdits),
    contractManualEditsCount: contractRecord?.manualEdits?.length || 0
  };
}

export function detailRowToExportColumns(row: DetailRow): Record<string, string | number | boolean> {
  return {
    [FIELD_LABELS.resultId]: row.resultId,
    [FIELD_LABELS.statusLabel]: row.statusLabel,
    [FIELD_LABELS.performerName]: row.performerName,
    [FIELD_LABELS.songName]: row.songName,
    [FIELD_LABELS.isLateContractRefresh]: row.isLateContractRefresh ? '是' : '否',
    [FIELD_LABELS.reviewReasonsLabel]: row.reviewReasonsLabel,
    [FIELD_LABELS.reviewNotes]: row.reviewNotes,
    [FIELD_LABELS.reviewedBy]: row.reviewedBy,
    [FIELD_LABELS.reviewedAt]: row.reviewedAt,

    [FIELD_LABELS.groupOriginalRowNumber]: row.groupOriginalRowNumber,
    [FIELD_LABELS.groupRawContent]: row.groupRawContent,
    [FIELD_LABELS.groupPerformerName]: row.groupPerformerName,
    [FIELD_LABELS.groupSongName]: row.groupSongName,
    [FIELD_LABELS.groupIsTempSubstitute]: row.groupIsTempSubstitute ? '是' : '否',
    [FIELD_LABELS.groupSubstituteNote]: row.groupSubstituteNote,
    [FIELD_LABELS.groupImportBatchId]: row.groupImportBatchId,
    [FIELD_LABELS.groupImportedAt]: row.groupImportedAt,
    [FIELD_LABELS.groupManualEdits]: row.groupManualEdits,
    [FIELD_LABELS.groupManualEditsCount]: row.groupManualEditsCount,

    [FIELD_LABELS.contractRawContent]: row.contractRawContent,
    [FIELD_LABELS.contractPerformerName]: row.contractPerformerName,
    [FIELD_LABELS.contractSongName]: row.contractSongName,
    [FIELD_LABELS.contractReference]: row.contractReference,
    [FIELD_LABELS.contractPerformanceDate]: row.contractPerformanceDate,
    [FIELD_LABELS.contractImportBatchId]: row.contractImportBatchId,
    [FIELD_LABELS.contractImportedAt]: row.contractImportedAt,
    [FIELD_LABELS.contractManualEdits]: row.contractManualEdits,
    [FIELD_LABELS.contractManualEditsCount]: row.contractManualEditsCount,

    [FIELD_LABELS.createdAt]: row.createdAt,
    [FIELD_LABELS.updatedAt]: row.updatedAt
  };
}

export function buildSummary(
  details: Array<{ result: ReconciliationResult; groupRecord?: GroupSignupRecord; contractRecord?: ContractRecord }>
): SummaryItem[] {
  const items: SummaryItem[] = [
    { key: 'total', label: '总记录数', value: details.length },
    { key: 'confirmed', label: '已确认', value: details.filter((d) => d.result.status === RecordStatus.CONFIRMED).length },
    { key: 'needs_review', label: '待复核', value: details.filter((d) => d.result.status === RecordStatus.NEEDS_REVIEW).length },
    { key: 'matched', label: '已匹配', value: details.filter((d) => d.result.status === RecordStatus.MATCHED).length },
    { key: 'rejected', label: '已驳回', value: details.filter((d) => d.result.status === RecordStatus.REJECTED).length },
    { key: 'temp_substitute', label: '临时替补待复核', value: details.filter((d) => d.result.reviewReasons.includes(ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP)).length },
    { key: 'contract_missing', label: '缺少合同截图', value: details.filter((d) => d.result.reviewReasons.includes(ReviewReason.CONTRACT_MISSING)).length },
    { key: 'late_refresh', label: '晚到材料刷新', value: details.filter((d) => d.result.isLateContractRefresh).length }
  ];
  return items;
}

export function buildLogRow(log: OperationLog): LogRow {
  const summarize = (obj: any): string => {
    if (!obj) return '';
    try {
      if (typeof obj === 'string') return obj;
      const keys = Object.keys(obj);
      if (keys.length <= 5) return JSON.stringify(obj);
      return `{ ${keys.slice(0, 5).join(', ')} ... }`;
    } catch (e) {
      return String(obj);
    }
  };

  return {
    id: log.id,
    operationType: log.operationType,
    entityType: log.entityType,
    entityId: log.entityId || '',
    operator: log.operator,
    timestamp: log.timestamp,
    batchId: log.batchId || '',
    notes: log.notes || '',
    oldStateSummary: summarize(log.oldState),
    newStateSummary: summarize(log.newState)
  };
}
