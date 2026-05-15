import * as crypto from 'crypto';
import {
  MeetingMinutes,
  MeetingAttachment,
  EvidenceChain,
  EvidenceItem,
  ManualCorrection,
  ProcessingResult,
  ExportSummary,
  QueryFilter,
  SearchTermReport,
} from '../types';
import { FileStorage, ActionLogEntry } from './storage';

export class MeetingMinutesProcessor {
  private meetings: Map<string, MeetingMinutes> = new Map();
  private actionLog: Array<ActionLogEntry> = [];
  private storage?: FileStorage;
  private dataDir?: string;

  constructor(options?: { dataDir?: string; useStorage?: boolean }) {
    if (options?.useStorage || options?.dataDir) {
      this.dataDir = options.dataDir;
      this.storage = new FileStorage(this.dataDir);
      this.loadFromStorage();
    }
  }

  private loadFromStorage(): void {
    if (!this.storage) return;
    const meetings = this.storage.loadAllMeetings();
    this.meetings.clear();
    meetings.forEach((m) => {
      this.meetings.set(m.id, m);
    });
    this.actionLog = this.storage.loadAllActions();
  }

  private saveToStorage(): void {
    if (!this.storage) return;
    const meetings = Array.from(this.meetings.values());
    meetings.forEach((m) => {
      this.storage!.saveMeeting(m);
    });
  }

  enableStorage(dataDir?: string): void {
    this.dataDir = dataDir;
    this.storage = new FileStorage(this.dataDir);
    this.loadFromStorage();
  }

  disableStorage(): void {
    this.storage = undefined;
    this.dataDir = undefined;
  }

  isStorageEnabled(): boolean {
    return this.storage !== undefined;
  }

  getStorage(): FileStorage | undefined {
    return this.storage;
  }

  generateId(): string {
    return crypto.randomUUID();
  }

  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  createMeetingMinutes(
    title: string,
    date: string,
    department: string,
    attendees: string[]
  ): MeetingMinutes {
    const meetingId = this.generateId();
    const now = new Date().toISOString();

    const meeting: MeetingMinutes = {
      id: meetingId,
      meetingTitle: title,
      meetingDate: date,
      department,
      attendees,
      topics: [],
      decisions: [],
      actionItems: [],
      attachments: [],
      evidenceChain: {
        id: this.generateId(),
        meetingId,
        items: [],
        status: 'complete',
      },
      corrections: [],
      searchTermReports: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.meetings.set(meetingId, meeting);
    this.saveToStorage();
    this.logAction('create', `创建会议纪要: ${title}`, now, meetingId);
    return meeting;
  }

  addAttachment(
    meetingId: string,
    fileName: string,
    fileType: string,
    uploader: string,
    content: string,
    originalInput: Record<string, any>
  ): ProcessingResult {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      return {
        success: false,
        meetingId,
        message: '会议纪要不存在',
        errors: [`找不到会议ID: ${meetingId}`],
        warnings: [],
        evidenceChainStatus: 'unknown',
        correctionsApplied: 0,
      };
    }

    const now = new Date().toISOString();
    const attachment: MeetingAttachment = {
      id: this.generateId(),
      fileName,
      fileType,
      uploadTime: now,
      uploader,
      contentHash: this.hashContent(content),
      originalInput,
    };

    meeting.attachments.push(attachment);

    const evidenceItem: EvidenceItem = {
      id: this.generateId(),
      type: 'attachment',
      source: fileName,
      description: `附件上传: ${fileName}`,
      timestamp: now,
      verified: true,
      verificationMethod: 'content_hash',
    };

    meeting.evidenceChain.items.push(evidenceItem);
    this.verifyEvidenceChain(meeting);
    meeting.updatedAt = now;
    this.saveToStorage();

    this.logAction(
      'add_attachment',
      `添加附件: ${fileName}`,
      now,
      meetingId
    );

    return {
      success: true,
      meetingId,
      message: '附件添加成功',
      errors: [],
      warnings: [],
      evidenceChainStatus: meeting.evidenceChain.status,
      correctionsApplied: 0,
    };
  }

