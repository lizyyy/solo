import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingOrder,
  ReworkReport,
  ReworkStatus,
  ProcessingOrderStatus,
  ReworkReason,
  SubmissionMeta
} from '../types';
import { dataStore } from '../store/dataStore';
import { stateMachineService } from './stateMachine';
import { axisConsistencyChecker } from './axisConsistencyChecker';

export interface CreateReworkReportRequest {
  processingOrderNumber: string;
  reporter: string;
  reporterRole: string;
  reworkItems: Array<{
    eye: 'OD' | 'OS' | 'BOTH';
    reason: ReworkReason;
    description: string;
    originalAxis?: number;
    correctedAxis?: number;
    originalPower?: number;
    correctedPower?: number;
  }>;
  rootCause?: string;
  correctiveAction?: string;
  source: string;
  userRole: string;
}

export interface UpdateReworkStatusRequest {
  reworkReportId: string;
  targetStatus: ReworkStatus;
  performedBy: string;
  userRole: string;
  reviewComments?: string;
  assignedTo?: string;
  inspectionResult?: 'pass' | 'fail';
}

export class ReworkService {
  createReworkReport(request: CreateReworkReportRequest): {
    success: boolean;
    message: string;
    data?: ReworkReport;
    axisIssues?: any[];
  } {
    const processingOrder = dataStore.getProcessingOrderByNumber(
      request.processingOrderNumber
    );

    if (!processingOrder) {
      return {
        success: false,
        message: `加工单 ${request.processingOrderNumber} 不存在`
      };
    }

    for (const item of request.reworkItems) {
      if (item.originalAxis !== undefined &&
          !axisConsistencyChecker.validateAxisValue(item.originalAxis)) {
        return {
          success: false,
          message: `${item.eye} 原始轴位 ${item.originalAxis} 无效，必须是 0-180 之间的整数`
        };
      }
      if (item.correctedAxis !== undefined &&
          !axisConsistencyChecker.validateAxisValue(item.correctedAxis)) {
        return {
          success: false,
          message: `${item.eye} 修正轴位 ${item.correctedAxis} 无效，必须是 0-180 之间的整数`
        };
      }
    }

    const submissionMeta: SubmissionMeta = {
      source: request.source,
      submittedAt: new Date(),
      submittedBy: request.reporter,
      userRole: request.userRole
    };

    const reworkReport: ReworkReport = {
      id: uuidv4(),
      processingOrderId: processingOrder.id,
      processingOrderNumber: request.processingOrderNumber,
      reporter: request.reporter,
      reporterRole: request.reporterRole,
      reportedAt: new Date(),
      reworkItems: request.reworkItems,
      rootCause: request.rootCause,
      correctiveAction: request.correctiveAction,
      status: ReworkStatus.SUBMITTED,
      submissionMeta,
      auditTrail: [
        stateMachineService.createAuditEntry(
          'create_rework_report',
          request.reporter,
          undefined,
          ReworkStatus.SUBMITTED
        )
      ]
    };

    dataStore.saveReworkReport(reworkReport);

    processingOrder.status = ProcessingOrderStatus.REWORK_REQUESTED;
    processingOrder.reworkCount += 1;
    processingOrder.updatedAt = new Date();
    processingOrder.auditTrail.push(
      stateMachineService.createAuditEntry(
        'rework_requested',
        request.reporter,
        ProcessingOrderStatus.QUALITY_CHECK,
        ProcessingOrderStatus.REWORK_REQUESTED
      )
    );
    dataStore.saveProcessingOrder(processingOrder);

    const axisIssues = axisConsistencyChecker.checkAndSaveIssues(
      processingOrder.id,
      reworkReport.id
    );

    return {
      success: true,
      message: '返工报告创建成功',
      data: reworkReport,
      axisIssues
    };
  }

  updateReworkStatus(request: UpdateReworkStatusRequest): {
    success: boolean;
    message: string;
    data?: ReworkReport;
    availableTransitions?: any[];
  } {
    const reworkReport = dataStore.getReworkReport(request.reworkReportId);

    if (!reworkReport) {
      return {
        success: false,
        message: '返工报告不存在'
      };
    }

    const transitionCheck = stateMachineService.canTransitionRework(
      reworkReport.status,
      request.targetStatus,
      request.userRole
    );

    if (!transitionCheck.allowed) {
      const availableTransitions = stateMachineService.getAvailableReworkTransitions(
        reworkReport.status,
        request.userRole
      );
      return {
        success: false,
        message: transitionCheck.reason || '状态转换不允许',
        availableTransitions
      };
    }

    if (transitionCheck.rule?.requiredFields) {
      for (const field of transitionCheck.rule.requiredFields) {
        if (!(request as any)[field]) {
          return {
            success: false,
            message: `缺少必填字段: ${field}`
          };
        }
      }
    }

    const oldStatus = reworkReport.status;
    reworkReport.status = request.targetStatus;

    if (request.reviewComments) {
      reworkReport.reviewComments = request.reviewComments;
      reworkReport.reviewedBy = request.performedBy;
      reworkReport.reviewedAt = new Date();
    }

    if (request.assignedTo) {
      reworkReport.assignedTo = request.assignedTo;
    }

    if (request.targetStatus === ReworkStatus.IN_REWORK) {
      reworkReport.startedAt = new Date();
    }

    if (request.targetStatus === ReworkStatus.REWORK_COMPLETED) {
      reworkReport.completedAt = new Date();
    }

    if (request.inspectionResult) {
      reworkReport.inspectionResult = request.inspectionResult;
      reworkReport.inspectedBy = request.performedBy;
      reworkReport.inspectedAt = new Date();
    }

    reworkReport.auditTrail.push(
      stateMachineService.createAuditEntry(
        'status_change',
        request.performedBy,
        oldStatus,
        request.targetStatus
      )
    );

    dataStore.saveReworkReport(reworkReport);

    if (request.targetStatus === ReworkStatus.CLOSED &&
        request.inspectionResult === 'pass') {
      const processingOrder = dataStore.getProcessingOrder(
        reworkReport.processingOrderId
      );
      if (processingOrder) {
        processingOrder.status = ProcessingOrderStatus.COMPLETED;
        processingOrder.updatedAt = new Date();
        processingOrder.auditTrail.push(
          stateMachineService.createAuditEntry(
            'rework_completed_final',
            request.performedBy,
            ProcessingOrderStatus.REWORK_REQUESTED,
            ProcessingOrderStatus.COMPLETED
          )
        );
        dataStore.saveProcessingOrder(processingOrder);
      }
    }

    return {
      success: true,
      message: `状态已更新为 ${request.targetStatus}`,
      data: reworkReport
    };
  }

  getReworkReport(id: string) {
    return dataStore.getReworkReport(id);
  }

  getReworkReportsByOrder(processingOrderId: string) {
    return dataStore.getReworkReportsByOrderId(processingOrderId);
  }

  getAllReworkReports() {
    return dataStore.getAllReworkReports();
  }

  getAxisIssues(reworkReportId: string) {
    return dataStore.getAxisIssuesByRework(reworkReportId);
  }

  syncAxisFromRework(
    reworkReportId: string,
    performedBy: string
  ) {
    const reworkReport = dataStore.getReworkReport(reworkReportId);
    if (!reworkReport) {
      return { success: false, message: '返工报告不存在' };
    }

    return axisConsistencyChecker.syncAxisToProcessingOrder(
      reworkReport.processingOrderId,
      reworkReportId,
      performedBy
    );
  }
}

export const reworkService = new ReworkService();
