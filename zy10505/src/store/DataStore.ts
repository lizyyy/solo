import { v4 as uuidv4 } from 'uuid';
import {
  DeliveryBatch,
  DeliveryPackage,
  ManifestFile,
  SignatureResult,
  PatchOrder,
  VerificationError,
  VerificationReport,
  DeliveryBatchStatus,
  VerificationStatus
} from '../types';

export class DataStore {
  private batches: Map<string, DeliveryBatch> = new Map();
  private batchNoToId: Map<string, string> = new Map();

  createBatch(
    batchNo: string,
    name: string,
    description: string,
    customer: string,
    version: string,
    createdBy: string
  ): DeliveryBatch {
    if (this.batchNoToId.has(batchNo)) {
      throw new Error(`批次号 ${batchNo} 已存在`);
    }

    const batch: DeliveryBatch = {
      id: uuidv4(),
      batchNo,
      name,
      description,
      customer,
      version,
      status: DeliveryBatchStatus.CREATED,
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

  getBatchById(id: string): DeliveryBatch | undefined {
    return this.batches.get(id);
  }

  getBatchByNo(batchNo: string): DeliveryBatch | undefined {
    const id = this.batchNoToId.get(batchNo);
    return id ? this.batches.get(id) : undefined;
  }

  getAllBatches(): DeliveryBatch[] {
    return Array.from(this.batches.values());
  }

  updateBatchStatus(batchId: string, newStatus: DeliveryBatchStatus): DeliveryBatch {
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

  addPackage(batchId: string, pkg: Omit<DeliveryPackage, 'id' | 'batchId' | 'uploadTime'>): DeliveryPackage {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const newPackage: DeliveryPackage = {
      ...pkg,
      id: uuidv4(),
      batchId,
      uploadTime: new Date()
    };

    batch.packages.push(newPackage);
    batch.updatedAt = new Date();
    return newPackage;
  }

  setManifest(batchId: string, manifest: Omit<ManifestFile, 'id' | 'batchId' | 'uploadTime'>): ManifestFile {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const newManifest: ManifestFile = {
      ...manifest,
      id: uuidv4(),
      batchId,
      uploadTime: new Date()
    };

    batch.manifest = newManifest;
    batch.updatedAt = new Date();
    return newManifest;
  }

  addSignature(batchId: string, signature: Omit<SignatureResult, 'id' | 'batchId' | 'verificationTime'>): SignatureResult {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const newSignature: SignatureResult = {
      ...signature,
      id: uuidv4(),
      batchId,
      verificationTime: new Date()
    };

    batch.signatures.push(newSignature);
    batch.updatedAt = new Date();
    return newSignature;
  }

  setPatchOrder(batchId: string, patchOrder: Omit<PatchOrder, 'id' | 'batchId'>): PatchOrder {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const newPatchOrder: PatchOrder = {
      ...patchOrder,
      id: uuidv4(),
      batchId
    };

    batch.patchOrder = newPatchOrder;
    batch.updatedAt = new Date();
    return newPatchOrder;
  }

  addError(batchId: string, error: Omit<VerificationError, 'id' | 'batchId' | 'occurredAt'>): VerificationError {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const newError: VerificationError = {
      ...error,
      id: uuidv4(),
      batchId,
      occurredAt: new Date()
    };

    batch.errors.push(newError);
    batch.updatedAt = new Date();
    return newError;
  }

  resolveError(batchId: string, errorId: string, resolvedBy: string, resolutionNote: string): VerificationError {
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

  addReport(batchId: string, report: Omit<VerificationReport, 'id' | 'batchId' | 'generatedAt'>): VerificationReport {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const newReport: VerificationReport = {
      ...report,
      id: uuidv4(),
      batchId,
      generatedAt: new Date()
    };

    batch.reports.push(newReport);
    batch.updatedAt = new Date();
    return newReport;
  }

  manualFixPackage(batchId: string, packageId: string): DeliveryPackage {
    const batch = this.getBatchById(batchId);
    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const pkg = batch.packages.find(p => p.id === packageId);
    if (!pkg) {
      throw new Error(`安装包 ${packageId} 不存在`);
    }

    pkg.verificationStatus = VerificationStatus.MANUALLY_FIXED;
    batch.updatedAt = new Date();
    return pkg;
  }
}

export const dataStore = new DataStore();