import { store } from './store';
import {
  ChangeOrder,
  ChangeOrderStatus,
  DependencyStatus,
  CreateChangeOrderRequest,
  FreezeDependencyRequest,
  ConfirmDependencyRequest,
  DelayDependencyRequest,
  ExceptionRequest,
  ManualCorrectionRequest
} from './types';

export class ChangeOrderService {
  createChangeOrder(request: CreateChangeOrderRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    if (store.existsByChangeOrderNo(request.changeOrderNo)) {
      return {
        success: false,
        error: 'DUPLICATE_CHANGE_ORDER_NO',
        message: `变更单号 ${request.changeOrderNo} 已存在，幂等校验通过`
      };
    }

    const dependencies = request.dependencies.map(dep => store.createDependency(dep));

    const changeOrder = store.createChangeOrder({
      changeOrderNo: request.changeOrderNo,
      title: request.title,
      description: request.description,
      status: ChangeOrderStatus.CREATED,
      dependencies,
      createdBy: request.createdBy
    });

    store.addExecutionSummary(changeOrder.id, {
      operator: request.createdBy,
      action: 'CREATE_CHANGE_ORDER',
      description: `创建变更单: ${request.changeOrderNo}`,
      originalInput: request,
      processingBasis: '初始创建'
    });

    return { success: true, data: changeOrder };
  }

  getChangeOrderById(id: string): { success: boolean; data?: ChangeOrder; error?: string } {
    const changeOrder = store.getChangeOrderById(id);
    if (!changeOrder) {
      return { success: false, error: 'CHANGE_ORDER_NOT_FOUND' };
    }
    return { success: true, data: changeOrder };
  }

  getChangeOrderByNo(changeOrderNo: string): { success: boolean; data?: ChangeOrder; error?: string } {
    const changeOrder = store.getChangeOrderByNo(changeOrderNo);
    if (!changeOrder) {
      return { success: false, error: 'CHANGE_ORDER_NOT_FOUND' };
    }
    return { success: true, data: changeOrder };
  }

  getAllChangeOrders(): { success: boolean; data: ChangeOrder[] } {
    return { success: true, data: store.getAllChangeOrders() };
  }

  startFreeze(id: string, request: FreezeDependencyRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;
    
    if (changeOrder.status === ChangeOrderStatus.DEPENDENCIES_FREEZING ||
        changeOrder.status === ChangeOrderStatus.ALL_DEPENDENCIES_FROZEN) {
      return {
        success: false,
        error: 'ALREADY_IN_FREEZE_STATE',
        message: '变更单已处于冻结流程中，幂等校验通过'
      };
    }

    if (changeOrder.status !== ChangeOrderStatus.CREATED) {
      return {
        success: false,
        error: 'INVALID_STATUS_TRANSITION',
        message: `当前状态 ${changeOrder.status} 无法启动冻结流程`
      };
    }

    const updated = store.updateChangeOrder(id, {
      status: ChangeOrderStatus.DEPENDENCIES_FREEZING
    });

    store.addExecutionSummary(id, {
      operator: request.operator,
      action: 'START_FREEZE',
      description: '启动依赖服务冻结流程',
      originalInput: request,
      processingBasis: '状态从 CREATED 迁移到 DEPENDENCIES_FREEZING'
    });

    return { success: true, data: updated };
  }

  freezeDependency(id: string, dependencyId: string, request: FreezeDependencyRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;
    const dependency = changeOrder.dependencies.find(d => d.id === dependencyId);

    if (!dependency) {
      return { success: false, error: 'DEPENDENCY_NOT_FOUND' };
    }

    if (dependency.status === DependencyStatus.FROZEN) {
      return {
        success: false,
        error: 'ALREADY_FROZEN',
        message: '依赖服务已冻结，幂等校验通过'
      };
    }

    if (changeOrder.status !== ChangeOrderStatus.DEPENDENCIES_FREEZING) {
      return {
        success: false,
        error: 'INVALID_STATUS',
        message: '变更单未处于冻结流程中'
      };
    }

    const now = new Date().toISOString();
    dependency.status = DependencyStatus.FROZEN;
    dependency.updatedAt = now;

    const allFrozen = changeOrder.dependencies.every(d => d.status === DependencyStatus.FROZEN);
    const newStatus = allFrozen ? ChangeOrderStatus.ALL_DEPENDENCIES_FROZEN : changeOrder.status;

    const updated = store.updateChangeOrder(id, {
      dependencies: changeOrder.dependencies,
      status: newStatus
    });

    store.addExecutionSummary(id, {
      operator: request.operator,
      action: 'FREEZE_DEPENDENCY',
      description: `冻结依赖服务: ${dependency.serviceName}`,
      originalInput: request,
      processingBasis: `依赖状态从 ${DependencyStatus.PENDING} 迁移到 ${DependencyStatus.FROZEN}${allFrozen ? ', 所有依赖已冻结' : ''}`
    });

    return { success: true, data: updated };
  }

