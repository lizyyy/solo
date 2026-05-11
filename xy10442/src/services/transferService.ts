import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { Transfer } from '../types';

export class TransferService {
  createTransfer(
    batchId: string,
    toWarehouseId: string,
    quantity: number,
    operatorId: string
  ): Transfer {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    if (batch.status === 'disposed') {
      throw new Error('已处置批次不能调拨');
    }

    if (batch.frozenQuantity > 0) {
      throw new Error(`批次 ${batch.batchNumber} 存在冻结库存，不能调拨`);
    }

    const toWarehouse = dataStore.getWarehouseById(toWarehouseId);
    if (!toWarehouse) {
      throw new Error(`目标仓库 ${toWarehouseId} 不存在`);
    }

    if (quantity <= 0) {
      throw new Error('调拨数量必须大于0');
    }

    if (quantity > batch.availableQuantity) {
      throw new Error(
        `调拨数量 ${quantity} 超过可用数量 ${batch.availableQuantity}`
      );
    }

    const transfer: Transfer = {
      id: uuidv4(),
      batchId,
      fromWarehouseId: batch.warehouseId,
      toWarehouseId,
      quantity,
      transferDate: new Date(),
      operatorId,
      createdAt: new Date()
    };

    dataStore.addTransfer(transfer);

    const remainingQuantity = batch.availableQuantity - quantity;
    if (remainingQuantity <= 0) {
      dataStore.updateBatch({
        ...batch,
        warehouseId: toWarehouseId,
        availableQuantity: quantity,
        quantity: quantity,
        updatedAt: new Date()
      });
    } else {
      const newBatchId = uuidv4();
      dataStore.updateBatch({
        ...batch,
        quantity: remainingQuantity,
        availableQuantity: remainingQuantity,
        updatedAt: new Date()
      });

      const newBatch = {
        id: newBatchId,
        batchNumber: `${batch.batchNumber}-T${Date.now()}`,
        productId: batch.productId,
        warehouseId: toWarehouseId,
        quantity,
        availableQuantity: quantity,
        frozenQuantity: 0,
        inDate: batch.inDate,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      dataStore.addBatch(newBatch);
    }

    return transfer;
  }

  getTransfersByBatchId(batchId: string): Transfer[] {
    return dataStore.getTransfersByBatchId(batchId);
  }
}

export const transferService = new TransferService();
