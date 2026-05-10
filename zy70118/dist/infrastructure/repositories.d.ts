import { Batch } from '../domain';
export interface IBatchRepository {
    create(batch: Omit<Batch, 'id' | 'createdAt' | 'lastUpdatedAt' | 'version'>): Promise<Batch>;
    findById(id: string): Promise<Batch | null>;
    update(batch: Batch, expectedVersion: number): Promise<Batch>;
    findAll(filters?: {
        supplierId?: string;
        status?: string;
        materialCode?: string;
    }): Promise<Batch[]>;
    delete(id: string): Promise<void>;
}
export declare class InMemoryBatchRepository implements IBatchRepository {
    private batches;
    create(batchData: Omit<Batch, 'id' | 'createdAt' | 'lastUpdatedAt' | 'version'>): Promise<Batch>;
    findById(id: string): Promise<Batch | null>;
    update(batch: Batch, expectedVersion: number): Promise<Batch>;
    findAll(filters?: {
        supplierId?: string;
        status?: string;
        materialCode?: string;
    }): Promise<Batch[]>;
    delete(id: string): Promise<void>;
    clear(): void;
}
