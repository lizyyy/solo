import { dataStore } from '../repositories/DataStore';
import { auditLogger, LogModule } from '../utils/AuditLogger';
import { OperatorInfo, ChannelIncentiveStatus, DisputeReason } from '../models/types';
import { 
  Dispute, 
  DisputeType, 
  DisputeStatus, 
  DisputeDetails,
  DisputeEvidence,
  DisputeComment,
  DisputeResolution,
  DisputeStatusChangeLog
} from '../models/Dispute';

export interface RaiseDisputeRequest {
  achievementRecordId: string;
  disputeType: DisputeType;
  disputeReason: DisputeReason;
  disputeDetails: DisputeDetails;
  evidence?: DisputeEvidence[];
  comment?: string;
}

export interface DisputeResult {
  success: boolean;
  dispute?: Dispute;
  errorMessage?: string;
  warningMessages?: string[];
}

export class DisputeService {
  public raiseDispute(
    request: RaiseDisputeRequest, 
    operator: OperatorInfo
  ): DisputeResult {
    const achievementRecord = dataStore.achievementRecords.findById(request.achievementRecordId);
    if (!achievementRecord) {
      return {
        success: false,
        errorMessage: `达标记录不存在：${request.achievementRecordId}`
      };
    }

    const allowedStatusesForDispute = [
      ChannelIncentiveStatus.VERIFIED,
      ChannelIncentiveStatus.APPROVED,
      ChannelIncentiveStatus.PAID
    ];

    if (!allowedStatusesForDispute.includes(achievementRecord.currentStatus)) {
      return {
        success: false,
        errorMessage: `当前状态「${achievementRecord.currentStatus}」不允许提出争议。允许提出争议的状态：已验证、已审批、已付款`
      };
    }

    const existingOpenDispute = dataStore.disputes.findAll().find(
      d => d.achievementRecordId === request.achievementRecordId &&
           (d.currentStatus === DisputeStatus.OPEN ||
            d.currentStatus === DisputeStatus.ASSIGNED ||
            d.currentStatus === DisputeStatus.UNDER_REVIEW)
    );

    if (existingOpenDispute) {
      return {
        success: false,
        errorMessage: `该达标记录已存在未解决的争议（ID: ${existingOpenDispute.id}），请先处理现有争议。`
      };
    }

    const now = new Date();
    const initialStatusChange: DisputeStatusChangeLog = {
      fromStatus: null,
      toStatus: DisputeStatus.OPEN,
      operator,
      reason: '销售团队提出争议',
      timestamp: now
    };

    const comments: DisputeComment[] = [];
    if (request.comment) {
      comments.push({
        comment: request.comment,
        author: operator,
        timestamp: now,
        isInternal: false
      });
    }

    const dispute = dataStore.disputes.create({
      achievementRecordId: request.achievementRecordId,
      disputeType: request.disputeType,
      disputeReason: request.disputeReason,
      disputeDetails: request.disputeDetails,
      raisedBy: operator,
      raisedAt: now,
      currentStatus: DisputeStatus.OPEN,
      statusHistory: [initialStatusChange],
      assignedTo: null,
      assignedAt: null,
      evidence: request.evidence || [],
      comments,
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
      relatedIncentiveStatusChange: null
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'RAISE_DISPUTE',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: dispute.id,
      afterState: { ...dispute },
      success: true,
      reason: `针对达标记录${request.achievementRecordId}提出争议：${request.disputeReason}`
    });

    return {
      success: true,
      dispute
    };
  }

