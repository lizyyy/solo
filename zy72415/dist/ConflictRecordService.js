"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictRecordService = void 0;
const types_1 = require("./types");
const boundaryRules_1 = require("./boundaryRules");
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
class ConflictRecordService {
    constructor() {
        this.store = {
            records: [],
            importBatches: [],
            reportVersions: [],
        };
    }
    getActiveRecords() {
        return this.store.records.filter((r) => !r.isRolledBack);
    }
    importRecords(rows, importedBy, source = '授权期限页') {
        const now = new Date();
        const batchId = generateId();
        const newRecords = [];
        for (const row of rows) {
            const song = {
                liveName: row.liveName,
                copyrightName: row.copyrightName,
                hasDualNames: (0, boundaryRules_1.detectDualNameSong)({
                    liveName: row.liveName,
                    copyrightName: row.copyrightName,
                    hasDualNames: false,
                }),
            };
            const initialStatus = song.hasDualNames
                ? boundaryRules_1.BOUNDARY_RULES.songDualName.howToProcess()
                : types_1.ProcessingStatus.PENDING_REVIEW;
            const record = {
                id: generateId(),
                importBatchId: batchId,
                originalRowNumber: row.originalRowNumber,
                song,
                band: row.band,
                conflictDescription: row.conflictDescription,
                processingStatus: initialStatus,
                workflowStep: types_1.WorkflowStep.INITIAL_IMPORT,
                manualChanges: [],
                createdAt: now,
                updatedAt: now,
                importedBy,
                isRolledBack: false,
            };
            newRecords.push(record);
            this.store.records.push(record);
        }
        const batch = {
            id: batchId,
            importedBy,
            importedAt: now,
            recordIds: newRecords.map((r) => r.id),
            source,
            isRolledBack: false,
        };
        this.store.importBatches.push(batch);
        return { batch, records: newRecords };
    }
    rollbackImportBatch(batchId, rolledBackBy, reason) {
        const batch = this.store.importBatches.find((b) => b.id === batchId);
        if (!batch)
            return null;
        if (batch.isRolledBack) {
            throw new Error('这个导入批次已经撤回过了，不能再撤。');
        }
        const now = new Date();
        batch.isRolledBack = true;
        batch.rolledBackAt = now;
        batch.rolledBackBy = rolledBackBy;
        batch.rollbackReason = reason;
        for (const recordId of batch.recordIds) {
            const record = this.store.records.find((r) => r.id === recordId);
            if (record) {
                const change = {
                    changedBy: rolledBackBy,
                    changedAt: now,
                    field: 'isRolledBack',
                    oldValue: 'false',
                    newValue: 'true',
                    reason: `导入批次撤回：${reason}`,
                };
                record.manualChanges.push(change);
                record.isRolledBack = true;
                record.updatedAt = now;
            }
        }
        return JSON.parse(JSON.stringify(batch));
    }
    getImportBatches() {
        return JSON.parse(JSON.stringify(this.store.importBatches));
    }
    getImportBatch(batchId) {
        const batch = this.store.importBatches.find((b) => b.id === batchId);
        return batch ? JSON.parse(JSON.stringify(batch)) : null;
    }
    addEngineerMessage(recordId, message, addedBy) {
        const record = this.store.records.find((r) => r.id === recordId && !r.isRolledBack);
        if (!record)
            return null;
        const change = {
            changedBy: addedBy,
            changedAt: new Date(),
            field: 'engineerMessage',
            oldValue: record.engineerMessage || '',
            newValue: message,
            reason: '琴行店长老周补看调音师留言',
        };
        record.engineerMessage = message;
        record.manualChanges.push(change);
        record.workflowStep = types_1.WorkflowStep.ENGINEER_MESSAGE_ADDED;
        record.updatedAt = new Date();
        return JSON.parse(JSON.stringify(record));
    }
    updateStatus(recordId, newStatus, updatedBy, reason) {
        const record = this.store.records.find((r) => r.id === recordId && !r.isRolledBack);
        if (!record)
            return null;
        if (!(0, boundaryRules_1.validateStatusTransition)(record.processingStatus, newStatus)) {
            throw new Error(`不允许从 ${record.processingStatus} 直接跳到 ${newStatus}。调音要一步一步来。`);
        }
        const change = {
            changedBy: updatedBy,
            changedAt: new Date(),
            field: 'processingStatus',
            oldValue: record.processingStatus,
            newValue: newStatus,
            reason,
        };
        record.processingStatus = newStatus;
        record.manualChanges.push(change);
        record.updatedAt = new Date();
        return JSON.parse(JSON.stringify(record));
    }
    createWeeklyReport(createdBy) {
        const now = new Date();
        const activeRecords = this.getActiveRecords();
        const normalRecords = activeRecords.filter((r) => r.processingStatus === types_1.ProcessingStatus.NORMAL);
        const abnormalCount = activeRecords.filter((r) => r.processingStatus === types_1.ProcessingStatus.ABNORMAL).length;
        const needsReviewCount = activeRecords.filter((r) => r.processingStatus === types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW).length;
        const pendingCount = activeRecords.filter((r) => r.processingStatus === types_1.ProcessingStatus.PENDING_REVIEW).length;
        const totalCount = activeRecords.length;
        const summary = `正常${normalRecords.length}条，待复核${pendingCount}条，异常${abnormalCount}条，待音乐老师复核${needsReviewCount}条`;
        const lines = [];
        lines.push(`【耳返频段冲突周报】生成时间：${now.toLocaleString()}`);
        lines.push(`生成人：${createdBy}`);
        lines.push(`总记录数：${totalCount}  |  正常：${normalRecords.length}  |  待复核：${pendingCount}  |  异常：${abnormalCount}  |  待老师复核(双名)：${needsReviewCount}`);
        lines.push('');
        lines.push('—— 待音乐老师复核（双名歌曲，音乐老师定夺后再走下一步）——');
        for (const r of activeRecords.filter((x) => x.processingStatus === types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW)) {
            lines.push(`  · ${r.song.liveName} / ${r.song.copyrightName}  [${r.band}]  ${r.conflictDescription}`);
            if (r.engineerMessage)
                lines.push(`      调音师留言：${r.engineerMessage}`);
        }
        lines.push('');
        lines.push('—— 待复核（正常流程）——');
        for (const r of activeRecords.filter((x) => x.processingStatus === types_1.ProcessingStatus.PENDING_REVIEW)) {
            lines.push(`  · ${r.song.liveName}  [${r.band}]  ${r.conflictDescription}`);
            if (r.engineerMessage)
                lines.push(`      调音师留言：${r.engineerMessage}`);
        }
        if (normalRecords.length > 0) {
            lines.push('');
            lines.push('—— 正常（已确认无误）——');
            for (const r of normalRecords) {
                lines.push(`  · ${r.song.liveName}  [${r.band}]  已确认无冲突`);
            }
        }
        lines.push('');
        lines.push('—— 给店长的话 ——');
        lines.push('老板，本周频段冲突如上。双名歌曲我没敢擅自归正常，留着给音乐老师复核后再说。');
        const content = lines.join('\n');
        const version = {
            id: generateId(),
            createdAt: now,
            createdBy,
            recordIds: activeRecords.map((r) => r.id),
            summary,
            totalCount,
            normalCount: normalRecords.length,
            pendingCount,
            abnormalCount,
            teacherReviewCount: needsReviewCount,
            content,
        };
        this.store.reportVersions.push(version);
        this.store.currentReportVersionId = version.id;
        for (const record of activeRecords) {
            record.workflowStep = types_1.WorkflowStep.WEEKLY_REPORT_UPDATED;
            record.updatedAt = now;
        }
        return JSON.parse(JSON.stringify(version));
    }
    getUnifiedRecordData(recordId) {
        const record = this.store.records.find((r) => r.id === recordId);
        if (!record)
            return null;
        return JSON.parse(JSON.stringify(record));
    }
    getAllUnifiedRecords(includeRolledBack = false) {
        const records = includeRolledBack ? this.store.records : this.getActiveRecords();
        return JSON.parse(JSON.stringify(records));
    }
    exportRecords(includeRolledBack = false) {
        const records = includeRolledBack ? this.store.records : this.getActiveRecords();
        const headers = [
            '记录ID',
            '导入批次ID',
            '原始行号',
            '现场名',
            '版权名',
            '是否双名',
            '频段',
            '冲突描述',
            '处理状态',
            '流程步骤',
            '调音师留言',
            '导入人',
            '是否已撤回',
            '创建时间',
            '更新时间',
        ];
        const statusToText = {
            pending_review: '待复核',
            normal: '正常',
            abnormal: '异常',
            needs_teacher_review: '待音乐老师复核',
        };
        const stepToText = {
            initial_import: '第一步：已导入',
            engineer_message_added: '第二步：已补留言',
            weekly_report_updated: '第三步：已入周报',
        };
        const rows = records.map((r) => [
            r.id,
            r.importBatchId,
            r.originalRowNumber,
            r.song.liveName,
            r.song.copyrightName,
            r.song.hasDualNames ? '是' : '否',
            r.band,
            r.conflictDescription,
            statusToText[r.processingStatus] || r.processingStatus,
            stepToText[r.workflowStep] || r.workflowStep,
            r.engineerMessage || '',
            r.importedBy,
            r.isRolledBack ? '是' : '否',
            r.createdAt.toISOString(),
            r.updatedAt.toISOString(),
        ]);
        return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    }
    getRecordChangeHistory(recordId) {
        const record = this.store.records.find((r) => r.id === recordId);
        if (!record)
            return null;
        return JSON.parse(JSON.stringify(record.manualChanges));
    }
    getWeeklyReportVersions() {
        return JSON.parse(JSON.stringify(this.store.reportVersions));
    }
    getCurrentWeeklyReport() {
        if (!this.store.currentReportVersionId)
            return null;
        return this.store.reportVersions.find((v) => v.id === this.store.currentReportVersionId) || null;
    }
    rollbackToPreviousReport() {
        if (this.store.reportVersions.length < 2) {
            throw new Error('没有上一版周报可以撤回。就像琴弦还没调过，没法撤回上一步。');
        }
        const currentIndex = this.store.reportVersions.findIndex((v) => v.id === this.store.currentReportVersionId);
        if (currentIndex <= 0) {
            throw new Error('已经是第一版了，没法再撤了。');
        }
        const previousVersion = this.store.reportVersions[currentIndex - 1];
        this.store.currentReportVersionId = previousVersion.id;
        const now = new Date();
        for (const record of this.getActiveRecords()) {
            if (record.workflowStep === types_1.WorkflowStep.WEEKLY_REPORT_UPDATED) {
                record.workflowStep = record.engineerMessage
                    ? types_1.WorkflowStep.ENGINEER_MESSAGE_ADDED
                    : types_1.WorkflowStep.INITIAL_IMPORT;
                record.updatedAt = now;
            }
        }
        return JSON.parse(JSON.stringify(previousVersion));
    }
    rollbackRecordStatus(recordId, rolledBackBy, reason) {
        const record = this.store.records.find((r) => r.id === recordId && !r.isRolledBack);
        if (!record)
            return null;
        if (record.manualChanges.length > 0) {
            const lastStatusChange = [...record.manualChanges]
                .reverse()
                .find((c) => c.field === 'processingStatus');
            if (lastStatusChange) {
                const oldStatus = lastStatusChange.oldValue;
                if ((0, boundaryRules_1.validateStatusTransition)(record.processingStatus, oldStatus)) {
                    return this.updateStatus(recordId, oldStatus, rolledBackBy, reason);
                }
            }
        }
        if (record.song.hasDualNames) {
            if ((0, boundaryRules_1.validateStatusTransition)(record.processingStatus, types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW)) {
                return this.updateStatus(recordId, types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW, rolledBackBy, reason);
            }
        }
        const allowedStatuses = boundaryRules_1.BOUNDARY_RULES.statusTransition.allowedTransitions[record.processingStatus] || [];
        if (allowedStatuses.includes(types_1.ProcessingStatus.PENDING_REVIEW)) {
            return this.updateStatus(recordId, types_1.ProcessingStatus.PENDING_REVIEW, rolledBackBy, reason);
        }
        return JSON.parse(JSON.stringify(record));
    }
}
exports.ConflictRecordService = ConflictRecordService;
