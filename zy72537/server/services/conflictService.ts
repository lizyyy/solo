import { v4 as uuidv4 } from 'uuid';
import { CheckRecord, ConflictEvidence, KnowledgeBaseReference, FeedbackTicket } from '../../shared/types';

export class ConflictService {
  detectConflicts(
    knowledgeRef: KnowledgeBaseReference | undefined,
    feedbackTicket: FeedbackTicket | undefined
  ): ConflictEvidence[] {
    const conflicts: ConflictEvidence[] = [];

    if (!knowledgeRef || !feedbackTicket) {
      return conflicts;
    }

    if (knowledgeRef.conclusion !== feedbackTicket.conclusion) {
      conflicts.push({
        id: uuidv4(),
        type: 'knowledge_vs_ticket',
        sampleId: knowledgeRef.sampleId,
        fieldName: 'conclusion',
        knowledgeValue: knowledgeRef.conclusion,
        ticketValue: feedbackTicket.conclusion,
        description: '知识库结论与线上工单结论矛盾',
        detectedAt: Date.now(),
      });
    }

    if (knowledgeRef.modelVersion !== feedbackTicket.modelVersion) {
      conflicts.push({
        id: uuidv4(),
        type: 'knowledge_vs_ticket',
        sampleId: knowledgeRef.sampleId,
        fieldName: 'modelVersion',
        knowledgeValue: knowledgeRef.modelVersion,
        ticketValue: feedbackTicket.modelVersion,
        description: '知识库模型版本与线上工单模型版本不一致',
        detectedAt: Date.now(),
      });
    }

    return conflicts;
  }

  hasConflicts(record: CheckRecord): boolean {
    return record.conflicts.length > 0;
  }

  getConflictSummary(conflicts: ConflictEvidence[]): {
    total: number;
    conclusionConflicts: number;
    versionConflicts: number;
  } {
    return {
      total: conflicts.length,
      conclusionConflicts: conflicts.filter(c => c.fieldName === 'conclusion').length,
      versionConflicts: conflicts.filter(c => c.fieldName === 'modelVersion').length,
    };
  }
}

export const conflictService = new ConflictService();
