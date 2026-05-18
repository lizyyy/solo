import { v4 as uuidv4 } from 'uuid';
import { RoastingBatch, GreenCoffee, RoastingCurve, BatchHistory, BatchStatus } from '../types';

export class DataStore {
  private static instance: DataStore;
  public greenCoffees: Map<string, GreenCoffee> = new Map();
  public roastingCurves: Map<string, RoastingCurve> = new Map();
  public batches: Map<string, RoastingBatch> = new Map();
  public batchHistories: Map<string, BatchHistory> = new Map();

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public addGreenCoffee(coffee: GreenCoffee): void {
    this.greenCoffees.set(coffee.id, coffee);
  }

  public getGreenCoffee(id: string): GreenCoffee | undefined {
    return this.greenCoffees.get(id);
  }

  public getAllGreenCoffees(): GreenCoffee[] {
    return Array.from(this.greenCoffees.values());
  }

  public addRoastingCurve(curve: RoastingCurve): void {
    this.roastingCurves.set(curve.id, curve);
  }

  public getRoastingCurve(id: string): RoastingCurve | undefined {
    return this.roastingCurves.get(id);
  }

  public getAllRoastingCurves(): RoastingCurve[] {
    return Array.from(this.roastingCurves.values());
  }

  public addBatch(batch: RoastingBatch): void {
    this.batches.set(batch.id, batch);
  }

  public getBatch(id: string): RoastingBatch | undefined {
    return this.batches.get(id);
  }

  public getBatchByNumber(batchNumber: string): RoastingBatch | undefined {
    return Array.from(this.batches.values()).find(b => b.batchNumber === batchNumber);
  }

  public getAllBatches(): RoastingBatch[] {
    return Array.from(this.batches.values());
  }

  public getBatchesByGreenCoffeeId(greenCoffeeId: string): RoastingBatch[] {
    return Array.from(this.batches.values()).filter(b => b.greenCoffeeId === greenCoffeeId);
  }

  public updateBatch(id: string, updates: Partial<RoastingBatch>): RoastingBatch | undefined {
    const batch = this.batches.get(id);
    if (batch) {
      const updatedBatch = { ...batch, ...updates, updatedAt: new Date(), version: batch.version + 1 };
      this.batches.set(id, updatedBatch);
      return updatedBatch;
    }
    return undefined;
  }

  public addHistory(history: BatchHistory): void {
    this.batchHistories.set(history.id, history);
  }

  public getBatchHistories(batchId: string): BatchHistory[] {
    return Array.from(this.batchHistories.values())
      .filter(h => h.batchId === batchId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }

  public createHistoryRecord(
    batchId: string,
    action: string,
    previousStatus: BatchStatus | null,
    newStatus: BatchStatus,
    changedBy: string,
    comment: string,
    metadata: Record<string, any> = {}
  ): BatchHistory {
    const history: BatchHistory = {
      id: uuidv4(),
      batchId,
      action,
      previousStatus,
      newStatus,
      changedBy,
      changedAt: new Date(),
      comment,
      metadata
    };
    this.addHistory(history);
    return history;
  }

  public clearAll(): void {
    this.greenCoffees.clear();
    this.roastingCurves.clear();
    this.batches.clear();
    this.batchHistories.clear();
  }
}

export const store = DataStore.getInstance();