  public assignDispute(
    disputeId: string, 
    assigneeId: string,
    operator: OperatorInfo
  ): DisputeResult {
    const dispute = dataStore.disputes.findById(disputeId);
    if (!dispute) {
      return {
        success: false,
        errorMessage: `争议记录不存在：${disputeId}`
      };
    }

    if (dispute.currentStatus !== DisputeStatus.OPEN) {
      return {
        success: false,
        errorMessage: `当前状态为「${dispute.currentStatus}」，只能分配处于「OPEN」状态的争议`
      };
    }

    const statusChange: DisputeStatusChangeLog = {
      fromStatus: dispute.currentStatus,
      toStatus: DisputeStatus.ASSIGNED,
      operator,
      reason: `分配给处理人：${assigneeId}`,
      timestamp: new Date()
    };

    const updated = dataStore.disputes.update(disputeId, {
      currentStatus: DisputeStatus.ASSIGNED,
      assignedTo: assigneeId,
      assignedAt: new Date(),
      statusHistory: [...dispute.statusHistory, statusChange]
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'ASSIGN_DISPUTE',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: disputeId,
      beforeState: { 
        status: dispute.currentStatus,
        assignedTo: dispute.assignedTo
      },
      afterState: { 
        status: DisputeStatus.ASSIGNED,
        assignedTo: assigneeId
      },
      success: true,
      reason: `分配争议给${assigneeId}`
    });

    return {
      success: true,
      dispute: updated
    };
  }

  public startReview(
    disputeId: string, 
    operator: OperatorInfo
  ): DisputeResult {
    const dispute = dataStore.disputes.findById(disputeId);
    if (!dispute) {
      return {
        success: false,
        errorMessage: `争议记录不存在：${disputeId}`
      };
    }

    const allowedStatuses = [DisputeStatus.ASSIGNED, DisputeStatus.AWAITING_EVIDENCE];
    if (!allowedStatuses.includes(dispute.currentStatus)) {
      return {
        success: false,
        errorMessage: `当前状态为「${dispute.currentStatus}」，只能从「ASSIGNED」或「AWAITING_EVIDENCE」开始复核`
      };
    }

    const statusChange: DisputeStatusChangeLog = {
      fromStatus: dispute.currentStatus,
      toStatus: DisputeStatus.UNDER_REVIEW,
      operator,
      reason: '开始人工复核',
      timestamp: new Date()
    };

    const updated = dataStore.disputes.update(disputeId, {
      currentStatus: DisputeStatus.UNDER_REVIEW,
      statusHistory: [...dispute.statusHistory, statusChange]
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'START_REVIEW',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: disputeId,
      beforeState: { status: dispute.currentStatus },
      afterState: { status: DisputeStatus.UNDER_REVIEW },
      success: true,
      reason: '开始复核争议'
    });

    return {
      success: true,
      dispute: updated
    };
  }

  public requestEvidence(
    disputeId: string, 
    requestMessage: string,
    operator: OperatorInfo
  ): DisputeResult {
    const dispute = dataStore.disputes.findById(disputeId);
    if (!dispute) {
      return {
        success: false,
        errorMessage: `争议记录不存在：${disputeId}`
      };
    }

    if (dispute.currentStatus !== DisputeStatus.UNDER_REVIEW) {
      return {
        success: false,
        errorMessage: `当前状态为「${dispute.currentStatus}」，只能在「UNDER_REVIEW」状态下要求补充证据`
      };
    }

    const statusChange: DisputeStatusChangeLog = {
      fromStatus: dispute.currentStatus,
      toStatus: DisputeStatus.AWAITING_EVIDENCE,
      operator,
      reason: `要求补充证据：${requestMessage}`,
      timestamp: new Date()
    };

    const comment: DisputeComment = {
      comment: `需要补充证据：${requestMessage}`,
      author: operator,
      timestamp: new Date(),
      isInternal: false
    };

    const updated = dataStore.disputes.update(disputeId, {
      currentStatus: DisputeStatus.AWAITING_EVIDENCE,
      statusHistory: [...dispute.statusHistory, statusChange],
      comments: [...dispute.comments, comment]
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'REQUEST_EVIDENCE',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: disputeId,
      beforeState: { status: dispute.currentStatus },
      afterState: { status: DisputeStatus.AWAITING_EVIDENCE },
      success: true,
      reason: `要求补充证据：${requestMessage}`
    });

    return {
      success: true,
      dispute: updated
    };
  }

