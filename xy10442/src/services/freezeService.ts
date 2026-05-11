import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { Freeze, Unfreeze } from '../types';

export class FreezeService {
  createFreeze(
    batchId: string,
    quantity: number,
    reason: string,
    operatorId: string
  ): Freeze {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    if (batch.status === 'disposed') {
      throw new Error('已处置批次不能冻结');
    }

    if (quantity <= 0) {
      throw new Error('冻结数量必须大于0');
    }

    if (quantity > batch.availableQuantity) {
      throw new Error(
        `冻结数量 ${quantity} 超过可用数量 ${batch.availableQuantity}`
      );
    }

    const freeze: Freeze = {
      id: uuidv4(),
      batchId,
      quantity,
      reason,
      freezeDate: new Date(),
      operatorId,
      isActive: true,
      createdAt: new Date()
    };

    dataStore.addFreeze(freeze);

    dataStore.updateBatch({
      ...batch,
      availableQuantity: batch.availableQuantity - quantity,
      frozenQuantity: batch.frozenQuantity + quantity,
      status: batch.frozenQuantity + quantity > 0 ? 'frozen' : 'active'
    });

    return freeze;
  }

  createUnfreeze(
    freezeId: string,
    quantity: number,
    operatorId: string
  ): Unfreeze {
    const freeze = dataStore.getFreezeById(freezeId);
    if (!freeze) {
      throw new Error(`冻结记录 ${freezeId} 不存在`);
    }

    if (!freeze.isActive) {
      throw new Error('该冻结记录已解冻');
    }

    const batch = dataStore.getBatchById(freeze.batchId);
    if (!batch) {
      throw new Error(`批次 ${freeze.batchId} 不存在`);
    }

    if (quantity <= 0) {
      throw new Error('解冻数量必须大于0');
    }

    if (quantity > freeze.quantity) {
      throw new Error(
        `解冻数量 ${quantity} 超过冻结数量 ${freeze.quantity}`
      );
    }

    if (quantity > batch.frozenQuantity) {
      throw new Error(
        `解冻数量 ${quantity} 超过批次冻结数量 ${batch.frozenQuantity}`
      );
    }

    const unfreeze: Unfreeze = {
      id: uuidv4(),
      freezeId,
      batchId: freeze.batchId,
      quantity,
      unfreezeDate: new Date(),
      operatorId,
      createdAt: new Date()
    };

    dataStore.addUnfreeze(unfreeze);

    if (quantity === freeze.quantity) {
      dataStore.updateFreeze({ ...freeze, isActive: false });
    }

    const newFrozenQuantity = batch.frozenQuantity - quantity;
    dataStore.updateBatch({
      ...batch,
      availableQuantity: batch.availableQuantity + quantity,
      frozenQuantity: newFrozenQuantity,
      status: newFrozenQuantity > 0 ? 'frozen' : 'active'
    });

    return unfreeze;
  }

  getActiveFreezesByBatchId(batchId: string): Freeze[] {
    return dataStore.getActiveFreezesByBatchId(batchId);
  }
}

export const freezeService = new FreezeService();
