import { SubmissionDAO } from '../models/SubmissionDAO';
import { HistoryRecordDAO } from '../models/HistoryRecordDAO';
import { RuleVersionDAO } from '../models/RuleVersionDAO';
import { RuleEngineService } from './RuleEngineService';
import { Submission, SubmissionStatus, BatchActionType, BatchActionPreview, Attachment } from '../models/types';

export interface CreateSubmissionRequest {
  batchId: string;
  studentId: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  content: string;
  attachments: Array<{ name: string; type: string; size: number }>;
}

export class SubmissionService {
  static createSubmission(request: CreateSubmissionRequest, createdBy: string): Submission {
    const activeRule = RuleVersionDAO.getActiveRule();
    if (!activeRule) {
      throw new Error('没有可用的审核规则');
    }

    const now = new Date();
    const validDays = activeRule.rules.attachmentValidDays;
    const expireDate = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

    const attachments: Attachment[] = request.attachments.map((att, idx) => ({
      id: `att-${Date.now()}-${idx}`,
      name: att.name,
      type: att.type,
      size: att.size,
      uploadedAt: now,
      expireAt: expireDate,
      isExpired: false
    }));

    const submission = SubmissionDAO.create({
      batchId: request.batchId,
      studentId: request.studentId,
      studentName: request.studentName,
      courseCode: request.courseCode,
      courseName: request.courseName,
      content: request.content,
      attachments,
      ruleVersionId: activeRule.id,
      status: SubmissionStatus.PENDING
    });

    HistoryRecordDAO.create({
      submissionId: submission.id,
      fieldName: 'status',
      oldValue: undefined,
      newValue: SubmissionStatus.PENDING,
      changeReason: '创建提交',
      sourceSystem: 'web',
      changedBy: createdBy
    });

    return submission;
  }

  static createSubmissionWithExpiredAttachment(request: CreateSubmissionRequest, createdBy: string): Submission {
    const activeRule = RuleVersionDAO.getActiveRule();
    if (!activeRule) {
      throw new Error('没有可用的审核规则');
    }

    const now = new Date();
    const expireDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const attachments: Attachment[] = request.attachments.map((att, idx) => ({
      id: `att-${Date.now()}-${idx}`,
      name: att.name,
      type: att.type,
      size: att.size,
      uploadedAt: now,
      expireAt: expireDate,
      isExpired: true
    }));

    const submission = SubmissionDAO.create({
      batchId: request.batchId,
      studentId: request.studentId,
      studentName: request.studentName,
      courseCode: request.courseCode,
      courseName: request.courseName,
      content: request.content,
      attachments,
      ruleVersionId: activeRule.id,
      status: SubmissionStatus.PENDING
    });

    HistoryRecordDAO.create({
      submissionId: submission.id,
      fieldName: 'status',
      oldValue: undefined,
      newValue: SubmissionStatus.PENDING,
      changeReason: '创建测试提交（含过期附件）',
      sourceSystem: 'test',
      changedBy: createdBy
    });

    return submission;
  }

  static async processSubmission(submissionId: string, processedBy: string): Promise<Submission> {
    const submission = SubmissionDAO.getById(submissionId);
    if (!submission) {
      throw new Error('提交不存在');
    }

    const startTime = Date.now();
    const result = await RuleEngineService.validateSubmission(submission);
    const processingTime = Date.now() - startTime;

    const updatedSubmission = SubmissionDAO.update(submissionId, {
      status: result.status,
      summary: result.summary,
      conclusion: result.conclusion,
      processingTime,
      processedAt: new Date()
    })!;

    HistoryRecordDAO.create({
      submissionId,
      fieldName: 'status',
      oldValue: submission.status,
      newValue: result.status,
      changeReason: result.conclusion,
      sourceSystem: 'rule-engine',
      changedBy: processedBy
    });

    return updatedSubmission;
  }

  static async processBatch(batchId: string, processedBy: string): Promise<number> {
    const submissions = SubmissionDAO.getByBatchId(batchId);
    const pendingSubmissions = submissions.filter(s => s.status === SubmissionStatus.PENDING);

    for (const submission of pendingSubmissions) {
      await this.processSubmission(submission.id, processedBy);
    }

    return pendingSubmissions.length;
  }

  static previewBatchAction(batchId: string, actionType: BatchActionType): BatchActionPreview {
    const submissions = SubmissionDAO.getByBatchId(batchId);
    let affectedSubmissions: Submission[];

    switch (actionType) {
      case BatchActionType.APPROVE:
        affectedSubmissions = submissions.filter(s => 
          s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.REJECTED
        );
        break;
      case BatchActionType.REJECT:
        affectedSubmissions = submissions.filter(s => s.status === SubmissionStatus.PENDING);
        break;
      case BatchActionType.REPROCESS:
        affectedSubmissions = submissions;
        break;
      default:
        affectedSubmissions = [];
    }

    const warnings: string[] = [];
    const hasExpired = affectedSubmissions.some(s => 
      s.attachments.some(a => a.isExpired)
    );
    if (hasExpired) {
      warnings.push('部分提交包含过期附件，处理后将被标记为附件过期');
    }

    const estimatedTime = affectedSubmissions.length * 50;

    return {
      actionType,
      affectedCount: affectedSubmissions.length,
      affectedIds: affectedSubmissions.map(s => s.id),
      sampleSubmissions: affectedSubmissions.slice(0, 5),
      estimatedTime,
      warnings
    };
  }

  static updateSubmissionField(
    submissionId: string,
    fieldName: string,
    oldValue: string | undefined,
    newValue: string,
    changeReason: string,
    sourceSystem: string,
    changedBy: string
  ): Submission | null {
    const updateObj: any = {};
    updateObj[fieldName] = newValue;
    
    const updated = SubmissionDAO.update(submissionId, updateObj);
    
    if (updated) {
      HistoryRecordDAO.create({
        submissionId,
        fieldName,
        oldValue,
        newValue,
        changeReason,
        sourceSystem,
        changedBy
      });
    }

    return updated;
  }

  static getSubmissionWithHistory(submissionId: string): { submission: Submission | null; history: any[] } {
    const submission = SubmissionDAO.getById(submissionId);
    const history = submission ? HistoryRecordDAO.getBySubmissionId(submissionId) : [];
    return { submission, history };
  }

  static getBatchStats(batchId: string) {
    return SubmissionDAO.getStats(batchId);
  }

  static getAllBatches() {
    return SubmissionDAO.getDistinctBatchIds();
  }
}