  simulateBrokenEvidenceChain(
    meetingId: string,
    reason: string
  ): ProcessingResult {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      return {
        success: false,
        meetingId,
        message: '会议纪要不存在',
        errors: [`找不到会议ID: ${meetingId}`],
        warnings: [],
        evidenceChainStatus: 'unknown',
        correctionsApplied: 0,
      };
    }

    const now = new Date().toISOString();
    meeting.evidenceChain.status = 'broken';
    meeting.evidenceChain.brokenAt = meeting.evidenceChain.items.length;
    meeting.evidenceChain.brokenReason = reason;
    meeting.updatedAt = now;
    this.saveToStorage();

    this.logAction(
      'break_chain',
      `证据链断开: ${reason}`,
      now,
      meetingId
    );

    return {
      success: true,
      meetingId,
      message: '证据链已模拟断开',
      errors: [],
      warnings: ['这是模拟的异常情况，用于测试异常流程'],
      evidenceChainStatus: 'broken',
      correctionsApplied: 0,
    };
  }

  private verifyEvidenceChain(meeting: MeetingMinutes): void {
    if (meeting.evidenceChain.items.length === 0) {
      meeting.evidenceChain.status = 'broken';
      meeting.evidenceChain.brokenReason = '无证据项';
      meeting.evidenceChain.brokenAt = 0;
      return;
    }

    const allVerified = meeting.evidenceChain.items.every(
      (item) => item.verified
    );
    if (!allVerified) {
      meeting.evidenceChain.status = 'broken';
      const firstUnverified = meeting.evidenceChain.items.findIndex(
        (item) => !item.verified
      );
      meeting.evidenceChain.brokenAt = firstUnverified;
      meeting.evidenceChain.brokenReason = '存在未验证的证据项';
      return;
    }

    meeting.evidenceChain.status = 'complete';
    meeting.evidenceChain.brokenAt = undefined;
    meeting.evidenceChain.brokenReason = undefined;
  }

  applyManualCorrection(
    meetingId: string,
    fieldName: string,
    correctedValue: any,
    reason: string,
    corrector: string
  ): ProcessingResult {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) {
      return {
        success: false,
        meetingId,
        message: '会议纪要不存在',
        errors: [`找不到会议ID: ${meetingId}`],
        warnings: [],
        evidenceChainStatus: 'unknown',
        correctionsApplied: 0,
      };
    }

    const now = new Date().toISOString();
    const originalValue = this.getFieldValue(meeting, fieldName);
    const systemJudgment = originalValue;

    const correction: ManualCorrection = {
      id: this.generateId(),
      fieldName,
      originalValue,
      correctedValue,
      reason,
      corrector,
      timestamp: now,
      systemJudgment,
    };

    meeting.corrections.push(correction);

    this.setFieldValue(meeting, fieldName, correctedValue);

    const evidenceItem: EvidenceItem = {
      id: this.generateId(),
      type: 'manual',
      source: corrector,
      description: `人工修正: ${fieldName} 从 "${originalValue}" 改为 "${correctedValue}"`,
      timestamp: now,
      verified: true,
      verificationMethod: 'manual_approval',
    };

    meeting.evidenceChain.items.push(evidenceItem);
    this.verifyEvidenceChain(meeting);
    meeting.updatedAt = now;
    this.saveToStorage();

    this.logAction(
      'correction',
      `人工修正字段: ${fieldName}`,
      now,
      meetingId
    );

    return {
      success: true,
      meetingId,
      message: '人工修正已应用（保留系统判断记录）',
      errors: [],
      warnings: ['已保留原始系统判断，修正记录可追溯'],
      evidenceChainStatus: meeting.evidenceChain.status,
      correctionsApplied: meeting.corrections.length,
    };
  }

  private getFieldValue(meeting: MeetingMinutes, fieldName: string): any {
    const parts = fieldName.split('.');
    let value: any = meeting;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  private setFieldValue(
    meeting: MeetingMinutes,
    fieldName: string,
    value: any
  ): void {
    const parts = fieldName.split('.');
    let target: any = meeting;
    for (let i = 0; i < parts.length - 1; i++) {
      if (target && typeof target === 'object') {
        target = target[parts[i]];
      }
    }
    if (target && typeof target === 'object') {
      target[parts[parts.length - 1]] = value;
    }
  }

  generateSearchTermReport(
    meetingId: string,
    searchTerm: string,
    content: string
  ): SearchTermReport | null {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) return null;

    const regex = new RegExp(searchTerm, 'gi');
    const matches = content.match(regex);
    const occurrences = matches ? matches.length : 0;

    const lines = content.split('\n');
    const locations: string[] = [];
    let sampleContext = '';

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
        locations.push(`第${index + 1}行`);
        if (sampleContext === '') {
          sampleContext = line.trim();
        }
      }
    });

    const report: SearchTermReport = {
      searchTerm,
      occurrences,
      locations: locations.slice(0, 10),
      reviewSample: {
        context: sampleContext.substring(0, 200),
        verified: false,
      },
    };

    meeting.searchTermReports.push(report);
    this.saveToStorage();
    return report;
  }

  queryMeetings(filter: QueryFilter): MeetingMinutes[] {
    let results = Array.from(this.meetings.values());

    if (filter.meetingId) {
      results = results.filter((m) => m.id.includes(filter.meetingId!));
    }

    if (filter.department) {
      results = results.filter((m) =>
        m.department.includes(filter.department!)
      );
    }

    if (filter.status) {
      results = results.filter((m) => m.status === filter.status);
    }

    if (filter.hasBrokenChain !== undefined) {
      results = results.filter(
        (m) =>
          (m.evidenceChain.status === 'broken') === filter.hasBrokenChain
      );
    }

    if (filter.hasCorrections !== undefined) {
      results = results.filter(
        (m) => (m.corrections.length > 0) === filter.hasCorrections
      );
    }

    return results;
  }

  getMeeting(meetingId: string): MeetingMinutes | undefined {
    return this.meetings.get(meetingId);
  }

  getOriginalInput(
    meetingId: string,
    attachmentId: string
  ): Record<string, any> | null {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) return null;

    const attachment = meeting.attachments.find((a) => a.id === attachmentId);
    return attachment ? attachment.originalInput : null;
  }

  generateExportSummary(meetingId: string): ExportSummary | null {
    const meeting = this.meetings.get(meetingId);
    if (!meeting) return null;

    let relevantActions: ActionLogEntry[];
    if (this.storage) {
      relevantActions = this.storage.loadActionsByMeetingId(meetingId);
    } else {
      relevantActions = this.actionLog.filter(
        (a) => a.meetingId === meetingId
      );
    }

    return {
      input: {
        meetingId,
        attachments: meeting.attachments.map((a) => a.fileName),
        fields: [
          'meetingTitle',
          'meetingDate',
          'department',
          'attendees',
          'topics',
          'decisions',
        ],
      },
      actions: relevantActions.map((a) => ({
        type: a.type,
        description: a.description,
        timestamp: a.timestamp,
      })),
      conclusion: {
        status: meeting.status,
        evidenceChainIntact: meeting.evidenceChain.status === 'complete',
        correctionsCount: meeting.corrections.length,
        finalReportGenerated: true,
      },
    };
  }

  private logAction(
    type: string,
    description: string,
    timestamp: string,
    meetingId?: string
  ): void {
    const action: ActionLogEntry = { type, description, timestamp, meetingId };
    this.actionLog.push(action);
    if (this.storage) {
      this.storage.appendAction(action);
    }
  }

  getAllMeetings(): MeetingMinutes[] {
    return Array.from(this.meetings.values());
  }
}
