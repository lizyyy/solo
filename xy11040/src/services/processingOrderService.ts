import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingOrder,
  ProcessingOrderStatus,
  LensPrescription,
  LensSpecification
} from '../types';
import { dataStore } from '../store/dataStore';
import { stateMachineService } from './stateMachine';
import { axisConsistencyChecker } from './axisConsistencyChecker';

export interface CreateProcessingOrderRequest {
  customerName: string;
  customerPhone: string;
  frameModel: string;
  frameColor: string;
  odPrescription: LensPrescription;
  osPrescription: LensPrescription;
  lensSpec: LensSpecification;
  createdBy: string;
  notes?: string;
}

export interface UpdateProcessingOrderStatusRequest {
  processingOrderId: string;
  targetStatus: ProcessingOrderStatus;
  performedBy: string;
  userRole: string;
  assignedTechnician?: string;
}

export class ProcessingOrderService {
  createProcessingOrder(request: CreateProcessingOrderRequest): {
    success: boolean;
    message: string;
    data?: ProcessingOrder;
  } {
    if (!axisConsistencyChecker.validateAxisValue(request.odPrescription.axis)) {
      return {
        success: false,
        message: `右眼轴位 ${request.odPrescription.axis} 无效，必须是 0-180 之间的整数`
      };
    }

    if (!axisConsistencyChecker.validateAxisValue(request.osPrescription.axis)) {
      return {
        success: false,
        message: `左眼轴位 ${request.osPrescription.axis} 无效，必须是 0-180 之间的整数`
      };
    }

    const orderNumber = this.generateOrderNumber();

    const processingOrder: ProcessingOrder = {
      id: uuidv4(),
      orderNumber,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      frameModel: request.frameModel,
      frameColor: request.frameColor,
      odPrescription: request.odPrescription,
      osPrescription: request.osPrescription,
      lensSpec: request.lensSpec,
      status: ProcessingOrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: request.createdBy,
      notes: request.notes,
      reworkCount: 0,
      auditTrail: [
        stateMachineService.createAuditEntry(
          'create_order',
          request.createdBy,
          undefined,
          ProcessingOrderStatus.PENDING
        )
      ]
    };

    dataStore.saveProcessingOrder(processingOrder);

    return {
      success: true,
      message: `加工单 ${orderNumber} 创建成功`,
      data: processingOrder
    };
  }

  updateProcessingOrderStatus(request: UpdateProcessingOrderStatusRequest): {
    success: boolean;
    message: string;
    data?: ProcessingOrder;
    availableTransitions?: any[];
  } {
    const processingOrder = dataStore.getProcessingOrder(request.processingOrderId);

    if (!processingOrder) {
      return {
        success: false,
        message: '加工单不存在'
      };
    }

    const transitionCheck = stateMachineService.canTransitionProcessingOrder(
      processingOrder.status,
      request.targetStatus,
      request.userRole
    );

    if (!transitionCheck.allowed) {
      const availableTransitions = stateMachineService.getAvailableProcessingOrderTransitions(
        processingOrder.status,
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

    const oldStatus = processingOrder.status;
    processingOrder.status = request.targetStatus;

    if (request.assignedTechnician) {
      processingOrder.assignedTechnician = request.assignedTechnician;
    }

    processingOrder.updatedAt = new Date();
    processingOrder.auditTrail.push(
      stateMachineService.createAuditEntry(
        'status_change',
        request.performedBy,
        oldStatus,
        request.targetStatus
      )
    );

    dataStore.saveProcessingOrder(processingOrder);

    return {
      success: true,
      message: `状态已更新为 ${request.targetStatus}`,
      data: processingOrder
    };
  }

  getProcessingOrder(id: string) {
    return dataStore.getProcessingOrder(id);
  }

  getProcessingOrderByNumber(orderNumber: string) {
    return dataStore.getProcessingOrderByNumber(orderNumber);
  }

  getAllProcessingOrders() {
    return dataStore.getAllProcessingOrders();
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PO${dateStr}${random}`;
  }
}

export const processingOrderService = new ProcessingOrderService();
