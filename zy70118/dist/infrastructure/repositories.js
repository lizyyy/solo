"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryBatchRepository = void 0;
const uuid_1 = require("uuid");
const errors_1 = require("../domain/errors");
class InMemoryBatchRepository {
    constructor() {
        this.batches = new Map();
    }
    async create(batchData) {
        const now = new Date();
        const batch = {
            ...batchData,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            lastUpdatedAt: now,
            version: 0
        };
        this.batches.set(batch.id, batch);
        return batch;
    }
    async findById(id) {
        const batch = this.batches.get(id);
        return batch ? { ...batch } : null;
    }
    async update(batch, expectedVersion) {
        const existing = this.batches.get(batch.id);
        if (!existing) {
            throw new errors_1.BatchNotFoundError(batch.id);
        }
        if (existing.version !== expectedVersion) {
            throw new errors_1.ConcurrencyConflictError(batch.id, expectedVersion, existing.version);
        }
        const updated = {
            ...batch,
            version: existing.version + 1,
            lastUpdatedAt: new Date()
        };
        this.batches.set(batch.id, updated);
        return { ...updated };
    }
    async findAll(filters) {
        const result = [];
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
    async delete(id) {
        if (!this.batches.has(id)) {
            throw new errors_1.BatchNotFoundError(id);
        }
        this.batches.delete(id);
    }
    clear() {
        this.batches.clear();
    }
}
exports.InMemoryBatchRepository = InMemoryBatchRepository;
//# sourceMappingURL=repositories.js.map