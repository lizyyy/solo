"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = exports.DataStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class DataStore {
    constructor() {
        this.batches = new Map();
        this.batchNoToId = new Map();
    }
    createBatch(batchNo, name, description, customer, version, createdBy) {
        if (this.batchNoToId.has(batchNo)) {
            throw new Error(`批次号 ${batchNo} 已存在`);
        }
        const batch = {
            id: (0, uuid_1.v4)(),
            batchNo,
            name,
            description,
            customer,
            version,
            status: types_1.DeliveryBatchStatus.CREATED,
            createdAt: new Date(),
            createdBy,
            updatedAt: new Date(),
            packages: [],
            manifest: null,
            signatures: [],
            patchOrder: null,
            errors: [],
            reports: []
        };
        this.batches.set(batch.id, batch);
        this.batchNoToId.set(batchNo, batch.id);
        return batch;
    }
    getBatchById(id) {
        return this.batches.get(id);
    }
    getBatchByNo(batchNo) {
        const id = this.batchNoToId.get(batchNo);
        return id ? this.batches.get(id) : undefined;
    }
    getAllBatches() {
        return Array.from(this.batches.values());
    }
    updateBatchStatus(batchId, newStatus) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        if (batch.status === newStatus) {
            return batch;
        }
        batch.status = newStatus;
        batch.updatedAt = new Date();
        return batch;
    }
    addPackage(batchId, pkg) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const newPackage = {
            ...pkg,
            id: (0, uuid_1.v4)(),
            batchId,
            uploadTime: new Date()
        };
        batch.packages.push(newPackage);
        batch.updatedAt = new Date();
        return newPackage;
    }
    setManifest(batchId, manifest) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const newManifest = {
            ...manifest,
            id: (0, uuid_1.v4)(),
            batchId,
            uploadTime: new Date()
        };
        batch.manifest = newManifest;
        batch.updatedAt = new Date();
        return newManifest;
    }
    addSignature(batchId, signature) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const newSignature = {
            ...signature,
            id: (0, uuid_1.v4)(),
            batchId,
            verificationTime: new Date()
        };
        batch.signatures.push(newSignature);
        batch.updatedAt = new Date();
        return newSignature;
    }
    setPatchOrder(batchId, patchOrder) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const newPatchOrder = {
            ...patchOrder,
            id: (0, uuid_1.v4)(),
            batchId
        };
        batch.patchOrder = newPatchOrder;
        batch.updatedAt = new Date();
        return newPatchOrder;
    }
    addError(batchId, error) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const newError = {
            ...error,
            id: (0, uuid_1.v4)(),
            batchId,
            occurredAt: new Date()
        };
        batch.errors.push(newError);
        batch.updatedAt = new Date();
        return newError;
    }
    resolveError(batchId, errorId, resolvedBy, resolutionNote) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const error = batch.errors.find(e => e.id === errorId);
        if (!error) {
            throw new Error(`错误记录 ${errorId} 不存在`);
        }
        error.resolved = true;
        error.resolvedBy = resolvedBy;
        error.resolvedAt = new Date();
        error.resolutionNote = resolutionNote;
        batch.updatedAt = new Date();
        return error;
    }
    addReport(batchId, report) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const newReport = {
            ...report,
            id: (0, uuid_1.v4)(),
            batchId,
            generatedAt: new Date()
        };
        batch.reports.push(newReport);
        batch.updatedAt = new Date();
        return newReport;
    }
    manualFixPackage(batchId, packageId) {
        const batch = this.getBatchById(batchId);
        if (!batch) {
            throw new Error(`批次 ${batchId} 不存在`);
        }
        const pkg = batch.packages.find(p => p.id === packageId);
        if (!pkg) {
            throw new Error(`安装包 ${packageId} 不存在`);
        }
        pkg.verificationStatus = types_1.VerificationStatus.MANUALLY_FIXED;
        batch.updatedAt = new Date();
        return pkg;
    }
}
exports.DataStore = DataStore;
exports.dataStore = new DataStore();
