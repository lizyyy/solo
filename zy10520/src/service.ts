import {
  ExperimentPollution,
  PollutionStatus,
  CreatePollutionRequest,
  UpdateStatusRequest,
  ManualCorrectionRequest,
  QueryParams,
  ExportRequest,
  PollutionRule,
  SampleUser,
  OperationLog
} from './types';
import { dataStore } from './store';

const STATUS_TRANSITIONS: Record<PollutionStatus, PollutionStatus[]> = {
  [PollutionStatus.CREATED]: [PollutionStatus.IDENTIFIED, PollutionStatus.CANCELLED],
  [PollutionStatus.IDENTIFIED]: [PollutionStatus.SAMPLES_MARKED, PollutionStatus.CANCELLED],
  [PollutionStatus.SAMPLES_MARKED]: [PollutionStatus.IMPACT_RECALCULATED, PollutionStatus.CANCELLED],
  [PollutionStatus.IMPACT_RECALCULATED]: [PollutionStatus.REVIEW_REQUESTED, PollutionStatus.CANCELLED],
  [PollutionStatus.REVIEW_REQUESTED]: [PollutionStatus.REVIEW_APPROVED, PollutionStatus.REVIEW_REJECTED, PollutionStatus.CANCELLED],
  [PollutionStatus.REVIEW_APPROVED]: [PollutionStatus.COMPLETED],
  [PollutionStatus.REVIEW_REJECTED]: [PollutionStatus.REVIEW_REQUESTED, PollutionStatus.CANCELLED],
  [PollutionStatus.COMPLETED]: [],
  [PollutionStatus.CANCELLED]: []
};

export class PollutionService {
  createPollution(request: CreatePollutionRequest): ExperimentPollution {
    const now = new Date();
    const record: ExperimentPollution = {
      id: dataStore.generateId(),
      experimentId: request.experimentId,
      experimentName: request.experimentName,
      status: PollutionStatus.CREATED,
      pollutionRules: request.pollutionRules.map(rule => ({
        ...rule,
        id: dataStore.generateId(),
        createdAt: now
      })),
      sampleUsers: request.sampleUsers.map(user => ({
        ...user,
        isPolluted: false
      })),
      metricImpacts: [],
      reviewReports: [],
      operationLogs: [],
      createdBy: request.createdBy,
      createdAt: now,
      updatedAt: now,
      remarks: request.remarks
    };

    dataStore.save(record);
    this.addOperationLog(record, 'CREATE', request.createdBy, '创建污染记录', request, PollutionStatus.CREATED, PollutionStatus.CREATED);
    return record;
  }

  getById(id: string): ExperimentPollution | undefined {
    return dataStore.findById(id);
  }

  query(params: QueryParams): { total: number; data: ExperimentPollution[] } {
    let records = dataStore.findAll();

    if (params.experimentId) {
      records = records.filter(r => r.experimentId === params.experimentId);
    }
    if (params.status) {
      records = records.filter(r => r.status === params.status);
    }
    if (params.createdBy) {
      records = records.filter(r => r.createdBy === params.createdBy);
    }
    if (params.startTime) {
      records = records.filter(r => r.createdAt >= new Date(params.startTime as Date));
    }
    if (params.endTime) {
      records = records.filter(r => r.createdAt <= new Date(params.endTime as Date));
    }

    const total = records.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    records = records.slice(start, end);

    return { total, data: records };
  }

  updateStatus(request: UpdateStatusRequest): ExperimentPollution {
    const record = dataStore.findById(request.recordId);
    if (!record) {
      throw new Error('Record not found');
    }

    if (record.status === request.targetStatus) {
      this.addOperationLog(
        record,
        'STATUS_UPDATE_IDEMPOTENT',
        request.operator,
        request.processingBasis,
        request.payload,
        record.status,
        record.status
      );
      return record;
    }

    const allowedTransitions = STATUS_TRANSITIONS[record.status];
    if (!allowedTransitions.includes(request.targetStatus)) {
      this.addOperationLog(
        record,
        'STATUS_UPDATE_FAILED',
        request.operator,
        request.processingBasis,
        request.payload,
        record.status,
        record.status,
        `Invalid status transition: ${record.status} -> ${request.targetStatus}`
      );
      throw new Error(`Invalid status transition from ${record.status} to ${request.targetStatus}`);
    }

    const previousStatus = record.status;
    record.status = request.targetStatus;
    record.updatedAt = new Date();

    this.processStatusPayload(record, request);
    this.addOperationLog(
      record,
      'STATUS_UPDATE',
      request.operator,
      request.processingBasis,
      request.payload,
      previousStatus,
      request.targetStatus
    );

    dataStore.save(record);
    return record;
  }

