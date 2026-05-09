import { store } from '../storage/inMemoryStore';
import {
  ProductionRecord,
  WasteRecord,
  ProductionStatus,
  WasteStatus,
} from '../models/types';

export class ProductionService {
  addProduction(params: {
    shiftId: string;
    productId: string;
    productName: string;
    quantity: number;
    createdBy: string;
    timestamp?: Date;
  }): ProductionRecord {
    const shift = store.getShiftById(params.shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${params.shiftId}`);
    }

    if (params.quantity <= 0) {
      throw new Error('产量必须大于0');
    }

    const now = new Date();
    const record: ProductionRecord = {
      id: store.generateId(),
      shiftId: params.shiftId,
      productId: params.productId,
      productName: params.productName,
      quantity: params.quantity,
      timestamp: params.timestamp || now,
      status: 'pending',
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return store.saveProduction(record);
  }

  addWaste(params: {
    shiftId: string;
    productId: string;
    productName: string;
    quantity: number;
    reason: string;
    createdBy: string;
    timestamp?: Date;
  }): WasteRecord {
    const shift = store.getShiftById(params.shiftId);
    if (!shift) {
      throw new Error(`班次不存在: ${params.shiftId}`);
    }

    if (params.quantity <= 0) {
      throw new Error('废品数量必须大于0');
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('废品原因不能为空');
    }

    const now = new Date();
    const record: WasteRecord = {
      id: store.generateId(),
      shiftId: params.shiftId,
      productId: params.productId,
      productName: params.productName,
      quantity: params.quantity,
      reason: params.reason,
      timestamp: params.timestamp || now,
      status: 'pending',
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return store.saveWaste(record);
  }

  confirmProduction(id: string): ProductionRecord {
    const record = store.getProductionById(id);
    if (!record) {
      throw new Error(`产量记录不存在: ${id}`);
    }

    if (record.status !== 'pending') {
      throw new Error(`产量记录状态不是待确认，无法确认: ${record.status}`);
    }

    const updated: ProductionRecord = {
      ...record,
      status: 'confirmed',
      updatedAt: new Date(),
      version: record.version + 1,
    };

    return store.saveProduction(updated);
  }

  confirmWaste(id: string): WasteRecord {
    const record = store.getWasteById(id);
    if (!record) {
      throw new Error(`废品记录不存在: ${id}`);
    }

    if (record.status !== 'pending') {
      throw new Error(`废品记录状态不是待确认，无法确认: ${record.status}`);
    }

    const updated: WasteRecord = {
      ...record,
      status: 'confirmed',
      updatedAt: new Date(),
      version: record.version + 1,
    };

    return store.saveWaste(updated);
  }

  getShiftProductions(shiftId: string): {
    records: ProductionRecord[];
    statuses: Record<ProductionStatus, number>;
    total: number;
  } {
    const records = store.getProductionsByShift(shiftId);
    const statuses: Record<ProductionStatus, number> = {
      pending: 0,
      confirmed: 0,
      revised: 0,
    };
    let total = 0;

    records.forEach((r) => {
      statuses[r.status]++;
      total += r.quantity;
    });

    return { records, statuses, total };
  }

  getShiftWastes(shiftId: string): {
    records: WasteRecord[];
    statuses: Record<WasteStatus, number>;
    total: number;
  } {
    const records = store.getWastesByShift(shiftId);
    const statuses: Record<WasteStatus, number> = {
      pending: 0,
      confirmed: 0,
      revised: 0,
    };
    let total = 0;

    records.forEach((r) => {
      statuses[r.status]++;
      total += r.quantity;
    });

    return { records, statuses, total };
  }

  calculateShiftSummary(shiftId: string): {
    productionTotal: number;
    wasteTotal: number;
    netProduction: number;
    wasteRate: number;
  } {
    const productions = this.getShiftProductions(shiftId);
    const wastes = this.getShiftWastes(shiftId);

    const productionTotal = productions.records
      .filter((r) => r.status !== 'pending')
      .reduce((sum, r) => sum + r.quantity, 0);

    const wasteTotal = wastes.records
      .filter((r) => r.status !== 'pending')
      .reduce((sum, r) => sum + r.quantity, 0);

    const netProduction = productionTotal - wasteTotal;
    const wasteRate = productionTotal > 0
      ? (wasteTotal / productionTotal) * 100
      : 0;

    return {
      productionTotal,
      wasteTotal,
      netProduction,
      wasteRate,
    };
  }

  getProductionRecord(id: string): ProductionRecord | undefined {
    return store.getProductionById(id);
  }

  getWasteRecord(id: string): WasteRecord | undefined {
    return store.getWasteById(id);
  }
}

export const productionService = new ProductionService();
