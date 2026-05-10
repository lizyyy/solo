import { dataStore } from '../repositories/DataStore';
import { auditLogger, LogModule } from '../utils/AuditLogger';
import { OperatorInfo } from '../models/types';
import { 
  CrossRegionAssignment, 
  AssignmentType, 
  AssignmentReason, 
  AssignmentApprovalStatus 
} from '../models/CrossRegionAssignment';
import { Quarter } from '../models/types';

export interface CreateCrossRegionAssignmentRequest {
  achievementRecordId: string;
  originalChannelId: string;
  originalChannelName: string;
  originalRegionId: string;
  originalRegionName: string;
  assignedChannelId: string;
  assignedChannelName: string;
  assignedRegionId: string;
  assignedRegionName: string;
  assignmentType: AssignmentType;
  assignmentReason: AssignmentReason;
  year: number;
  quarter: Quarter;
  splitPercentage: number;
  notes?: string;
}

export interface CrossRegionResult {
  success: boolean;
  assignment?: CrossRegionAssignment;
  errorMessage?: string;
  warningMessages?: string[];
}

export class CrossRegionAssignmentService {
  public createAssignment(
    request: CreateCrossRegionAssignmentRequest, 
    operator: OperatorInfo
  ): CrossRegionResult {
    const warnings: string[] = [];

    if (request.originalChannelId === request.assignedChannelId) {
      return {
        success: false,
        errorMessage: '原渠道和分配渠道不能相同'
      };
    }

    if (request.splitPercentage <= 0 || request.splitPercentage > 100) {
      return {
        success: false,
        errorMessage: '分配比例必须在(0, 100]范围内'
      };
    }

    if (request.assignmentType === AssignmentType.FULL_TRANSFER && request.splitPercentage !== 100) {
      return {
        success: false,
        errorMessage: '全额转移类型的分配比例必须为100%'
      };
    }

    const existingAssignment = dataStore.crossRegionAssignments.findAll().find(
      a => a.achievementRecordId === request.achievementRecordId &&
           a.approvalStatus !== AssignmentApprovalStatus.CANCELLED
    );

    if (existingAssignment) {
      return {
        success: false,
        errorMessage: `该达标记录(${request.achievementRecordId})已存在跨区归属记录，状态：${existingAssignment.approvalStatus}。如需修改，请先取消现有记录。`
      };
    }

    const achievementRecord = dataStore.achievementRecords.findById(request.achievementRecordId);
    if (achievementRecord) {
      const splitAmount = achievementRecord.achievementAmount * (request.splitPercentage / 100);

      const assignment = dataStore.crossRegionAssignments.create({
        achievementRecordId: request.achievementRecordId,
        originalChannelId: request.originalChannelId,
        originalChannelName: request.originalChannelName,
        originalRegionId: request.originalRegionId,
        originalRegionName: request.originalRegionName,
        assignedChannelId: request.assignedChannelId,
        assignedChannelName: request.assignedChannelName,
        assignedRegionId: request.assignedRegionId,
        assignedRegionName: request.assignedRegionName,
        assignmentType: request.assignmentType,
        assignmentReason: request.assignmentReason,
        year: request.year,
        quarter: request.quarter,
        splitPercentage: request.splitPercentage,
        splitAmount,
        assignmentDate: new Date(),
        effectiveDate: new Date(),
        isApproved: false,
        approvalStatus: AssignmentApprovalStatus.PENDING,
        approvedBy: null,
        approvedAt: null,
        isDisputed: false,
        disputeId: null,
        notes: request.notes || ''
      });

      auditLogger.log({
        module: LogModule.CROSS_REGION_ASSIGNMENT,
        operation: 'CREATE_ASSIGNMENT',
        operator,
        targetEntityType: 'CrossRegionAssignment',
        targetEntityId: assignment.id,
        afterState: { ...assignment },
        success: true,
        reason: `创建跨区归属：从${request.originalChannelId}到${request.assignedChannelId}，比例${request.splitPercentage}%`
      });

      return {
        success: true,
        assignment,
        warningMessages: warnings
      };
    }

    return {
      success: false,
      errorMessage: `达标记录不存在：${request.achievementRecordId}`
    };
  }

