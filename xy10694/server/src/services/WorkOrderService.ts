import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import WorkOrder, { WorkOrderStatus, WorkOrderScene } from '../models/WorkOrder';
import OperationLog, { OperationType } from '../models/OperationLog';
import FollowUp, { FollowUpResult } from '../models/FollowUp';
import ResidentAddressService from './ResidentAddressService';
import ProblemTypeService from './ProblemTypeService';
import GridWorkerService from './GridWorkerService';
import ResponsibleUnitService from './ResponsibleUnitService';

interface CreateWorkOrderParams {
  residentName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  street: string;
  community: string;
  building?: string;
  unit?: string;
  room?: string;
  gridCode: string;
  problemTypeId: string;
  description: string;
  isUrgent?: boolean;
  operatorId: string;
  operatorName: string;
}

interface ProcessWorkOrderParams {
  orderId: string;
  operatorId: string;
  operatorName: string;
  description?: string;
}

interface CompleteWorkOrderParams {
  orderId: string;
  operatorId: string;
  operatorName: string;
  completionNote?: string;
}

interface ReviewWorkOrderParams {
  orderId: string;
  operatorId: string;
  operatorName: string;
  approved: boolean;
  comment?: string;
}

class WorkOrderService {
  private generateOrderNo(): string {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `WO${timestamp}${random}`;
  }

  async checkDuplicate(residentAddressId: string, problemTypeId: string, description: string): Promise<boolean> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existingOrders = await WorkOrder.findAll({
      where: {
        residentAddressId,
        problemTypeId,
        createdAt: {
          [Op.gte]: twentyFourHoursAgo
        }
      }
    });

    for (const order of existingOrders) {
      const similarity = this.calculateSimilarity(order.description, description);
      if (similarity > 0.7) {
        return true;
      }
    }

    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().replace(/\s/g, '');
    const s2 = str2.toLowerCase().replace(/\s/g, '');
    
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    let matches = 0;
    for (const char of s1) {
      if (s2.includes(char)) matches++;
    }

