import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { Batch, BatchStatus, AlertLevel } from '../types';

export class BatchService {
  createBatch(
    batchNumber: string,
    productId: string,
    warehouseId: string,
    quantity: number,
    inDate: Date
  ): Batch {
    const existing = dataStore.getBatchByNumber(batchNumber);
    if (existing) {
      throw new Error(`批次 ${batchNumber} 已存在`);
    }

    const product = dataStore.getProductById(productId);
    if (!product) {
      throw new Error(`商品 ${productId} 不存在`);
    }

    const warehouse = dataStore.getWarehouseById(warehouseId);
    if (!warehouse) {
      throw new Error(`仓库 ${warehouseId} 不存在`);
    }

    if (quantity <= 0) {
      throw new Error('数量必须大于0');
    }

    const batch: Batch = {
      id: uuidv4(),
      batchNumber,
      productId,
      warehouseId,
      quantity,
      availableQuantity: quantity,
      frozenQuantity: 0,
      inDate,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dataStore.addBatch(batch);
    return batch;
  }

  getBatchById(id: string): Batch | undefined {
    return dataStore.getBatchById(id);
  }

  getAllBatches(): Batch[] {
    return dataStore.getBatches();
  }

  getBatchAgeDays(batch: Batch, referenceDate: Date = new Date()): number {
    const diffTime = referenceDate.getTime() - new Date(batch.inDate).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  calculateAlertLevel(batch: Batch): AlertLevel {
    if (batch.status === 'disposed') {
      return 'normal';
    }

    const product = dataStore.getProductById(batch.productId);
    if (!product) {
      return 'normal';
    }

    const ageDays = this.getBatchAgeDays(batch);
    const rules = product.alertRules;

    if (ageDays >= rules.criticalDays) {
      return 'critical';
    } else if (ageDays >= rules.highDays) {
      return 'high';
    } else if (ageDays >= rules.mediumDays) {
      return 'medium';
    } else if (ageDays >= rules.lowDays) {
      return 'low';
    }

    return 'normal';
  }
}

export const batchService = new BatchService();