  public approveAssignment(
    assignmentId: string, 
    operator: OperatorInfo
  ): CrossRegionResult {
    const assignment = dataStore.crossRegionAssignments.findById(assignmentId);
    if (!assignment) {
      return {
        success: false,
        errorMessage: `跨区归属记录不存在：${assignmentId}`
      };
    }

    if (assignment.approvalStatus !== AssignmentApprovalStatus.PENDING) {
      return {
        success: false,
        errorMessage: `当前状态为${assignment.approvalStatus}，只能审批待处理的记录`
      };
    }

    const updated = dataStore.crossRegionAssignments.update(assignmentId, {
      isApproved: true,
      approvalStatus: AssignmentApprovalStatus.APPROVED,
      approvedBy: operator.operatorId,
      approvedAt: new Date()
    });

    auditLogger.log({
      module: LogModule.CROSS_REGION_ASSIGNMENT,
      operation: 'APPROVE_ASSIGNMENT',
      operator,
      targetEntityType: 'CrossRegionAssignment',
      targetEntityId: assignmentId,
      beforeState: { approvalStatus: AssignmentApprovalStatus.PENDING },
      afterState: { approvalStatus: AssignmentApprovalStatus.APPROVED },
      success: true,
      reason: '审批通过跨区归属'
    });

    return {
      success: true,
      assignment: updated
    };
  }

  public rejectAssignment(
    assignmentId: string, 
    reason: string,
    operator: OperatorInfo
  ): CrossRegionResult {
    const assignment = dataStore.crossRegionAssignments.findById(assignmentId);
    if (!assignment) {
      return {
        success: false,
        errorMessage: `跨区归属记录不存在：${assignmentId}`
      };
    }

    if (assignment.approvalStatus !== AssignmentApprovalStatus.PENDING) {
      return {
        success: false,
        errorMessage: `当前状态为${assignment.approvalStatus}，只能拒绝待处理的记录`
      };
    }

    const updated = dataStore.crossRegionAssignments.update(assignmentId, {
      isApproved: false,
      approvalStatus: AssignmentApprovalStatus.REJECTED,
      approvedBy: operator.operatorId,
      approvedAt: new Date(),
      notes: assignment.notes + `\n[${new Date().toLocaleString('zh-CN')}] 拒绝原因：${reason}`
    });

    auditLogger.log({
      module: LogModule.CROSS_REGION_ASSIGNMENT,
      operation: 'REJECT_ASSIGNMENT',
      operator,
      targetEntityType: 'CrossRegionAssignment',
      targetEntityId: assignmentId,
      beforeState: { approvalStatus: AssignmentApprovalStatus.PENDING },
      afterState: { approvalStatus: AssignmentApprovalStatus.REJECTED },
      success: true,
      reason: `拒绝跨区归属：${reason}`
    });

    return {
      success: true,
      assignment: updated
    };
  }

  public getAssignmentsByAchievement(achievementRecordId: string): CrossRegionAssignment[] {
    return dataStore.crossRegionAssignments.findByCriteria({ achievementRecordId });
  }

  public getApprovedAssignment(achievementRecordId: string): CrossRegionAssignment | undefined {
    return dataStore.crossRegionAssignments.findAll().find(
      a => a.achievementRecordId === achievementRecordId &&
           a.approvalStatus === AssignmentApprovalStatus.APPROVED
    );
  }

  public getAssignmentById(assignmentId: string): CrossRegionAssignment | undefined {
    return dataStore.crossRegionAssignments.findById(assignmentId);
  }
}

export const crossRegionAssignmentService = new CrossRegionAssignmentService();