  private processStatusPayload(record: ExperimentPollution, request: UpdateStatusRequest): void {
    if (!request.payload) return;

    switch (request.targetStatus) {
      case PollutionStatus.IDENTIFIED:
        if (request.payload.pollutedUserIds) {
          record.sampleUsers = record.sampleUsers.map(user => ({
            ...user,
            isPolluted: request.payload.pollutedUserIds.includes(user.userId),
            markedAt: new Date(),
            markedBy: request.operator
          }));
        }
        break;
      case PollutionStatus.IMPACT_RECALCULATED:
        if (request.payload.metricImpacts) {
          record.metricImpacts = request.payload.metricImpacts;
        }
        break;
      case PollutionStatus.REVIEW_REQUESTED:
        if (request.payload.exclusionApplication) {
          record.exclusionApplication = {
            ...request.payload.exclusionApplication,
            id: dataStore.generateId(),
            appliedAt: new Date()
          };
        }
        break;
      case PollutionStatus.REVIEW_APPROVED:
      case PollutionStatus.REVIEW_REJECTED:
        if (request.payload.reviewReport) {
          record.reviewReports.push({
            ...request.payload.reviewReport,
            id: dataStore.generateId(),
            reviewedAt: new Date()
          });
        }
        break;
    }
  }

  manualCorrection(request: ManualCorrectionRequest): ExperimentPollution {
    const record = dataStore.findById(request.recordId);
    if (!record) {
      throw new Error('Record not found');
    }

    const previousStatus = record.status;
    this.applyManualCorrection(record, request);
    record.updatedAt = new Date();

    this.addOperationLog(
      record,
      'MANUAL_CORRECTION',
      request.operator,
      request.reason,
      { originalValue: request.originalValue, newValue: request.newValue },
      previousStatus,
      record.status
    );

    dataStore.save(record);
    return record;
  }

  private applyManualCorrection(record: ExperimentPollution, request: ManualCorrectionRequest): void {
    switch (request.correctionType) {
      case 'SAMPLE_USER':
        const userIndex = record.sampleUsers.findIndex(u => u.userId === request.originalValue.userId);
        if (userIndex >= 0) {
          record.sampleUsers[userIndex] = {
            ...record.sampleUsers[userIndex],
            ...request.newValue,
            markedAt: new Date(),
            markedBy: request.operator
          };
        }
        break;
      case 'POLLUTION_RULE':
        const ruleIndex = record.pollutionRules.findIndex(r => r.id === request.originalValue.id);
        if (ruleIndex >= 0) {
          record.pollutionRules[ruleIndex] = {
            ...record.pollutionRules[ruleIndex],
            ...request.newValue
          };
        }
        break;
      case 'METRIC_IMPACT':
        record.metricImpacts = request.newValue;
        break;
      case 'REMARKS':
        record.remarks = request.newValue;
        break;
    }
  }

  export(request: ExportRequest): any {
    const record = dataStore.findById(request.recordId);
    if (!record) {
      throw new Error('Record not found');
    }

    const result: any = {};

    if (request.includeSections.includes('BASIC')) {
      result.basic = {
        id: record.id,
        experimentId: record.experimentId,
        experimentName: record.experimentName,
        status: record.status,
        createdBy: record.createdBy,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        remarks: record.remarks
      };
    }

    if (request.includeSections.includes('SAMPLES')) {
      result.pollutionRules = record.pollutionRules;
      result.sampleUsers = record.sampleUsers;
    }

    if (request.includeSections.includes('IMPACT')) {
      result.metricImpacts = record.metricImpacts;
      result.exclusionApplication = record.exclusionApplication;
    }

    if (request.includeSections.includes('REVIEW')) {
      result.reviewReports = record.reviewReports;
    }

    if (request.includeSections.includes('LOGS')) {
      result.operationLogs = record.operationLogs;
    }

    return result;
  }

  private addOperationLog(
    record: ExperimentPollution,
    operation: string,
    operator: string,
    processingBasis: string,
    originalInput: any,
    statusBefore: string,
    statusAfter: string,
    errorMessage?: string
  ): void {
    const log: Omit<OperationLog, 'id' | 'recordId'> = {
      operation,
      operator,
      operatedAt: new Date(),
      originalInput,
      processingBasis,
      statusBefore,
      statusAfter,
      errorMessage
    };
    dataStore.addOperationLog(record.id, log);
  }
}

export const pollutionService = new PollutionService();
