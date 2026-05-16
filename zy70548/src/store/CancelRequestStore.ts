import { v4 as uuidv4 } from 'uuid';
import {
  CancelRequest,
  CancelRequestStatus,
  QueryParams,
  PaginatedResult,
  CreateCancelRequestRequest,
  CancelReason,
  CancelReport,
  FailurePath,
  JobTask,
  TaskExecutionStatus
} from '../types';

export interface ICancelRequestStore {
  create(request: CreateCancelRequestRequest): Promise<CancelRequest>;
  getById(requestId: string): Promise<CancelRequest | undefined>;
  query(params: QueryParams): Promise<PaginatedResult<CancelRequest>>;
  updateStatus(requestId: string, status: CancelRequestStatus, reason?: CancelReason): Promise<CancelRequest | undefined>;
  updateTask(requestId: string, taskId: string, updates: Partial<JobTask>): Promise<CancelRequest | undefined>;
  addReport(requestId: string, report: CancelReport): Promise<CancelRequest | undefined>;
  addFailurePath(requestId: string, failurePath: FailurePath): Promise<CancelRequest | undefined>;
  addReason(requestId: string, reason: CancelReason): Promise<CancelRequest | undefined>;
  delete(requestId: string): Promise<boolean>;
}

export class InMemoryCancelRequestStore implements ICancelRequestStore {
  private requests: Map<string, CancelRequest> = new Map();

  async create(request: CreateCancelRequestRequest): Promise<CancelRequest> {
    const now = new Date();
    const cancelRequest: CancelRequest = {
      requestId: uuidv4(),
      jobId: request.jobId,
      jobName: request.jobName,
      status: CancelRequestStatus.PENDING,
      tasks: request.tasks.map(t => ({
        ...t,
        executionStatus: t.executionStatus as TaskExecutionStatus
      })),
      reasons: [{
        code: request.reason.code,
        message: request.reason.message,
        operator: request.reason.operator,
        operatedAt: now,
        evidence: request.reason.evidence
      }],
      retainResultPolicy: request.retainResultPolicy,
      reports: [],
      failurePaths: [],
      createdAt: now,
      updatedAt: now
    };

    this.requests.set(cancelRequest.requestId, cancelRequest);
    return cancelRequest;
  }

  async getById(requestId: string): Promise<CancelRequest | undefined> {
    return this.requests.get(requestId);
  }

  async query(params: QueryParams): Promise<PaginatedResult<CancelRequest>> {
    let result = Array.from(this.requests.values());

    if (params.jobId) {
      result = result.filter(r => r.jobId === params.jobId);
    }

    if (params.status) {
      result = result.filter(r => r.status === params.status);
    }

    if (params.operator) {
      result = result.filter(r =>
        r.reasons.some(reason => reason.operator === params.operator)
      );
    }

    if (params.startTime) {
      const startTime = params.startTime;
      result = result.filter(r => r.createdAt >= startTime);
    }

    if (params.endTime) {
      const endTime = params.endTime;
      result = result.filter(r => r.createdAt <= endTime);
    }

    const total = result.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    result = result.slice(startIndex, endIndex);

    return {
      data: result,
      total,
      page,
      pageSize
    };
  }

  async updateStatus(
    requestId: string,
    status: CancelRequestStatus,
    reason?: CancelReason
  ): Promise<CancelRequest | undefined> {
    const request = this.requests.get(requestId);
    if (!request) {
      return undefined;
    }

    const now = new Date();
    request.status = status;
    request.updatedAt = now;

    if (status === CancelRequestStatus.CONFIRMED && !request.confirmedAt) {
      request.confirmedAt = now;
    }

    if (
      status === CancelRequestStatus.CANCELED ||
      status === CancelRequestStatus.COMPENSATED
    ) {
      request.completedAt = now;
    }

    if (reason) {
      request.reasons.push(reason);
    }

    this.requests.set(requestId, request);
    return request;
  }

  async updateTask(
    requestId: string,
    taskId: string,
    updates: Partial<JobTask>
  ): Promise<CancelRequest | undefined> {
    const request = this.requests.get(requestId);
    if (!request) {
      return undefined;
    }

    const taskIndex = request.tasks.findIndex(t => t.taskId === taskId);
    if (taskIndex === -1) {
      return undefined;
    }

    request.tasks[taskIndex] = {
      ...request.tasks[taskIndex],
      ...updates
    };
    request.updatedAt = new Date();

    this.requests.set(requestId, request);
    return request;
  }

  async addReport(requestId: string, report: CancelReport): Promise<CancelRequest | undefined> {
    const request = this.requests.get(requestId);
    if (!request) {
      return undefined;
    }

    request.reports.push(report);
    request.updatedAt = new Date();

    this.requests.set(requestId, request);
    return request;
  }

  async addFailurePath(requestId: string, failurePath: FailurePath): Promise<CancelRequest | undefined> {
    const request = this.requests.get(requestId);
    if (!request) {
      return undefined;
    }

    request.failurePaths.push(failurePath);
    request.updatedAt = new Date();

    this.requests.set(requestId, request);
    return request;
  }

  async addReason(requestId: string, reason: CancelReason): Promise<CancelRequest | undefined> {
    const request = this.requests.get(requestId);
    if (!request) {
      return undefined;
    }

    request.reasons.push(reason);
    request.updatedAt = new Date();

    this.requests.set(requestId, request);
    return request;
  }

  async delete(requestId: string): Promise<boolean> {
    return this.requests.delete(requestId);
  }
}

export const cancelRequestStore = new InMemoryCancelRequestStore();
