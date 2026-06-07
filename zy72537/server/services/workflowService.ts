import { v4 as uuidv4 } from 'uuid';
import { CheckRecord, CheckStatus, KnowledgeBaseReference, FeedbackTicket } from '../../shared/types';
import { dataStore } from '../store/dataStore';
import { conflictService } from './conflictService';
import { selfCheckService } from './selfCheckService';

export class WorkflowService {
  step1_importKnowledgeReference(
    sampleId: string,
    sampleName: string,
    imageUrl: string,
    caption: string,
    knowledgeRef: Omit<KnowledgeBaseReference, 'id' | 'importedAt' | 'importedBy'>,
    operator: string
  ): CheckRecord {
    const existingRecords = dataStore.getRecordsBySampleId(sampleId);
    const previousVersion = existingRecords.length > 0 
      ? existingRecords[0].knowledgeReference?.modelVersion 
      : undefined;

    const knowledgeReference: KnowledgeBaseReference = {
      ...knowledgeRef,
      id: uuidv4(),
      importedAt: Date.now(),
      importedBy: operator,
    };

    const selfCheckResults = selfCheckService.runAllChecks(
      sampleId,
      knowledgeReference,
      previousVersion
    );

    const hasModelVersionWarning = selfCheckService.hasModelVersionWarning(selfCheckResults);

    const record = dataStore.createRecord({
      sampleId,
      sampleName,
      imageUrl,
      caption,
      knowledgeReference,
      status: hasModelVersionWarning ? 'pending_review' : 'imported',
      currentStep: 1,
      conflicts: [],
      selfCheckResults,
      modelVersionInfo: {
        version: knowledgeRef.modelVersion,
        params: {
          threshold: 0.85,
          useBERT: true,
          imageFeatureExtractor: 'CLIP-ViT-L/14',
        },
        tradeOffReason: '提高阈值以减少误报，接受少量漏报风险；使用BERT增强语义理解',
        timestamp: Date.now(),
      },
      calculationResult: {
        consistencyScore: this.calculateConsistencyScore(),
        isConsistent: true,
        details: {
          textSimilarity: 0.85,
          imageTextMatch: 0.88,
          entityMatch: 0.86,
        },
      },
      reviewHistory: [
        {
          action: '导入知识库引用',
          operator,
          timestamp: Date.now(),
        },
      ],
    });

    dataStore.markSampleImported(sampleId);

    return record;
  }

  step2_linkFeedbackTicket(
    recordId: string,
    ticket: Omit<FeedbackTicket, 'id' | 'feedbackTime' | 'operator'>,
    operator: string
  ): CheckRecord | undefined {
    const record = dataStore.getRecordById(recordId);
    if (!record) return undefined;

    const feedbackTicket: FeedbackTicket = {
      ...ticket,
      id: uuidv4(),
      feedbackTime: Date.now(),
      operator,
    };

    const conflicts = conflictService.detectConflicts(
      record.knowledgeReference,
      feedbackTicket
    );

    const hasConflicts = conflicts.length > 0;
    const hasModelVersionWarning = selfCheckService.hasModelVersionWarning(record.selfCheckResults);

    let newStatus: CheckStatus;
    if (hasConflicts) {
      newStatus = 'conflict_detected';
    } else if (hasModelVersionWarning) {
      newStatus = 'pending_review';
    } else {
      newStatus = 'pending_recheck';
    }

    const updatedSelfCheck = record.selfCheckResults.map(check => {
      if (check.type === 'recalc_after_supplement') {
        return selfCheckService.markRecalcCompleted();
      }
      return check;
    });

    const updatedRecord = dataStore.updateRecord(recordId, {
      feedbackTicket,
      conflicts,
      status: newStatus,
      currentStep: 2,
      selfCheckResults: updatedSelfCheck,
      reviewHistory: [
        ...record.reviewHistory,
        {
          action: '关联线上工单',
          operator,
          timestamp: Date.now(),
        },
        ...(hasConflicts ? [{
          action: '检测到冲突',
          operator: 'system',
          timestamp: Date.now(),
        }] : []),
      ],
    });

    return updatedRecord;
  }

  resolveConflict(
    recordId: string,
    conflictId: string,
    resolution: 'confirm' | 'reject',
    comment: string,
    operator: string
  ): CheckRecord | undefined {
    const record = dataStore.getRecordById(recordId);
    if (!record) return undefined;

    const remainingConflicts = record.conflicts.filter(c => c.id !== conflictId);
    const hasModelVersionWarning = selfCheckService.hasModelVersionWarning(record.selfCheckResults);

    let newStatus: CheckStatus;
    if (remainingConflicts.length > 0) {
      newStatus = 'conflict_detected';
    } else if (hasModelVersionWarning) {
      newStatus = 'pending_review';
    } else {
      newStatus = resolution === 'confirm' ? 'review_confirmed' : 'review_rejected';
    }

    const updatedRecord = dataStore.updateRecord(recordId, {
      conflicts: remainingConflicts,
      status: newStatus,
      reviewHistory: [
        ...record.reviewHistory,
        {
          action: resolution === 'confirm' ? '确认冲突' : '驳回冲突',
          operator,
          timestamp: Date.now(),
          comment,
        },
      ],
    });

    return updatedRecord;
  }

  step3_updateProductReview(
    recordId: string,
    content: string,
    operator: string
  ): CheckRecord | undefined {
    const record = dataStore.getRecordById(recordId);
    if (!record) return undefined;

    const updatedRecord = dataStore.updateRecord(recordId, {
      status: 'completed',
      currentStep: 3,
      productReviewUpdate: {
        updatedAt: Date.now(),
        updatedBy: operator,
        content,
      },
      reviewHistory: [
        ...record.reviewHistory,
        {
          action: '产品复盘页更新',
          operator,
          timestamp: Date.now(),
        },
      ],
    });

    return updatedRecord;
  }

  requestRecheck(recordId: string, operator: string): CheckRecord | undefined {
    const record = dataStore.getRecordById(recordId);
    if (!record) return undefined;

    return dataStore.updateRecord(recordId, {
      status: 'pending_recheck',
      reviewHistory: [
        ...record.reviewHistory,
        {
          action: '请求复核',
          operator,
          timestamp: Date.now(),
        },
      ],
    });
  }

  completeRecheck(recordId: string, operator: string): CheckRecord | undefined {
    const record = dataStore.getRecordById(recordId);
    if (!record) return undefined;

    return dataStore.updateRecord(recordId, {
      status: 'rechecked',
      reviewHistory: [
        ...record.reviewHistory,
        {
          action: '完成复核',
          operator,
          timestamp: Date.now(),
        },
      ],
    });
  }

  private calculateConsistencyScore(): number {
    return 0.85 + Math.random() * 0.1;
  }
}

export const workflowService = new WorkflowService();
