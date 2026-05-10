import {
  Requisition,
  RequisitionItem,
  ApprovalRecord,
  InventoryUnit
} from '../types';
import { store } from '../dataStore/inMemoryStore';
import {
  NotFoundError,
  ValidationError,
  ApprovalFlowError
} from '../utils/errors';
import { LoggerContext, createLoggerContext } from '../utils/logger';
import { approvalFlowService, ApprovalContext } from './approvalFlowService';

interface CreateRequisitionRequest {
  applicantId: string;
  applicantName: string;
  department: string;
  intendedUseDate: Date;
}

interface CreateRequisitionItemRequest {
  pesticideId: string;
  quantity: number;
  unit: InventoryUnit;
  usagePurpose: string;
  dosagePerUnitArea: string;
  plotId: string;
  applicationMethod: string;
  expectedApplicationDate: Date;
}

interface RequisitionDetail extends Requisition {
  items: RequisitionItem[];
  approvalRecords: ApprovalRecord[];
}

class RequisitionService {
  private logger: LoggerContext;

  constructor(logger?: LoggerContext) {
    this.logger = logger || createLoggerContext();
    this.logger.addContext('service', 'RequisitionService');
  }

  async createRequisition(
    request: CreateRequisitionRequest
  ): Promise<Requisition> {
    this.logger.info('Creating requisition', { ...request });

    this.validateCreateRequest(request);

    const requisition = store.requisitionsStore().create({
      applicantId: request.applicantId,
      applicantName: request.applicantName,
      department: request.department,
      intendedUseDate: request.intendedUseDate,
      status: 'DRAFT',
      currentStage: 'DRAFT',
      totalItems: 0,
      totalQuantity: 0,
      rejectionReason: null,
      lastProcessedById: null,
      lastProcessedAt: null
    });

    this.logger.info('Requisition created', { requisitionId: requisition.id });
    return requisition;
  }

  private validateCreateRequest(request: CreateRequisitionRequest): void {
    if (!request.applicantId?.trim()) {
      throw new ValidationError('申请人ID不能为空');
    }
    if (!request.applicantName?.trim()) {
      throw new ValidationError('申请人姓名不能为空');
    }
    if (!request.department?.trim()) {
      throw new ValidationError('部门不能为空');
    }
    if (!(request.intendedUseDate instanceof Date) || isNaN(request.intendedUseDate.getTime())) {
      throw new ValidationError('预计使用日期无效');
    }
  }

  async addItem(
    requisitionId: string,
    request: CreateRequisitionItemRequest
  ): Promise<RequisitionItem> {
    this.logger.info('Adding item to requisition', { requisitionId, ...request });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    if (requisition.status !== 'DRAFT') {
      throw new ApprovalFlowError('仅草稿状态的领用单可添加条目');
    }

    await this.validateItemRequest(request);

    const pesticide = store.pesticidesStore().findById(request.pesticideId);
    if (!pesticide) {
      throw new NotFoundError('Pesticide', request.pesticideId);
    }

    const plot = store.plotsStore().findById(request.plotId);
    if (!plot) {
      throw new NotFoundError('Plot', request.plotId);
    }

    const cropId = plot.currentCropId;
    const crop = cropId ? store.cropsStore().findById(cropId) : null;

    const item = store.requisitionItemsStore().create({
      requisitionId,
      pesticideId: request.pesticideId,
      pesticideName: pesticide.name,
      quantity: request.quantity,
      unit: request.unit,
      usagePurpose: request.usagePurpose,
      dosagePerUnitArea: request.dosagePerUnitArea,
      plotId: request.plotId,
      plotName: plot.name,
      cropId: cropId || '',
      cropName: crop?.name || '未指定',
      applicationMethod: request.applicationMethod,
      expectedApplicationDate: request.expectedApplicationDate
    });

    const existingItems = store.requisitionItemsStore().findByRequisitionId(requisitionId);
    const totalItems = existingItems.length;
    const totalQuantity = existingItems.reduce((sum, i) => sum + i.quantity, 0);

    store.requisitionsStore().update(requisitionId, {
      totalItems,
      totalQuantity
    });

    this.logger.info('Item added', { requisitionId, itemId: item.id });
    return item;
  }

