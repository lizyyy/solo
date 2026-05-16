import { v4 as uuidv4 } from 'uuid';
import {
  CancelRequest,
  CancelRequestStatus,
  TaskExecutionStatus,
  CancelReport,
  CancelReason,
  FailurePath,
  CreateCancelRequestRequest,
  ManualCorrectionRequest,
  UpdateStatusRequest,
  QueryParams,
  PaginatedResult
} from '../types';
import { cancelRequestStore } from '../store/CancelRequestStore';

export class CancelRequestService {
  private store = cancelRequestStore;

  async createCancelRequest(request: CreateCancelRequestRequest): Promise<CancelRequest> {
    const cancelRequest = await this.store.create(request);

    await this.recordFailurePath(
      cancelRequest.requestId,
      request,
      '用户提交撤销请求，初始状态为待处理',
      `撤销请求已创建，共${request.tasks.length}个任务待处理`
    );

    return cancelRequest;
  }

  async getCancelRequest(requestId: string): Promise<CancelRequest | undefined> {
    return this.store.getById(requestId);
  }

  async queryCancelRequests(params: QueryParams): Promise<PaginatedResult<CancelRequest>> {
    return this.store.query(params);
  }

  async updateStatus(
    requestId: string,
    updateRequest: UpdateStatusRequest
  ): Promise<CancelRequest | undefined> {
    const request = await this.store.getById(requestId);
    if (!request) {
      return undefined;
    }

    const validation = this.validateStatusTransition(request.status, updateRequest.status);
    if (!validation.valid) {
      await this.recordFailurePath(
        requestId,
        { currentStatus: request.status, targetStatus: updateRequest.status },
        validation.reason || '状态转换验证失败',
        '状态转换被拒绝'
      );
      throw new Error(validation.reason || 'Invalid status transition');
    }

    const reason: CancelReason | undefined = updateRequest.reason
      ? {
          code: 'STATUS_UPDATE',
          message: updateRequest.reason,
          operator: updateRequest.operator,
          operatedAt: new Date()
        }
      : undefined;

    return this.store.updateStatus(requestId, updateRequest.status, reason);
  }

  async confirmCancelRequest(
    requestId: string,
    operator: string
  ): Promise<CancelRequest | undefined> {
    const request = await this.store.getById(requestId);
    if (!request) {
      return undefined;
    }

    if (request.status !== CancelRequestStatus.PENDING) {
      throw new Error('Only pending requests can be confirmed');
    }

    return this.store.updateStatus(requestId, CancelRequestStatus.CONFIRMED, {
      code: 'CONFIRMED',
      message: '撤销请求已确认，开始执行撤销流程',
      operator,
      operatedAt: new Date()
    });
  }

  async processCancelRequest(requestId: string): Promise<CancelRequest | undefined> {
    const request = await this.store.getById(requestId);
    if (!request) {
      return undefined;
    }

    if (request.status !== CancelRequestStatus.CONFIRMED) {
      throw new Error('Only confirmed requests can be processed');
    }

    await this.store.updateStatus(requestId, CancelRequestStatus.INTERCEPTED, {
      code: 'INTERCEPTING',
      message: '开始拦截未执行的任务',
      operator: 'SYSTEM',
      operatedAt: new Date()
    });

    const report = await this.generateCancelReport(request);
    await this.store.addReport(requestId, report);

    const finalStatus =
      report.canceledTasks > 0 ? CancelRequestStatus.CANCELED : CancelRequestStatus.COMPENSATED;

    return this.store.updateStatus(requestId, finalStatus, {
      code: 'COMPLETED',
      message: `撤销处理完成，已拦截${report.interceptedTasks}个任务，撤销${report.canceledTasks}个任务，保护${report.protectedTasks}个已执行任务`,
      operator: 'SYSTEM',
      operatedAt: new Date()
    });
  }

