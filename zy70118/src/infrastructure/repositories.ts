import { v4 as uuidv4 } from 'uuid';
import { Batch } from '../domain';
import { BatchNotFoundError, ConcurrencyConflictError } from '../domain/errors';

export interface IBatchRepository {
  create(batch: Omit<Batch, 'id' | 'createdAt' | 'lastUpdatedAt' | 'version'>): Promise<Batch>;
  findById(id: string): Promise<Batch | null>;
  update(batch: Batch, expectedVersion: number): Promise<Batch>;
  findAll(filters?: { supplierId?: string; status?: string; materialCode?: string }): Promise<Batch[]>;
  delete(id: string): Promise<void>;
}

export class InMemoryBatchRepository implements IBatchRepository {
  private batches: Map<string, Batch> = new Map();

  async create(
    batchData: Omit<Batch, 'id' | 'createdAt' | 'lastUpdatedAt' | 'version'>
  ): Promise<Batch> {
    const now = new Date();
    const batch: Batch = {
      ...batchData,
      id: uuidv4(),
      createdAt: now,
      lastUpdatedAt: now,
      version: 0
    };
    this.batches.set(batch.id, batch);
    return batch;
  }

  async findById(id: string): Promise<Batch | null> {
    const batch = this.batches.get(id);
    return batch ? { ...batch } : null;
  }

  async update(batch: Batch, expectedVersion: number): Promise<Batch> {
    const existing = this.batches.get(batch.id);
    if (!existing) {
      throw new BatchNotFoundError(batch.id);
    }

    if (existing.version !== expectedVersion) {
      throw new ConcurrencyConflictError(batch.id, expectedVersion, existing.version);
    }

    const updated: Batch = {
      ...batch,
      version: existing.version + 1,
      lastUpdatedAt: new Date()
    };

    this.batches.set(batch.id, updated);
    return { ...updated };
  }

  async findAll(
    filters?: { supplierId?: string; status?: string; materialCode?: string }
  ): Promise<Batch[]> {
    const result: Batch[] = [];

    for (const batch of this.batches.values()) {
      let match = true;

      if (filters?.supplierId && batch.supplierId !== filters.supplierId) {
        match = false;
      }
      if (filters?.status && batch.status !== filters.status) {
        match = false;
      }
      if (filters?.materialCode && batch.materialCode !== filters.materialCode) {
        match = false;
      }

      if (match) {
        result.push({ ...batch });
      }
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    if (!this.batches.has(id)) {
      throw new BatchNotFoundError(id);
    }
    this.batches.delete(id);
  }

  clear(): void {
    this.batches.clear();
  }
}
