import {
  ConflictRecord,
  ConflictRecordStore,
  ProcessingStatus,
  WorkflowStep,
  SongInfo,
  ManualChange,
  WeeklyReportVersion,
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
      reportVersions: [],
    };
  }

  importRecords(
    rows: Array<{
      originalRowNumber: number;
      liveName: string;
      copyrightName: string;
      band: string;
      conflictDescription: string;
    }>,
    importedBy: string
  ): ConflictRecord[] {
    const now = new Date();
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
      };

      newRecords.push(record);
      this.store.records.push(record);
    }

    return newRecords;
  }

  addEngineerMessage(recordId: string, message: string, addedBy: string): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId);
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

    return record;
  }

  updateStatus(
    recordId: string,
    newStatus: ProcessingStatus,
    updatedBy: string,
    reason: string
  ): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId);
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

    return record;
  }

  createWeeklyReport(createdBy: string): WeeklyReportVersion {
    const now = new Date();
    const normalRecords = this.store.records.filter(
      (r) => r.processingStatus === ProcessingStatus.NORMAL
    );
    const abnormalCount = this.store.records.filter(
      (r) => r.processingStatus === ProcessingStatus.ABNORMAL
    ).length;
    const needsReviewCount = this.store.records.filter(
      (r) => r.processingStatus === ProcessingStatus.NEEDS_TEACHER_REVIEW
    ).length;

    const summary = `正常${normalRecords.length}条，异常${abnormalCount}条，待音乐老师复核${needsReviewCount}条`;

    const version: WeeklyReportVersion = {
      id: generateId(),
      createdAt: now,
      createdBy,
      recordIds: normalRecords.map((r) => r.id),
      summary,
    };

    this.store.reportVersions.push(version);
    this.store.currentReportVersionId = version.id;

    for (const record of normalRecords) {
      record.workflowStep = WorkflowStep.WEEKLY_REPORT_UPDATED;
      record.updatedAt = now;
    }

    return version;
  }

  getUnifiedRecordData(recordId: string): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId);
    if (!record) return null;
    return JSON.parse(JSON.stringify(record));
  }

  getAllUnifiedRecords(): ConflictRecord[] {
    return JSON.parse(JSON.stringify(this.store.records));
  }

  exportRecords(): string {
    const records = this.store.records;
    const headers = [
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
      '创建时间',
      '更新时间',
    ];

    const rows = records.map((r) => [
      r.originalRowNumber,
      r.song.liveName,
      r.song.copyrightName,
      r.song.hasDualNames ? '是' : '否',
      r.band,
      r.conflictDescription,
      r.processingStatus,
      r.workflowStep,
      r.engineerMessage || '',
      r.importedBy,
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
    for (const record of this.store.records) {
      if (record.workflowStep === WorkflowStep.WEEKLY_REPORT_UPDATED) {
        record.workflowStep = WorkflowStep.ENGINEER_MESSAGE_ADDED;
        record.updatedAt = now;
      }
    }

    return JSON.parse(JSON.stringify(previousVersion));
  }

  rollbackRecordStatus(recordId: string, rolledBackBy: string, reason: string): ConflictRecord | null {
    const record = this.store.records.find((r) => r.id === recordId);
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

    return record;
  }
}