  async cancelPendingTasks(requestId: string): Promise<{
    intercepted: number;
    canceled: number;
    protected: number;
  }> {
    const request = await this.store.getById(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    let intercepted = 0;
    let canceled = 0;
    let protectedTasks = 0;

    for (const task of request.tasks) {
      if (task.executionStatus === TaskExecutionStatus.PENDING) {
        await this.store.updateTask(requestId, task.taskId, {
          executionStatus: TaskExecutionStatus.CANCELED
        });
        intercepted++;
      } else if (task.executionStatus === TaskExecutionStatus.RUNNING) {
        await this.store.updateTask(requestId, task.taskId, {
          executionStatus: TaskExecutionStatus.CANCELED
        });
        canceled++;
      } else {
        protectedTasks++;
      }
    }

    return { intercepted, canceled, protected: protectedTasks };
  }

  async manualCorrection(
    requestId: string,
    correction: ManualCorrectionRequest
  ): Promise<CancelRequest | undefined> {
    const request = await this.store.getById(requestId);
    if (!request) {
      return undefined;
    }

    const task = request.tasks.find(t => t.taskId === correction.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const originalStatus = task.executionStatus;

    await this.store.updateTask(requestId, correction.taskId, {
      executionStatus: correction.newStatus
    });

    await this.store.addReason(requestId, {
      code: 'MANUAL_CORRECTION',
      message: `人工修正: ${correction.reason}，状态从 ${originalStatus} 改为 ${correction.newStatus}`,
      operator: correction.operator,
      operatedAt: new Date()
    });

    await this.recordFailurePath(
      requestId,
      { taskId: correction.taskId, originalStatus, newStatus: correction.newStatus },
      `人工修正操作: ${correction.reason}`,
      `任务状态已由操作员${correction.operator}人工调整`
    );

    return this.store.getById(requestId);
  }

  async recordFailurePath(
    requestId: string,
    originalInput: unknown,
    processingBasis: string,
    conclusion: string
  ): Promise<void> {
    const failurePath: FailurePath = {
      originalInput,
      processingBasis,
      conclusion,
      occurredAt: new Date()
    };
    await this.store.addFailurePath(requestId, failurePath);
  }

  async generateCancelReport(request: CancelRequest): Promise<CancelReport> {
    const result = await this.cancelPendingTasks(request.requestId);

    const details = request.tasks.map(task => ({
      taskId: task.taskId,
      taskName: task.taskName,
      originalStatus: task.executionStatus,
      finalStatus:
        task.executionStatus === TaskExecutionStatus.PENDING ||
        task.executionStatus === TaskExecutionStatus.RUNNING
          ? TaskExecutionStatus.CANCELED
          : task.executionStatus,
      action: this.getTaskAction(task.executionStatus),
      reason: this.getTaskActionReason(task.executionStatus)
    }));

    const summary = this.generateSummary(request, result);

    return {
      reportId: uuidv4(),
      generatedAt: new Date(),
      totalTasks: request.tasks.length,
      interceptedTasks: result.intercepted,
      canceledTasks: result.canceled,
      protectedTasks: result.protected,
      failedTasks: request.tasks.filter(t => t.executionStatus === TaskExecutionStatus.FAILED)
        .length,
      summary,
      details,
      failurePaths: request.failurePaths
    };
  }

  private getTaskAction(status: TaskExecutionStatus): string {
    switch (status) {
      case TaskExecutionStatus.PENDING:
        return 'INTERCEPTED';
      case TaskExecutionStatus.RUNNING:
        return 'CANCELED';
      case TaskExecutionStatus.COMPLETED:
        return 'PROTECTED';
      case TaskExecutionStatus.FAILED:
        return 'PROTECTED';
      default:
        return 'NO_ACTION';
    }
  }

  private getTaskActionReason(status: TaskExecutionStatus): string {
    switch (status) {
      case TaskExecutionStatus.PENDING:
        return '未执行任务已拦截';
      case TaskExecutionStatus.RUNNING:
        return '执行中任务已撤销';
      case TaskExecutionStatus.COMPLETED:
        return '已完成任务受保护，结果保留';
      case TaskExecutionStatus.FAILED:
        return '失败任务状态保留';
      default:
        return '无操作';
    }
  }

  private generateSummary(
    request: CancelRequest,
    result: { intercepted: number; canceled: number; protected: number }
  ): string {
    const parts: string[] = [];
    parts.push(`作业【${request.jobName}】撤销处理总结:`);
    parts.push(`- 总任务数: ${request.tasks.length}`);
    parts.push(`- 已拦截(未执行): ${result.intercepted}`);
    parts.push(`- 已撤销(执行中): ${result.canceled}`);
    parts.push(`- 已保护(已完成/失败): ${result.protected}`);
    parts.push(`- 结果保留策略: ${request.retainResultPolicy}`);
    return parts.join(' ');
  }

  private validateStatusTransition(
    currentStatus: CancelRequestStatus,
    targetStatus: CancelRequestStatus
  ): { valid: boolean; reason?: string } {
    const validTransitions: Record<CancelRequestStatus, CancelRequestStatus[]> = {
      [CancelRequestStatus.PENDING]: [CancelRequestStatus.CONFIRMED],
      [CancelRequestStatus.CONFIRMED]: [CancelRequestStatus.INTERCEPTED],
      [CancelRequestStatus.INTERCEPTED]: [
        CancelRequestStatus.CANCELED,
        CancelRequestStatus.COMPENSATED
      ],
      [CancelRequestStatus.CANCELED]: [],
      [CancelRequestStatus.COMPENSATED]: []
    };

    const allowed = validTransitions[currentStatus];
    if (!allowed.includes(targetStatus)) {
      return {
        valid: false,
        reason: `状态 ${currentStatus} 不允许转换为 ${targetStatus}，允许的目标状态: ${allowed.join(', ') || '无'}`
      };
    }
    return { valid: true };
  }

  async addOperatorNote(
    requestId: string,
    operator: string,
    note: string
  ): Promise<CancelRequest | undefined> {
    return this.store.addReason(requestId, {
      code: 'OPERATOR_NOTE',
      message: note,
      operator,
      operatedAt: new Date()
    });
  }
}

export const cancelRequestService = new CancelRequestService();