  private async validateItemRequest(request: CreateRequisitionItemRequest): Promise<void> {
    if (request.quantity <= 0) {
      throw new ValidationError('数量必须大于0');
    }
    if (!request.usagePurpose?.trim()) {
      throw new ValidationError('使用目的不能为空');
    }
    if (!request.dosagePerUnitArea?.trim()) {
      throw new ValidationError('单位面积用量不能为空');
    }
    if (!request.applicationMethod?.trim()) {
      throw new ValidationError('施用方式不能为空');
    }
    if (!(request.expectedApplicationDate instanceof Date) || isNaN(request.expectedApplicationDate.getTime())) {
      throw new ValidationError('预计施用日期无效');
    }
  }

  async removeItem(requisitionId: string, itemId: string): Promise<void> {
    this.logger.info('Removing item from requisition', { requisitionId, itemId });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    if (requisition.status !== 'DRAFT') {
      throw new ApprovalFlowError('仅草稿状态的领用单可删除条目');
    }

    const item = store.requisitionItemsStore().findById(itemId);
    if (!item) {
      throw new NotFoundError('RequisitionItem', itemId);
    }

    if (item.requisitionId !== requisitionId) {
      throw new ValidationError('条目不属于该领用单');
    }

    store.requisitionItemsStore().update(itemId, { isDeleted: true });

    const existingItems = store.requisitionItemsStore().findByRequisitionId(requisitionId);
    const totalItems = existingItems.filter(i => !i.isDeleted).length;
    const totalQuantity = existingItems
      .filter(i => !i.isDeleted)
      .reduce((sum, i) => sum + i.quantity, 0);

    store.requisitionsStore().update(requisitionId, {
      totalItems,
      totalQuantity
    });

    this.logger.info('Item removed', { requisitionId, itemId });
  }

  async getById(id: string): Promise<RequisitionDetail> {
    this.logger.debug('Getting requisition by id', { id });

    const requisition = store.requisitionsStore().findById(id);
    if (!requisition) {
      throw new NotFoundError('Requisition', id);
    }

    const items = store.requisitionItemsStore().findByRequisitionId(id);
    const approvalRecords = store.approvalRecordsStore().findByRequisitionId(id);

    return {
      ...requisition,
      items,
      approvalRecords
    };
  }

  async getByNumber(number: string): Promise<RequisitionDetail> {
    this.logger.debug('Getting requisition by number', { number });

    const requisition = store.requisitionsStore().findByNumber(number);
    if (!requisition) {
      throw new NotFoundError('Requisition', number);
    }

    return this.getById(requisition.id);
  }

  async getAll(): Promise<Requisition[]> {
    this.logger.debug('Getting all requisitions');
    return store.requisitionsStore().findAll();
  }

  async submit(requisitionId: string, context: ApprovalContext): Promise<RequisitionDetail> {
    this.logger.info('Submitting requisition', { requisitionId });

    const { requisition } = await approvalFlowService.submitRequisition(requisitionId, context);
    return this.getById(requisition.id);
  }

  async cancel(requisitionId: string, context: ApprovalContext): Promise<RequisitionDetail> {
    this.logger.info('Cancelling requisition', { requisitionId });

    const { requisition } = await approvalFlowService.cancelRequisition(requisitionId, context);
    return this.getById(requisition.id);
  }

  async getItems(requisitionId: string): Promise<RequisitionItem[]> {
    this.logger.debug('Getting requisition items', { requisitionId });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    return store.requisitionItemsStore().findByRequisitionId(requisitionId);
  }
}

export const requisitionService = new RequisitionService();
export { CreateRequisitionRequest, CreateRequisitionItemRequest, RequisitionDetail };
