import { v4 as uuidv4 } from 'uuid';
import {
  ArbitrationRecord,
  ArbitrationStatus,
  CreateArbitrationRequest,
  UpdateStatusRequest,
  CorrectionRequest,
  QueryParams,
  PaginatedResult,
  Correction
} from '../types';

class ArbitrationStore {
  private records: Map<string, ArbitrationRecord> = new Map();

  create(request: CreateArbitrationRequest): ArbitrationRecord {
    const now = new Date();
    const id = uuidv4();

    const record: ArbitrationRecord = {
      id,
      fieldName: request.fieldName,
      sourceReports: request.sourceReports,
      disputeDescription: request.disputeDescription,
      status: ArbitrationStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      createdBy: request.createdBy,
      history: [
        {
          status: ArbitrationStatus.PENDING,
          changedAt: now,
          changedBy: request.createdBy,
          remark: '创建仲裁记录'
        }
      ],
      rawInput: request.rawInput || request,
      corrections: []
    };

    this.records.set(id, record);
    return record;
  }

  findById(id: string): ArbitrationRecord | undefined {
    return this.records.get(id);
  }

  findAll(params: QueryParams): PaginatedResult<ArbitrationRecord> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;

    let filteredRecords = Array.from(this.records.values());

    if (params.fieldName) {
      filteredRecords = filteredRecords.filter(r =>
        r.fieldName.toLowerCase().includes(params.fieldName!.toLowerCase())
      );
    }

    if (params.status) {
      filteredRecords = filteredRecords.filter(r => r.status === params.status);
    }

    if (params.createdBy) {
      filteredRecords = filteredRecords.filter(r =>
        r.createdBy.toLowerCase().includes(params.createdBy!.toLowerCase())
      );
    }

    filteredRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filteredRecords.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const data = filteredRecords.slice(startIndex, endIndex);

    return {
      data,
      total,
      page,
      pageSize
    };
  }

  updateStatus(id: string, request: UpdateStatusRequest): ArbitrationRecord | null {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }

    if (record.status === request.status) {
      return record;
    }

    const now = new Date();
    record.status = request.status;
    record.updatedAt = now;

    if (request.arbitrationOpinion) {
      record.arbitrationOpinion = request.arbitrationOpinion;
    }

    if (request.effectiveVersion) {
      record.effectiveVersion = request.effectiveVersion;
    }

    if (request.handlingBasis) {
      record.handlingBasis = request.handlingBasis;
    }

    if (request.status === ArbitrationStatus.ARBITRATED ||
        request.status === ArbitrationStatus.EFFECTIVE) {
      record.arbitratedBy = request.updatedBy;
    }

    record.history.push({
      status: request.status,
      changedAt: now,
      changedBy: request.updatedBy,
      remark: request.remark
    });

    this.records.set(id, record);
    return record;
  }

  addCorrection(id: string, request: CorrectionRequest): ArbitrationRecord | null {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }

    const oldValue = (record as any)[request.field];
    const correction: Correction = {
      id: uuidv4(),
      correctedBy: request.correctedBy,
      correctedAt: new Date(),
      field: request.field,
      oldValue,
      newValue: request.newValue,
      reason: request.reason
    };

    (record as any)[request.field] = request.newValue;
    record.updatedAt = new Date();
    record.corrections.push(correction);

    this.records.set(id, record);
    return record;
  }

  getAllRecords(): ArbitrationRecord[] {
    return Array.from(this.records.values());
  }

  clear(): void {
    this.records.clear();
  }
}

export const arbitrationStore = new ArbitrationStore();
