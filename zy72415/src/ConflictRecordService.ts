import {
  ConflictRecord,
  ConflictRecordStore,
  ProcessingStatus,
  WorkflowStep,
  SongInfo,
  ManualChange,
  WeeklyReportVersion,
  ImportBatch,
} from './types';
import { detectDualNameSong, validateStatusTransition, BOUNDARY_RULES } from './boundaryRules';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export class ConflictRecordService {
  private store: ConflictRecordStore;

  constructor() {
    this.store = {
      records: [],
      importBatches: [],
      reportVersions: [],
    };
  }

  private getActiveRecords(): ConflictRecord[] {
    return this.store.records.filter((r) => !r.isRolledBack);
  }

  importRecords(
    rows: Array<{
      originalRowNumber: number;
      liveName: string;
      copyrightName: string;
      band: string;
      conflictDescription: string;
    }>,
    importedBy: string,
    source: string = '授权期限页'
  ): { batch: ImportBatch; records: ConflictRecord[] } {
    const now = new Date();
    const batchId = generateId();
    const newRecords: ConflictRecord[] = [];

    for (const row of rows) {
      const song: SongInfo = {
        liveName: row.liveName,
        copyrightName: row.copyrightName,
        hasDualNames: detectDualNameSong({
          liveName: row.liveName,
          copyrightName: row.copyrightName,
          hasDualNames: false,
        }),
      };

      const initialStatus = song.hasDualNames
        ? BOUNDARY_RULES.songDualName.howToProcess()
        : ProcessingStatus.PENDING_REVIEW;

      const record: ConflictRecord = {
        id: generateId(),
        importBatchId: batchId,
        originalRowNumber: row.originalRowNumber,
        song,
        band: row.band,
        conflictDescription: row.conflictDescription,
        processingStatus: initialStatus,
        workflowStep: WorkflowStep.INITIAL_IMPORT,
        manualChanges: [],
        createdAt: now,
        updatedAt: now,
        importedBy,
        isRolledBack: false,
      };

      newRecords.push(record);
      this.store.records.push(record);
    }

    const batch: ImportBatch = {
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

  rollbackImportBatch(
    batchId: string,
    rolledBackBy: string,
    reason: string
  ): ImportBatch | null {
    const batch = this.store.importBatches.find((b) => b.id === batchId);
    if (!batch) return null;
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
        const change: ManualChange = {
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

  getImportBatches(): ImportBatch[] {
    return JSON.parse(JSON.stringify(this.store.importBatches));
  }

  getImportBatch(batchId: string): ImportBatch | null {
    const batch = this.store.importBatches.find((b) => b.id === batchId);
    return batch ? JSON.parse(JSON.stringify(batch)) : null;
  }

  addEngineerMessage(recordId: string, message: string, addedBy: string): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId && !r.isRolledBack);
    if (!record) return null;

    const change: ManualChange = {
      changedBy: addedBy,
      changedAt: new Date(),
      field: 'engineerMessage',
      oldValue: record.engineerMessage || '',
      newValue: message,
      reason: '琴行店长老周补看调音师留言',
    };

    record.engineerMessage = message;
    record.manualChanges.push(change);
    record.workflowStep = WorkflowStep.ENGINEER_MESSAGE_ADDED;
    record.updatedAt = new Date();

    return JSON.parse(JSON.stringify(record));
  }

  updateStatus(
    recordId: string,
    newStatus: ProcessingStatus,
    updatedBy: string,
    reason: string
  ): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId && !r.isRolledBack);
    if (!record) return null;

    if (!validateStatusTransition(record.processingStatus, newStatus)) {
      throw new Error(
        `不允许从 ${record.processingStatus} 直接跳到 ${newStatus}。调音要一步一步来。`
      );
    }

    const change: ManualChange = {
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

  createWeeklyReport(createdBy: string): WeeklyReportVersion {
    const now = new Date();
    const activeRecords = this.getActiveRecords();
    const normalRecords = activeRecords.filter(
      (r) => r.processingStatus === ProcessingStatus.NORMAL
    );
    const abnormalCount = activeRecords.filter(
      (r) => r.processingStatus === ProcessingStatus.ABNORMAL
    ).length;
    const needsReviewCount = activeRecords.filter(
      (r) => r.processingStatus === ProcessingStatus.NEEDS_TEACHER_REVIEW
    ).length;
    const pendingCount = activeRecords.filter(
      (r) => r.processingStatus === ProcessingStatus.PENDING_REVIEW
    ).length;
    const totalCount = activeRecords.length;

    const summary = `正常${normalRecords.length}条，待复核${pendingCount}条，异常${abnormalCount}条，待音乐老师复核${needsReviewCount}条`;

    const lines: string[] = [];
    lines.push(`【耳返频段冲突周报】生成时间：${now.toLocaleString()}`);
    lines.push(`生成人：${createdBy}`);
    lines.push(`总记录数：${totalCount}  |  正常：${normalRecords.length}  |  待复核：${pendingCount}  |  异常：${abnormalCount}  |  待老师复核(双名)：${needsReviewCount}`);
    lines.push('');
    lines.push('—— 待音乐老师复核（双名歌曲，音乐老师定夺后再走下一步）——');
    for (const r of activeRecords.filter((x) => x.processingStatus === ProcessingStatus.NEEDS_TEACHER_REVIEW)) {
      lines.push(`  · ${r.song.liveName} / ${r.song.copyrightName}  [${r.band}]  ${r.conflictDescription}`);
      if (r.engineerMessage) lines.push(`      调音师留言：${r.engineerMessage}`);
    }
    lines.push('');
    lines.push('—— 待复核（正常流程）——');
    for (const r of activeRecords.filter((x) => x.processingStatus === ProcessingStatus.PENDING_REVIEW)) {
      lines.push(`  · ${r.song.liveName}  [${r.band}]  ${r.conflictDescription}`);
      if (r.engineerMessage) lines.push(`      调音师留言：${r.engineerMessage}`);
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

    const version: WeeklyReportVersion = {
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
      record.workflowStep = WorkflowStep.WEEKLY_REPORT_UPDATED;
      record.updatedAt = now;
    }

    return JSON.parse(JSON.stringify(version));
  }

  getUnifiedRecordData(recordId: string): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId);
    if (!record) return null;
    return JSON.parse(JSON.stringify(record));
  }

  getAllUnifiedRecords(includeRolledBack: boolean = false): ConflictRecord[] {
    const records = includeRolledBack ? this.store.records : this.getActiveRecords();
    return JSON.parse(JSON.stringify(records));
  }

  exportRecords(includeRolledBack: boolean = false): string {
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

    const statusToText: Record<string, string> = {
      pending_review: '待复核',
      normal: '正常',
      abnormal: '异常',
      needs_teacher_review: '待音乐老师复核',
    };
    const stepToText: Record<string, string> = {
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

  getRecordChangeHistory(recordId: string): ManualChange[] | null {
    const record = this.store.records.find((r) => r.id === recordId);
    if (!record) return null;
    return JSON.parse(JSON.stringify(record.manualChanges));
  }

  getWeeklyReportVersions(): WeeklyReportVersion[] {
    return JSON.parse(JSON.stringify(this.store.reportVersions));
  }

  getCurrentWeeklyReport(): WeeklyReportVersion | null {
    if (!this.store.currentReportVersionId) return null;
    return this.store.reportVersions.find((v) => v.id === this.store.currentReportVersionId) || null;
  }

  rollbackToPreviousReport(): WeeklyReportVersion | null {
    if (this.store.reportVersions.length < 2) {
      throw new Error('没有上一版周报可以撤回。就像琴弦还没调过，没法撤回上一步。');
    }

    const currentIndex = this.store.reportVersions.findIndex(
      (v) => v.id === this.store.currentReportVersionId
    );

    if (currentIndex <= 0) {
      throw new Error('已经是第一版了，没法再撤了。');
    }

    const previousVersion = this.store.reportVersions[currentIndex - 1];
    this.store.currentReportVersionId = previousVersion.id;

    const now = new Date();
    for (const record of this.getActiveRecords()) {
      if (record.workflowStep === WorkflowStep.WEEKLY_REPORT_UPDATED) {
        record.workflowStep = record.engineerMessage
          ? WorkflowStep.ENGINEER_MESSAGE_ADDED
          : WorkflowStep.INITIAL_IMPORT;
        record.updatedAt = now;
      }
    }

    return JSON.parse(JSON.stringify(previousVersion));
  }

  rollbackRecordStatus(recordId: string, rolledBackBy: string, reason: string): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId && !r.isRolledBack);
    if (!record) return null;

    if (record.manualChanges.length > 0) {
      const lastStatusChange = [...record.manualChanges]
        .reverse()
        .find((c) => c.field === 'processingStatus');
      
      if (lastStatusChange) {
        const oldStatus = lastStatusChange.oldValue as ProcessingStatus;
        if (validateStatusTransition(record.processingStatus, oldStatus)) {
          return this.updateStatus(recordId, oldStatus, rolledBackBy, reason);
        }
      }
    }

    if (record.song.hasDualNames) {
      if (validateStatusTransition(record.processingStatus, ProcessingStatus.NEEDS_TEACHER_REVIEW)) {
        return this.updateStatus(recordId, ProcessingStatus.NEEDS_TEACHER_REVIEW, rolledBackBy, reason);
      }
    }

    const allowedStatuses = BOUNDARY_RULES.statusTransition.allowedTransitions[record.processingStatus] || [];
    if (allowedStatuses.includes(ProcessingStatus.PENDING_REVIEW)) {
      return this.updateStatus(recordId, ProcessingStatus.PENDING_REVIEW, rolledBackBy, reason);
    }

    return JSON.parse(JSON.stringify(record));
  }
}
