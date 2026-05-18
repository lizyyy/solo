import { ProcessingOrderStatus, ReworkStatus, AuditEntry } from '../types';

export interface StateTransitionRule {
  from: string;
  to: string;
  allowedRoles: string[];
  requiredFields?: string[];
  description: string;
}

export const processingOrderTransitions: StateTransitionRule[] = [
  {
    from: ProcessingOrderStatus.PENDING,
    to: ProcessingOrderStatus.IN_PRODUCTION,
    allowedRoles: ['technician', 'supervisor', 'admin'],
    requiredFields: ['assignedTechnician'],
    description: '开始生产'
  },
  {
    from: ProcessingOrderStatus.IN_PRODUCTION,
    to: ProcessingOrderStatus.QUALITY_CHECK,
    allowedRoles: ['technician', 'supervisor', 'admin'],
    description: '生产完成，进入质检'
  },
  {
    from: ProcessingOrderStatus.QUALITY_CHECK,
    to: ProcessingOrderStatus.COMPLETED,
    allowedRoles: ['qc', 'supervisor', 'admin'],
    description: '质检通过，完成加工'
  },
  {
    from: ProcessingOrderStatus.QUALITY_CHECK,
    to: ProcessingOrderStatus.REWORK_REQUESTED,
    allowedRoles: ['qc', 'supervisor', 'admin'],
    description: '质检不通过，申请返工'
  },
  {
    from: ProcessingOrderStatus.REWORK_REQUESTED,
    to: ProcessingOrderStatus.IN_PRODUCTION,
    allowedRoles: ['technician', 'supervisor', 'admin'],
    description: '返工申请确认，重新进入生产'
  },
  {
    from: ProcessingOrderStatus.REWORK_REQUESTED,
    to: ProcessingOrderStatus.CANCELLED,
    allowedRoles: ['supervisor', 'admin'],
    description: '取消加工单'
  },
  {
    from: ProcessingOrderStatus.PENDING,
    to: ProcessingOrderStatus.CANCELLED,
    allowedRoles: ['supervisor', 'admin'],
    description: '取消待处理加工单'
  },
  {
    from: ProcessingOrderStatus.COMPLETED,
    to: ProcessingOrderStatus.REWORK_REQUESTED,
    allowedRoles: ['qc', 'supervisor', 'admin'],
    description: '已完成订单申请返工'
  }
];

export const reworkTransitions: StateTransitionRule[] = [
  {
    from: ReworkStatus.SUBMITTED,
    to: ReworkStatus.REVIEWING,
    allowedRoles: ['supervisor', 'admin'],
    description: '开始审核返工报告'
  },
  {
    from: ReworkStatus.REVIEWING,
    to: ReworkStatus.APPROVED,
    allowedRoles: ['supervisor', 'admin'],
    requiredFields: ['reviewedBy', 'reviewComments'],
    description: '审核通过，批准返工'
  },
  {
    from: ReworkStatus.REVIEWING,
    to: ReworkStatus.REJECTED,
    allowedRoles: ['supervisor', 'admin'],
    requiredFields: ['reviewedBy', 'reviewComments'],
    description: '审核不通过，拒绝返工'
  },
  {
    from: ReworkStatus.APPROVED,
    to: ReworkStatus.IN_REWORK,
    allowedRoles: ['technician', 'supervisor'],
    requiredFields: ['assignedTo'],
    description: '开始返工'
  },
  {
    from: ReworkStatus.IN_REWORK,
    to: ReworkStatus.REWORK_COMPLETED,
    allowedRoles: ['technician', 'supervisor'],
    description: '返工完成'
  },
  {
    from: ReworkStatus.REWORK_COMPLETED,
    to: ReworkStatus.FINAL_INSPECTION,
    allowedRoles: ['qc', 'supervisor', 'admin'],
    description: '进入最终检验'
  },
  {
    from: ReworkStatus.FINAL_INSPECTION,
    to: ReworkStatus.CLOSED,
    allowedRoles: ['qc', 'supervisor', 'admin'],
    requiredFields: ['inspectionResult', 'inspectedBy'],
    description: '检验通过，结案'
  },
  {
    from: ReworkStatus.FINAL_INSPECTION,
    to: ReworkStatus.IN_REWORK,
    allowedRoles: ['qc', 'supervisor', 'admin'],
    description: '检验不通过，重新返工'
  },
  {
    from: ReworkStatus.REJECTED,
    to: ReworkStatus.CLOSED,
    allowedRoles: ['supervisor', 'admin'],
    description: '关闭被拒绝的返工报告'
  }
];

export class StateMachineService {
  canTransitionProcessingOrder(
    currentStatus: ProcessingOrderStatus,
    targetStatus: ProcessingOrderStatus,
    userRole: string
  ): { allowed: boolean; reason?: string; rule?: StateTransitionRule } {
    const rule = processingOrderTransitions.find(
      t => t.from === currentStatus && t.to === targetStatus
    );

    if (!rule) {
      return {
        allowed: false,
        reason: `不允许从状态 ${currentStatus} 转换到 ${targetStatus}`
      };
    }

    if (!rule.allowedRoles.includes(userRole)) {
      return {
        allowed: false,
        reason: `角色 ${userRole} 没有权限执行此操作。允许的角色: ${rule.allowedRoles.join(', ')}`
      };
    }

    return { allowed: true, rule };
  }

  canTransitionRework(
    currentStatus: ReworkStatus,
    targetStatus: ReworkStatus,
    userRole: string
  ): { allowed: boolean; reason?: string; rule?: StateTransitionRule } {
    const rule = reworkTransitions.find(
      t => t.from === currentStatus && t.to === targetStatus
    );

    if (!rule) {
      return {
        allowed: false,
        reason: `不允许从状态 ${currentStatus} 转换到 ${targetStatus}`
      };
    }

    if (!rule.allowedRoles.includes(userRole)) {
      return {
        allowed: false,
        reason: `角色 ${userRole} 没有权限执行此操作。允许的角色: ${rule.allowedRoles.join(', ')}`
      };
    }

    return { allowed: true, rule };
  }

  createAuditEntry(
    action: string,
    performedBy: string,
    fromStatus?: string,
    toStatus?: string,
    changes?: Record<string, any>,
    notes?: string
  ): AuditEntry {
    return {
      action,
      timestamp: new Date(),
      performedBy,
      fromStatus,
      toStatus,
      changes,
      notes
    };
  }

  getAvailableProcessingOrderTransitions(
    currentStatus: ProcessingOrderStatus,
    userRole: string
  ): StateTransitionRule[] {
    return processingOrderTransitions.filter(
      t => t.from === currentStatus && t.allowedRoles.includes(userRole)
    );
  }

  getAvailableReworkTransitions(
    currentStatus: ReworkStatus,
    userRole: string
  ): StateTransitionRule[] {
    return reworkTransitions.filter(
      t => t.from === currentStatus && t.allowedRoles.includes(userRole)
    );
  }
}

export const stateMachineService = new StateMachineService();
