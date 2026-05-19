import { AppDataSource } from "../config/database";
import { ImportBatch, BatchStatus } from "../models/ImportBatch";
import { ImportError } from "../models/ImportError";
import { EntityManager, In } from "typeorm";

export class ImportBatchRepository {
  private repository = AppDataSource.getRepository(ImportBatch);
  private errorRepository = AppDataSource.getRepository(ImportError);

  async createBatch(
    sourceType: "transcript" | "metadata" | "sensitive_words",
    fileName?: string
  ): Promise<ImportBatch> {
    const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const batch = this.repository.create({
      batchNumber,
      sourceType,
      fileName,
      status: "pending" as BatchStatus,
      totalRecords: 0,
      successCount: 0,
      failedCount: 0,
    });
    return this.repository.save(batch);
  }

  async updateBatchProgress(
    batchId: string,
    total: number,
    success: number,
    failed: number,
    status?: BatchStatus
  ): Promise<void> {
    const updateData: Partial<ImportBatch> = {
      totalRecords: total,
      successCount: success,
      failedCount: failed,
    };
    if (status) {
      updateData.status = status;
    }
    await this.repository.update(batchId, updateData);
  }

  async setBatchStatus(batchId: string, status: BatchStatus, errorMessage?: string): Promise<void> {
    const updateData: Partial<ImportBatch> = { status };
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    await this.repository.update(batchId, updateData);
  }

  async addError(
    batchId: string,
    lineNumber: number,
    errorMessage: string,
    originalContent?: string,
    suggestion?: string
  ): Promise<ImportError> {
    const error = this.errorRepository.create({
      batchId,
      lineNumber,
      errorMessage,
      originalContent,
      suggestion,
      resolved: false,
    });
    return this.errorRepository.save(error);
  }

  async getById(batchId: string): Promise<ImportBatch | null> {
    return this.repository.findOne({
      where: { id: batchId },
      relations: ["errors"],
    });
  }

  async getByBatchNumber(batchNumber: string): Promise<ImportBatch | null> {
    return this.repository.findOne({
      where: { batchNumber },
      relations: ["errors"],
    });
  }

  async list(limit: number = 50, offset: number = 0): Promise<ImportBatch[]> {
    return this.repository.find({
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async getUnprocessedErrors(batchId: string): Promise<ImportError[]> {
    return this.errorRepository.find({
      where: { batchId, resolved: false },
      order: { lineNumber: "ASC" },
    });
  }

  async markErrorResolved(errorId: string, resolved: boolean = true): Promise<void> {
    await this.errorRepository.update(errorId, { resolved });
  }

  async executeInTransaction<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    return AppDataSource.transaction(callback);
  }

  async getErrors(batchId: string): Promise<ImportError[]> {
    return this.errorRepository.find({
      where: { batchId },
      order: { lineNumber: "ASC" },
    });
  }
}
