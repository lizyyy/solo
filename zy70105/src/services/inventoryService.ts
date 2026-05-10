import {
  PesticideInventory,
  InventoryUnit,
  Requisition,
  BaseEntity
} from '../types';
import { store } from '../dataStore/inMemoryStore';
import {
  NotFoundError,
  ValidationError,
  InsufficientInventoryError,
  ApprovalFlowError
} from '../utils/errors';
import { LoggerContext, createLoggerContext } from '../utils/logger';

interface DeductInventoryRequest {
  requisitionId: string;
  operatorId: string;
  operatorName: string;
}

interface InventoryDeductionResult {
  success: boolean;
  deductions: {
    inventoryId: string;
    pesticideName: string;
    deductedQuantity: number;
    remainingQuantity: number;
  }[];
  errors: string[];
}

class InventoryService {
  private logger: LoggerContext;

  constructor(logger?: LoggerContext) {
    this.logger = logger || createLoggerContext();
    this.logger.addContext('service', 'InventoryService');
  }

  async createInventory(
    data: Omit<PesticideInventory, keyof BaseEntity>
  ): Promise<PesticideInventory> {
    this.logger.info('Creating inventory', { ...data });

    if (data.quantity <= 0) {
      throw new ValidationError('入库数量必须大于0');
    }

    const pesticide = store.pesticidesStore().findById(data.pesticideId);
    if (!pesticide) {
      throw new NotFoundError('Pesticide', data.pesticideId);
    }

    const inventory = store.inventoriesStore().create({
      pesticideId: data.pesticideId,
      batchNumber: data.batchNumber,
      quantity: data.quantity,
      unit: data.unit,
      expiryDate: data.expiryDate,
      warehouse: data.warehouse,
      inboundDate: data.inboundDate,
      supplier: data.supplier
    });
    this.logger.info('Inventory created', { inventoryId: inventory.id });
    return inventory;
  }

  async getByPesticideId(pesticideId: string): Promise<PesticideInventory[]> {
    this.logger.debug('Getting inventory by pesticide id', { pesticideId });
    return store.inventoriesStore().findByPesticideId(pesticideId);
  }

  async getTotalQuantity(pesticideId: string): Promise<number> {
    this.logger.debug('Getting total inventory quantity', { pesticideId });
    return store.inventoriesStore().getTotalByPesticideId(pesticideId);
  }

  async deductInventory(
    request: DeductInventoryRequest
  ): Promise<InventoryDeductionResult> {
    this.logger.info('Deducting inventory for requisition', {
      requisitionId: request.requisitionId
    });

    const result: InventoryDeductionResult = {
      success: true,
      deductions: [],
      errors: []
    };

    const requisition = store.requisitionsStore().findById(request.requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', request.requisitionId);
    }

    if (requisition.status !== 'APPROVED' && 
        requisition.status !== 'FULFILLED' && 
        requisition.currentStage !== 'FINAL_APPROVAL') {
      throw new ApprovalFlowError('仅已审批通过的领用单可扣减库存');
    }

    const items = store.requisitionItemsStore().findByRequisitionId(request.requisitionId);

    for (const item of items) {
      const available = await this.getTotalQuantity(item.pesticideId);
      
      if (available < item.quantity) {
        result.errors.push(
          `农药 ${item.pesticideName} 库存不足。需求: ${item.quantity} ${item.unit}, 可用: ${available} ${item.unit}`
        );
        result.success = false;
        continue;
      }

      const deductionResult = await this.deductFromInventories(
        item.pesticideId,
        item.quantity,
        item.pesticideName,
        item.unit
      );

      if (!deductionResult.success) {
        result.errors.push(...deductionResult.errors);
        result.success = false;
      } else {
        result.deductions.push(...deductionResult.deductions);
      }
    }

    if (result.success) {
      store.requisitionsStore().update(request.requisitionId, {
        status: 'FULFILLED',
        currentStage: 'COMPLETED',
        lastProcessedById: request.operatorId,
        lastProcessedAt: new Date()
      });

      this.logger.info('Inventory deducted successfully', {
        requisitionId: request.requisitionId,
        deductionCount: result.deductions.length
      });
    } else {
      this.logger.warn('Inventory deduction failed', {
        requisitionId: request.requisitionId,
        errorCount: result.errors.length
      });
    }

    return result;
  }

  private async deductFromInventories(
    pesticideId: string,
    requiredQuantity: number,
    pesticideName: string,
    unit: InventoryUnit
  ): Promise<InventoryDeductionResult> {
    const result: InventoryDeductionResult = {
      success: true,
      deductions: [],
      errors: []
    };

    let remainingToDeduct = requiredQuantity;
    const inventories = store.inventoriesStore().findByPesticideId(pesticideId)
      .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    for (const inventory of inventories) {
      if (remainingToDeduct <= 0) break;

      const deductAmount = Math.min(inventory.quantity, remainingToDeduct);
      const newQuantity = inventory.quantity - deductAmount;

      store.inventoriesStore().update(inventory.id, {
        quantity: newQuantity
      });

      result.deductions.push({
        inventoryId: inventory.id,
        pesticideName,
        deductedQuantity: deductAmount,
        remainingQuantity: newQuantity
      });

      remainingToDeduct -= deductAmount;
    }

    if (remainingToDeduct > 0) {
      result.success = false;
      result.errors.push(
        `农药 ${pesticideName} 库存扣减失败，仍需 ${remainingToDeduct} ${unit}`
      );
    }

    return result;
  }

  async checkAvailability(
    pesticideId: string,
    requiredQuantity: number
  ): Promise<{ available: boolean; availableQuantity: number; shortfall: number }> {
    this.logger.debug('Checking inventory availability', { pesticideId, requiredQuantity });

    const availableQuantity = await this.getTotalQuantity(pesticideId);
    const shortfall = Math.max(0, requiredQuantity - availableQuantity);

    return {
      available: shortfall === 0,
      availableQuantity,
      shortfall
    };
  }

  async getAll(): Promise<PesticideInventory[]> {
    this.logger.debug('Getting all inventories');
    return store.inventoriesStore().findAll();
  }
}

export const inventoryService = new InventoryService();
export { DeductInventoryRequest, InventoryDeductionResult };