  confirmDependency(id: string, dependencyId: string, request: ConfirmDependencyRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;
    const dependency = changeOrder.dependencies.find(d => d.id === dependencyId);

    if (!dependency) {
      return { success: false, error: 'DEPENDENCY_NOT_FOUND' };
    }

    if (dependency.status === DependencyStatus.CONFIRMED) {
      return {
        success: false,
        error: 'ALREADY_CONFIRMED',
        message: '依赖服务已确认，幂等校验通过'
      };
    }

    if (dependency.status !== DependencyStatus.FROZEN) {
      return {
        success: false,
        error: 'INVALID_STATUS',
        message: '依赖服务未冻结，无法确认'
      };
    }

    const now = new Date().toISOString();
    dependency.status = DependencyStatus.CONFIRMED;
    dependency.confirmer = request.operator;
    dependency.confirmedAt = now;
    dependency.updatedAt = now;

    const updated = store.updateChangeOrder(id, {
      dependencies: changeOrder.dependencies
    });

    store.addExecutionSummary(id, {
      operator: request.operator,
      action: 'CONFIRM_DEPENDENCY',
      description: `确认依赖服务冻结: ${dependency.serviceName}`,
      originalInput: request,
      processingBasis: `依赖状态从 ${DependencyStatus.FROZEN} 迁移到 ${DependencyStatus.CONFIRMED}`
    });

    return { success: true, data: updated };
  }

  delayDependency(id: string, dependencyId: string, request: DelayDependencyRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;
    const dependency = changeOrder.dependencies.find(d => d.id === dependencyId);

    if (!dependency) {
      return { success: false, error: 'DEPENDENCY_NOT_FOUND' };
    }

    if (dependency.status === DependencyStatus.CONFIRMED) {
      return {
        success: false,
        error: 'ALREADY_CONFIRMED',
        message: '依赖服务已确认，无法延期'
      };
    }

    const now = new Date().toISOString();
    const previousStatus = dependency.status;
    dependency.status = DependencyStatus.DELAYED;
    dependency.delayReason = request.reason;
    dependency.delayedAt = now;
    dependency.updatedAt = now;

    if (request.newFreezeWindowStart) {
      dependency.freezeWindowStart = request.newFreezeWindowStart;
    }
    if (request.newFreezeWindowEnd) {
      dependency.freezeWindowEnd = request.newFreezeWindowEnd;
    }

    const updated = store.updateChangeOrder(id, {
      dependencies: changeOrder.dependencies,
      status: ChangeOrderStatus.EXCEPTION
    });

    store.addExecutionSummary(id, {
      operator: request.operator,
      action: 'DELAY_DEPENDENCY',
      description: `延期依赖服务: ${dependency.serviceName}, 原因: ${request.reason}`,
      originalInput: request,
      processingBasis: `依赖状态从 ${previousStatus} 迁移到 ${DependencyStatus.DELAYED}, 变更单进入异常状态`
    });

    return { success: true, data: updated };
  }

  markException(id: string, request: ExceptionRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;

    if (changeOrder.status === ChangeOrderStatus.EXCEPTION) {
      return {
        success: false,
        error: 'ALREADY_IN_EXCEPTION',
        message: '变更单已处于异常状态，幂等校验通过'
      };
    }

    const now = new Date().toISOString();
    const updated = store.updateChangeOrder(id, {
      status: ChangeOrderStatus.EXCEPTION,
      exceptionReason: request.reason,
      exceptionAt: now
    });

    store.addExecutionSummary(id, {
      operator: request.operator,
      action: 'MARK_EXCEPTION',
      description: `标记变更单异常: ${request.reason}`,
      originalInput: request,
      processingBasis: `状态从 ${changeOrder.status} 迁移到 ${ChangeOrderStatus.EXCEPTION}`
    });

    return { success: true, data: updated };
  }

