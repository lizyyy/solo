import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { InventoryLoss, Disposal } from '../types';

export class InventoryService {
  createInventoryLoss(
    batchId: string,
    quantity: number,
    reason: string,
    operatorId: string
  ): InventoryLoss {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    if (batch.status === 'disposed') {
      throw new Error('已处置批次不能盘亏');
    }

    if (quantity <= 0) {
      throw new Error('盘亏数量必须大于0');
    }

    const availableForLoss = batch.availableQuantity + batch.frozenQuantity;
    if (quantity > availableForLoss) {
      throw new Error(
        `盘亏数量 ${quantity} 超过库存总量 ${availableForLoss}`
      );
    }

    let remainingLoss = quantity;
    let newAvailableQuantity = batch.availableQuantity;
    let newFrozenQuantity = batch.frozenQuantity;

    if (remainingLoss <= batch.availableQuantity) {
      newAvailableQuantity = batch.availableQuantity - remainingLoss;
      remainingLoss = 0;
    } else {
      remainingLoss -= batch.availableQuantity;
      newAvailableQuantity = 0;
      newFrozenQuantity = batch.frozenQuantity - remainingLoss;
    }

    const loss: InventoryLoss = {
      id: uuidv4(),
      batchId,
      quantity,
      reason,
      lossDate: new Date(),
      operatorId,
      createdAt: new Date()
    };

    dataStore.addInventoryLoss(loss);

    const newTotal = newAvailableQuantity + newFrozenQuantity;
    if (newTotal <= 0) {
      dataStore.updateBatch({
        ...batch,
        availableQuantity: 0,
        frozenQuantity: 0,
        quantity: 0,
        status: 'disposed'
      });
      dataStore.resolveAlertsForBatch(batchId);
    } else {
      dataStore.updateBatch({
        ...batch,
        availableQuantity: newAvailableQuantity,
        frozenQuantity: newFrozenQuantity,
        quantity: newTotal,
        status: newFrozenQuantity > 0 ? 'frozen' : 'active'
      });
    }

    return loss;
  }

  createDisposal(
    batchId: string,
    quantity: number,
    reason: string,
    operatorId: string
  ): Disposal {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    if (batch.status === 'disposed') {
      throw new Error('该批次已处置，不能重复处置');
    }

    if (dataStore.hasDisposalForBatch(batchId)) {
      throw new Error('该批次已有处置记录，不能重复提交');
    }

    if (quantity <= 0) {
      throw new Error('处置数量必须大于0');
    }

    const totalQuantity = batch.availableQuantity + batch.frozenQuantity;
    if (quantity > totalQuantity) {
      throw new Error(
        `处置数量 ${quantity} 超过库存总量 ${totalQuantity}`
      );
    }

    const disposal: Disposal = {
      id: uuidv4(),
      batchId,
      quantity,
      reason,
      disposalDate: new Date(),
      operatorId,
      createdAt: new Date()
    };

    dataStore.addDisposal(disposal);

    const remainingQuantity = totalQuantity - quantity;
    if (remainingQuantity <= 0) {
      dataStore.updateBatch({
        ...batch,
        availableQuantity: 0,
        frozenQuantity: 0,
        quantity: 0,
        status: 'disposed'
      });
    } else {
      dataStore.updateBatch({
        ...batch,
        availableQuantity: Math.max(
          0,
          batch.availableQuantity - quantity
        ),
        frozenQuantity: Math.max(
          0,
          batch.frozenQuantity - Math.max(0, quantity - batch.availableQuantity)
        ),
        quantity: remainingQuantity,
        status: batch.frozenQuantity > 0 ? 'frozen' : 'active'
      });
    }

    dataStore.resolveAlertsForBatch(batchId);

    return disposal;
  }

  getInventoryLossesByBatchId(batchId: string): InventoryLoss[] {
    return dataStore.getInventoryLossesByBatchId(batchId);
  }

  getDisposalsByBatchId(batchId: string): Disposal[] {
    return dataStore.getDisposalsByBatchId(batchId);
  }
}

export const inventoryService = new InventoryService();