    return matches / Math.max(s1.length, s2.length);
  }

  async createWorkOrder(params: CreateWorkOrderParams): Promise<{
    success: boolean;
    order?: WorkOrder;
    scene: WorkOrderScene;
    reason?: string;
  }> {
    const { operatorId, operatorName, ...data } = params;

    const problemValidation = await ProblemTypeService.validateProblemType(data.problemTypeId);
    if (!problemValidation.valid) {
      return { success: false, scene: WorkOrderScene.BLOCKED, reason: problemValidation.reason };
    }

    const address = await ResidentAddressService.createAddress({
      residentName: data.residentName,
      phone: data.phone,
      province: data.province,
      city: data.city,
      district: data.district,
      street: data.street,
      community: data.community,
      building: data.building,
      unit: data.unit,
      room: data.room,
      gridCode: data.gridCode,
      operatorId,
      operatorName
    });

    const gridWorker = await GridWorkerService.getGridWorkerByGridCode(data.gridCode);
    if (!gridWorker) {
      return { success: false, scene: WorkOrderScene.BLOCKED, reason: '该网格未配置网格员，需要人工介入' };
    }

    const isDuplicate = await this.checkDuplicate(address.id, data.problemTypeId, data.description);
    if (isDuplicate) {
      return { success: false, scene: WorkOrderScene.DUPLICATE, reason: '24小时内存在相似报事，请核实是否重复提交' };
    }

    const blockCheck = await ResponsibleUnitService.checkBlockRule(data.problemTypeId);
    if (blockCheck.blocked) {
      const order = await WorkOrder.create({
        id: uuidv4(),
        orderNo: this.generateOrderNo(),
        residentAddressId: address.id,
        problemTypeId: data.problemTypeId,
        gridWorkerId: gridWorker.id,
        responsibleUnitId: null,
        description: data.description,
        status: WorkOrderStatus.BLOCKED,
        scene: WorkOrderScene.BLOCKED,
        priority: problemValidation.problemType?.priority || 1,
        isUrgent: data.isUrgent || false,
        blockerReason: blockCheck.reason
      });

      await OperationLog.create({
        id: uuidv4(),
        workOrderId: order.id,
        operationType: OperationType.BLOCK,
        operatorId,
        operatorName,
        description: `工单被系统拦截: ${blockCheck.reason}`
      });

      return { success: true, order, scene: WorkOrderScene.BLOCKED };
    }

    const needsReview = this.needsManualReview(data);
    if (needsReview) {
      const order = await WorkOrder.create({
        id: uuidv4(),
        orderNo: this.generateOrderNo(),
        residentAddressId: address.id,
        problemTypeId: data.problemTypeId,
        gridWorkerId: gridWorker.id,
        responsibleUnitId: blockCheck.responsibleUnit?.id || null,
        description: data.description,
        status: WorkOrderStatus.REVIEWING,
        scene: WorkOrderScene.REVIEW,
        priority: problemValidation.problemType?.priority || 1,
        isUrgent: data.isUrgent || false
      });

      await OperationLog.create({
        id: uuidv4(),
        workOrderId: order.id,
        operationType: OperationType.REVIEW,
        operatorId,
        operatorName,
        description: '工单进入人工复核流程'
      });

      return { success: true, order, scene: WorkOrderScene.REVIEW };
    }

    const order = await WorkOrder.create({
      id: uuidv4(),
      orderNo: this.generateOrderNo(),
      residentAddressId: address.id,
      problemTypeId: data.problemTypeId,
      gridWorkerId: gridWorker.id,
      responsibleUnitId: blockCheck.responsibleUnit?.id || null,
      description: data.description,
      status: WorkOrderStatus.ASSIGNED,
      scene: WorkOrderScene.NORMAL,
      priority: problemValidation.problemType?.priority || 1,
      isUrgent: data.isUrgent || false
    });

    await OperationLog.create({
      id: uuidv4(),
      workOrderId: order.id,
      operationType: OperationType.CREATE,
      operatorId,
      operatorName,
      description: '工单创建成功并已分派'
    });

    return { success: true, order, scene: WorkOrderScene.NORMAL };
  }

  private needsManualReview(data: CreateWorkOrderParams): boolean {
    if (data.isUrgent) return true;

    const sensitiveKeywords = ['投诉', '举报', '危险', '安全', '紧急', '隐患'];
    for (const keyword of sensitiveKeywords) {
      if (data.description.includes(keyword)) return true;
    }

    return false;
  }

  async processWorkOrder(params: ProcessWorkOrderParams): Promise<WorkOrder | null> {
    const order = await WorkOrder.findByPk(params.orderId);
    if (!order) return null;

    await order.update({
      status: WorkOrderStatus.PROCESSING,
      processedAt: new Date()
    });

    await OperationLog.create({
      id: uuidv4(),
      workOrderId: order.id,
      operationType: OperationType.PROCESS,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      description: params.description || '开始处理工单'
    });

    return order;
  }

  async completeWorkOrder(params: CompleteWorkOrderParams): Promise<WorkOrder | null> {
    const order = await WorkOrder.findByPk(params.orderId);
    if (!order) return null;

    await order.update({
      status: WorkOrderStatus.COMPLETED,
      completedAt: new Date()
    });

    await OperationLog.create({
      id: uuidv4(),
      workOrderId: order.id,
      operationType: OperationType.COMPLETE,
      operatorId: params.operatorId,
      operatorName: params.operatorName,
      description: params.completionNote || '工单已完成'
    });

    return order;
  }

  async reviewWorkOrder(params: ReviewWorkOrderParams): Promise<WorkOrder | null> {
    const order = await WorkOrder.findByPk(params.orderId);
    if (!order) return null;

    if (params.approved) {
      await order.update({
        status: WorkOrderStatus.ASSIGNED,
        reviewerId: params.operatorId,
        reviewerComment: params.comment
      });

      await OperationLog.create({
        id: uuidv4(),
        workOrderId: order.id,
        operationType: OperationType.REVIEW,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        description: `复核通过: ${params.comment || '无'}`
      });
    } else {
      await order.update({
        status: WorkOrderStatus.REJECTED,
        reviewerId: params.operatorId,
        reviewerComment: params.comment
      });

      await OperationLog.create({
        id: uuidv4(),
        workOrderId: order.id,
        operationType: OperationType.REVIEW,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        description: `复核拒绝: ${params.comment || '无'}`
      });
    }

    return order;
  }

  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    return await WorkOrder.findByPk(id);
  }

  async getWorkOrderList(params: {
    page?: number;
    pageSize?: number;
    status?: WorkOrderStatus;
    scene?: WorkOrderScene;
    gridWorkerId?: string;
    responsibleUnitId?: string;
  }): Promise<{ list: WorkOrder[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.scene) where.scene = filters.scene;
    if (filters.gridWorkerId) where.gridWorkerId = filters.gridWorkerId;
    if (filters.responsibleUnitId) where.responsibleUnitId = filters.responsibleUnitId;

    const { count, rows } = await WorkOrder.findAndCountAll({
      where,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['createdAt', 'DESC']]
    });

    return { list: rows, total: count };
  }

  async getDissatisfactionStats(startDate?: Date, endDate?: Date): Promise<any> {
    const where: any = {
      result: FollowUpResult.DISSATISFIED
    };

    if (startDate && endDate) {
      where.followUpTime = {
        [Op.between]: [startDate, endDate]
      };
    }

    const followUps = await FollowUp.findAll({ where, include: [{ model: WorkOrder, as: 'workOrder' }] });

    const reasons: { [key: string]: number } = {};
    for (const fu of followUps) {
      const reason = fu.dissatisfactionReason || '未注明原因';
      reasons[reason] = (reasons[reason] || 0) + 1;
    }

    return {
      total: followUps.length,
      byReason: reasons,
      details: followUps
    };
  }

  async getOperationLogs(orderId: string): Promise<OperationLog[]> {
    return await OperationLog.findAll({
      where: { workOrderId: orderId },
      order: [['createdAt', 'ASC']]
    });
  }
}

export default new WorkOrderService();
