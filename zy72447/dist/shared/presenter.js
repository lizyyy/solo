"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_LABELS = exports.REASON_LABELS = exports.STATUS_LABELS = void 0;
exports.buildDetailRow = buildDetailRow;
exports.detailRowToExportColumns = detailRowToExportColumns;
exports.buildSummary = buildSummary;
exports.buildLogRow = buildLogRow;
const types_1 = require("../types");
exports.STATUS_LABELS = {
    [types_1.RecordStatus.PENDING_IMPORT]: '待导入',
    [types_1.RecordStatus.IMPORTED]: '已导入',
    [types_1.RecordStatus.MATCHED]: '已匹配',
    [types_1.RecordStatus.NEEDS_REVIEW]: '待复核',
    [types_1.RecordStatus.CONFIRMED]: '已确认',
    [types_1.RecordStatus.REJECTED]: '已驳回',
    [types_1.RecordStatus.SUPERSEDED]: '已替换'
};
exports.REASON_LABELS = {
    [types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP]: '临时替补仅在群里提及',
    [types_1.ReviewReason.CONTRACT_MISSING]: '缺少合同页截图',
    [types_1.ReviewReason.GROUP_RECORD_MISSING]: '缺少排练群接龙记录',
    [types_1.ReviewReason.INFO_MISMATCH]: '信息不一致',
    [types_1.ReviewReason.MANUAL_REVIEW_REQUIRED]: '需人工复核'
};
exports.FIELD_LABELS = {
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
function formatManualEdits(edits) {
    if (!edits || edits.length === 0)
        return '';
    return edits
        .map((e) => {
        const reason = e.reason ? ` [${e.reason}]` : '';
        return `${e.fieldName}: ${e.oldValue || '(空)'} → ${e.newValue || '(空)'} (${e.editedBy}${reason})`;
    })
        .join('; ');
}
function buildDetailRow(result, groupRecord, contractRecord) {
    return {
        id: result.id,
        resultId: result.id,
        status: result.status,
        statusLabel: exports.STATUS_LABELS[result.status] || result.status,
        performerName: result.matchedPerformerName || '',
        songName: result.matchedSongName || '',
        isLateContractRefresh: result.isLateContractRefresh,
        reviewReasons: result.reviewReasons,
        reviewReasonsLabel: result.reviewReasons.map((r) => exports.REASON_LABELS[r] || r).join('；'),
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
function detailRowToExportColumns(row) {
    return {
        [exports.FIELD_LABELS.resultId]: row.resultId,
        [exports.FIELD_LABELS.statusLabel]: row.statusLabel,
        [exports.FIELD_LABELS.performerName]: row.performerName,
        [exports.FIELD_LABELS.songName]: row.songName,
        [exports.FIELD_LABELS.isLateContractRefresh]: row.isLateContractRefresh ? '是' : '否',
        [exports.FIELD_LABELS.reviewReasonsLabel]: row.reviewReasonsLabel,
        [exports.FIELD_LABELS.reviewNotes]: row.reviewNotes,
        [exports.FIELD_LABELS.reviewedBy]: row.reviewedBy,
        [exports.FIELD_LABELS.reviewedAt]: row.reviewedAt,
        [exports.FIELD_LABELS.groupOriginalRowNumber]: row.groupOriginalRowNumber,
        [exports.FIELD_LABELS.groupRawContent]: row.groupRawContent,
        [exports.FIELD_LABELS.groupPerformerName]: row.groupPerformerName,
        [exports.FIELD_LABELS.groupSongName]: row.groupSongName,
        [exports.FIELD_LABELS.groupIsTempSubstitute]: row.groupIsTempSubstitute ? '是' : '否',
        [exports.FIELD_LABELS.groupSubstituteNote]: row.groupSubstituteNote,
        [exports.FIELD_LABELS.groupImportBatchId]: row.groupImportBatchId,
        [exports.FIELD_LABELS.groupImportedAt]: row.groupImportedAt,
        [exports.FIELD_LABELS.groupManualEdits]: row.groupManualEdits,
        [exports.FIELD_LABELS.groupManualEditsCount]: row.groupManualEditsCount,
        [exports.FIELD_LABELS.contractRawContent]: row.contractRawContent,
        [exports.FIELD_LABELS.contractPerformerName]: row.contractPerformerName,
        [exports.FIELD_LABELS.contractSongName]: row.contractSongName,
        [exports.FIELD_LABELS.contractReference]: row.contractReference,
        [exports.FIELD_LABELS.contractPerformanceDate]: row.contractPerformanceDate,
        [exports.FIELD_LABELS.contractImportBatchId]: row.contractImportBatchId,
        [exports.FIELD_LABELS.contractImportedAt]: row.contractImportedAt,
        [exports.FIELD_LABELS.contractManualEdits]: row.contractManualEdits,
        [exports.FIELD_LABELS.contractManualEditsCount]: row.contractManualEditsCount,
        [exports.FIELD_LABELS.createdAt]: row.createdAt,
        [exports.FIELD_LABELS.updatedAt]: row.updatedAt
    };
}
function buildSummary(details) {
    const items = [
        { key: 'total', label: '总记录数', value: details.length },
        { key: 'confirmed', label: '已确认', value: details.filter((d) => d.result.status === types_1.RecordStatus.CONFIRMED).length },
        { key: 'needs_review', label: '待复核', value: details.filter((d) => d.result.status === types_1.RecordStatus.NEEDS_REVIEW).length },
        { key: 'matched', label: '已匹配', value: details.filter((d) => d.result.status === types_1.RecordStatus.MATCHED).length },
        { key: 'rejected', label: '已驳回', value: details.filter((d) => d.result.status === types_1.RecordStatus.REJECTED).length },
        { key: 'temp_substitute', label: '临时替补待复核', value: details.filter((d) => d.result.reviewReasons.includes(types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP)).length },
        { key: 'contract_missing', label: '缺少合同截图', value: details.filter((d) => d.result.reviewReasons.includes(types_1.ReviewReason.CONTRACT_MISSING)).length },
        { key: 'late_refresh', label: '晚到材料刷新', value: details.filter((d) => d.result.isLateContractRefresh).length }
    ];
    return items;
}
function buildLogRow(log) {
    const summarize = (obj) => {
        if (!obj)
            return '';
        try {
            if (typeof obj === 'string')
                return obj;
            const keys = Object.keys(obj);
            if (keys.length <= 5)
                return JSON.stringify(obj);
            return `{ ${keys.slice(0, 5).join(', ')} ... }`;
        }
        catch (e) {
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
//# sourceMappingURL=presenter.js.map