  public submitEvidence(
    disputeId: string, 
    evidence: DisputeEvidence,
    operator: OperatorInfo
  ): DisputeResult {
    const dispute = dataStore.disputes.findById(disputeId);
    if (!dispute) {
      return {
        success: false,
        errorMessage: `争议记录不存在：${disputeId}`
      };
    }

    if (dispute.currentStatus !== DisputeStatus.AWAITING_EVIDENCE) {
      return {
        success: false,
        errorMessage: `当前状态为「${dispute.currentStatus}」，只能在「AWAITING_EVIDENCE」状态下提交证据`
      };
    }

    const updated = dataStore.disputes.update(disputeId, {
      evidence: [...dispute.evidence, evidence]
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'SUBMIT_EVIDENCE',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: disputeId,
      success: true,
      reason: `提交证据：${evidence.evidenceTitle}`
    });

    return {
      success: true,
      dispute: updated
    };
  }

  public resolveDispute(
    disputeId: string, 
    resolution: DisputeResolution,
    operator: OperatorInfo
  ): DisputeResult {
    const dispute = dataStore.disputes.findById(disputeId);
    if (!dispute) {
      return {
        success: false,
        errorMessage: `争议记录不存在：${disputeId}`
      };
    }

    if (dispute.currentStatus !== DisputeStatus.UNDER_REVIEW) {
      return {
        success: false,
        errorMessage: `当前状态为「${dispute.currentStatus}」，只能在「UNDER_REVIEW」状态下解决争议`
      };
    }

    const statusChange: DisputeStatusChangeLog = {
      fromStatus: dispute.currentStatus,
      toStatus: DisputeStatus.RESOLVED,
      operator,
      reason: `争议解决：${resolution.resolutionType} - ${resolution.resolutionDetails}`,
      timestamp: new Date()
    };

    const updated = dataStore.disputes.update(disputeId, {
      currentStatus: DisputeStatus.RESOLVED,
      statusHistory: [...dispute.statusHistory, statusChange],
      resolution,
      resolvedAt: new Date(),
      resolvedBy: operator,
      relatedIncentiveStatusChange: resolution.impact.newStatus
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'RESOLVE_DISPUTE',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: disputeId,
      beforeState: { 
        status: dispute.currentStatus,
        resolution: null
      },
      afterState: { 
        status: DisputeStatus.RESOLVED,
        resolution
      },
      success: true,
      reason: `解决争议：${resolution.resolutionType}`
    });

    return {
      success: true,
      dispute: updated
    };
  }

  public addComment(
    disputeId: string, 
    comment: string,
    isInternal: boolean,
    operator: OperatorInfo
  ): DisputeResult {
    const dispute = dataStore.disputes.findById(disputeId);
    if (!dispute) {
      return {
        success: false,
        errorMessage: `争议记录不存在：${disputeId}`
      };
    }

    const disputeComment: DisputeComment = {
      comment,
      author: operator,
      timestamp: new Date(),
      isInternal
    };

    const updated = dataStore.disputes.update(disputeId, {
      comments: [...dispute.comments, disputeComment]
    });

    auditLogger.log({
      module: LogModule.DISPUTE,
      operation: 'ADD_COMMENT',
      operator,
      targetEntityType: 'Dispute',
      targetEntityId: disputeId,
      success: true,
      reason: `添加${isInternal ? '内部' : '外部'}评论`
    });

    return {
      success: true,
      dispute: updated
    };
  }

  public getDisputeById(disputeId: string): Dispute | undefined {
    return dataStore.disputes.findById(disputeId);
  }

  public getDisputesByAchievement(achievementRecordId: string): Dispute[] {
    return dataStore.disputes.findByCriteria({ achievementRecordId });
  }

  public getOpenDisputes(): Dispute[] {
    return dataStore.disputes.findAll().filter(
      d => d.currentStatus !== DisputeStatus.RESOLVED && 
           d.currentStatus !== DisputeStatus.CLOSED
    );
  }
}

export const disputeService = new DisputeService();