  manualCorrection(id: string, request: ManualCorrectionRequest): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;
    const now = new Date().toISOString();

    if (request.status) {
      changeOrder.status = request.status;
    }

    if (request.dependencies) {
      for (const depUpdate of request.dependencies) {
        const dependency = changeOrder.dependencies.find(d => d.id === depUpdate.id);
        if (dependency) {
          if (depUpdate.status) {
            dependency.status = depUpdate.status;
          }
          if (depUpdate.confirmer) {
            dependency.confirmer = depUpdate.confirmer;
          }
          dependency.updatedAt = now;
        }
      }
    }

    changeOrder.correctedBy = request.operator;
    changeOrder.correctedAt = now;

    const updated = store.updateChangeOrder(id, {
      status: changeOrder.status,
      dependencies: changeOrder.dependencies,
      correctedBy: changeOrder.correctedBy,
      correctedAt: changeOrder.correctedAt
    });

    store.addExecutionSummary(id, {
      operator: request.operator,
      action: 'MANUAL_CORRECTION',
      description: `人工修正变更单: ${request.reason}`,
      originalInput: request,
      processingBasis: `人工强制修正状态和依赖信息，修正原因: ${request.reason}`
    });

    return { success: true, data: updated };
  }

  exportChangeOrder(id: string): { success: boolean; data?: any; error?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;

    const exportData = {
      changeOrderNo: changeOrder.changeOrderNo,
      title: changeOrder.title,
      description: changeOrder.description,
      status: changeOrder.status,
      createdBy: changeOrder.createdBy,
      createdAt: changeOrder.createdAt,
      dependencySummary: changeOrder.dependencies.map(dep => ({
        serviceName: dep.serviceName,
        status: dep.status,
        freezeWindow: `${dep.freezeWindowStart} ~ ${dep.freezeWindowEnd}`,
        confirmer: dep.confirmer || '-',
        delayReason: dep.delayReason || '-',
        exceptionReason: dep.exceptionReason || '-'
      })),
      executionSummaries: changeOrder.executionSummaries.map(summary => ({
        timestamp: summary.timestamp,
        operator: summary.operator,
        action: summary.action,
        description: summary.description,
        processingBasis: summary.processingBasis
      })),
      exceptionInfo: changeOrder.exceptionReason ? {
        reason: changeOrder.exceptionReason,
        at: changeOrder.exceptionAt
      } : null,
      correctionInfo: changeOrder.correctedBy ? {
        correctedBy: changeOrder.correctedBy,
        correctedAt: changeOrder.correctedAt
      } : null
    };

    return { success: true, data: exportData };
  }

  approveChangeOrder(id: string, operator: string): { success: boolean; data?: ChangeOrder; error?: string; message?: string } {
    const result = this.getChangeOrderById(id);
    if (!result.success || !result.data) return result;

    const changeOrder = result.data;

    if (changeOrder.status === ChangeOrderStatus.APPROVED) {
      return {
        success: false,
        error: 'ALREADY_APPROVED',
        message: '变更单已审批，幂等校验通过'
      };
    }

    if (changeOrder.status !== ChangeOrderStatus.ALL_DEPENDENCIES_FROZEN) {
      return {
        success: false,
        error: 'INVALID_STATUS',
        message: '所有依赖未冻结完成，无法审批'
      };
    }

    const updated = store.updateChangeOrder(id, {
      status: ChangeOrderStatus.APPROVED
    });

    store.addExecutionSummary(id, {
      operator,
      action: 'APPROVE_CHANGE_ORDER',
      description: '审批通过变更单',
      originalInput: { operator },
      processingBasis: `状态从 ${changeOrder.status} 迁移到 ${ChangeOrderStatus.APPROVED}`
    });

    return { success: true, data: updated };
  }
}

export const service = new ChangeOrderService();
