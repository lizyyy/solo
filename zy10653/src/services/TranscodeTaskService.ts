import { Repository, In, MoreThanOrEqual, LessThanOrEqual, Like, IsNull } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';
import { TranscodeTask, TaskStatus, FailureCode } from '../entities/TranscodeTask';
import { RetryHistory, RetryType, RetryTrigger } from '../entities/RetryHistory';
import { RowValidation, ValidationStatus, ValidationRule } from '../entities/RowValidation';
import {
  CreateTaskRequest,
  ManualRetryRequest,
  BatchRetryRequest,
  UpdateTaskStatusRequest,
  TaskQueryParams,
  ResolveConflictRequest,
} from '../types/api';

export class TranscodeTaskService {
  private taskRepository: Repository<TranscodeTask>;
  private historyRepository: Repository<RetryHistory>;
  private validationRepository: Repository<RowValidation>;

  constructor() {
    this.taskRepository = AppDataSource.getRepository(TranscodeTask);
    this.historyRepository = AppDataSource.getRepository(RetryHistory);
    this.validationRepository = AppDataSource.getRepository(RowValidation);
  }

  async createTask(request: CreateTaskRequest): Promise<TranscodeTask> {
    const task = this.taskRepository.create({
      ...request,
      status: TaskStatus.PENDING,
      retryCount: 0,
      isManuallyRetried: false,
    });

    return await this.taskRepository.save(task);
  }

  async getTaskById(id: string, includeRelations = true): Promise<TranscodeTask | null> {
    const relations = includeRelations ? ['retryHistories', 'rowValidations'] : [];
    return await this.taskRepository.findOne({
      where: { id },
      relations,
      order: {
        retryHistories: { createdAt: 'DESC' },
        rowValidations: { rowNumber: 'ASC' },
      },
    });
  }

  async queryTasks(params: TaskQueryParams) {
    const {
      businessNo,
      status,
      failureCode,
      createdBy,
      isManuallyRetried,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = params;

    const where: any = {};

    if (businessNo) where.businessNo = businessNo;
    if (status) where.status = status;
    if (failureCode) where.failureCode = failureCode;
    if (createdBy) where.createdBy = createdBy;
    if (isManuallyRetried !== undefined) where.isManuallyRetried = isManuallyRetried;
    if (startDate) where.createdAt = MoreThanOrEqual(new Date(startDate));
    if (endDate) where.createdAt = LessThanOrEqual(new Date(endDate));

    const [items, total] = await this.taskRepository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { [sortBy]: sortOrder },
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async manualRetry(request: ManualRetryRequest): Promise<{
    task: TranscodeTask;
    history: RetryHistory;
    isDuplicate: boolean;
  }> {
    const task = await this.getTaskById(request.taskId, false);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    if (task.status === TaskStatus.RETRYING && !request.forceRetry) {
      const recentRetry = await this.historyRepository.findOne({
        where: {
          taskId: task.id,
          statusAfter: TaskStatus.RETRYING,
          finalStatus: IsNull(),
        },
        order: { createdAt: 'DESC' },
      });

      if (recentRetry) {
        return {
          task,
          history: recentRetry,
          isDuplicate: true,
        };
      }
    }

    if (task.status !== TaskStatus.FAILED && task.status !== TaskStatus.CONFLICT) {
      throw new Error('INVALID_STATUS_FOR_RETRY');
    }

    if (request.requestId) {
      const existingRequest = await this.historyRepository.findOne({
        where: { requestId: request.requestId },
      });
      if (existingRequest) {
        return {
          task,
          history: existingRequest,
          isDuplicate: true,
        };
      }
    }

    const statusBefore = task.status;
    const fileHashBefore = task.fileHash;

    task.status = TaskStatus.RETRYING;
    task.retryCount += 1;
    task.isManuallyRetried = true;
    task.lastRetriedBy = request.retriedBy;
    task.lastRetriedAt = new Date();

    if (request.retryParams) {
      task.retryParams = {
        ...task.retryParams,
        ...request.retryParams,
      };
    }

    const savedTask = await this.taskRepository.save(task);

    const history = this.historyRepository.create({
      taskId: task.id,
      retryType: RetryType.MANUAL,
      retryTrigger: RetryTrigger.USER_CLICK,
      statusBefore,
      statusAfter: TaskStatus.RETRYING,
      retryParams: request.retryParams,
      fileHashBefore,
      fileHashAfter: task.fileHash,
      isHashChanged: fileHashBefore !== task.fileHash,
      previousFailureCode: task.failureCode,
      previousFailureMessage: task.failureMessage,
      retriedBy: request.retriedBy,
      retryNote: request.retryNote,
      isDuplicateRequest: false,
      requestId: request.requestId,
      retryAttemptNumber: task.retryCount,
      requestContext: {
        userAgent: 'api-client',
        retrySource: 'manual_retry_api',
      },
    });

    const savedHistory = await this.historyRepository.save(history);

    return {
      task: savedTask,
      history: savedHistory,
      isDuplicate: false,
    };
  }

  async batchRetry(request: BatchRetryRequest): Promise<{
    results: Array<{
      taskId: string;
      success: boolean;
      isDuplicate?: boolean;
      error?: string;
    }>;
  }> {
    const results = [];

    for (const taskId of request.taskIds) {
      try {
        const result = await this.manualRetry({
          taskId,
          retriedBy: request.retriedBy,
          retryNote: request.retryNote,
          retryParams: request.retryParams,
        });
        results.push({
          taskId,
          success: true,
          isDuplicate: result.isDuplicate,
        });
      } catch (error: any) {
        results.push({
          taskId,
          success: false,
          error: error.message,
        });
      }
    }

    return { results };
  }

  async updateTaskStatus(
    taskId: string,
    request: UpdateTaskStatusRequest
  ): Promise<TranscodeTask> {
    const task = await this.getTaskById(taskId, false);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    const previousStatus = task.status;

    task.status = request.status;

    if (request.failureCode) {
      task.failureCode = request.failureCode;
    }
    if (request.failureMessage) {
      task.failureMessage = request.failureMessage;
    }
    if (request.outputFilePath) {
      task.outputFilePath = request.outputFilePath;
    }

    if (
      previousStatus === TaskStatus.RETRYING &&
      (request.status === TaskStatus.FAILED || request.status === TaskStatus.COMPLETED)
    ) {
      const latestHistory = await this.historyRepository.findOne({
        where: {
          taskId,
          statusAfter: TaskStatus.RETRYING,
          finalStatus: IsNull(),
        },
        order: { createdAt: 'DESC' },
      });

      if (latestHistory) {
        latestHistory.finalStatus = request.status;
        latestHistory.finalFailureCode = request.failureCode;
        latestHistory.finalFailureMessage = request.failureMessage;
        latestHistory.completedAt = new Date();
        await this.historyRepository.save(latestHistory);
      }
    }

    return await this.taskRepository.save(task);
  }

  async checkSourceFileChanged(
    taskId: string,
    newFileHash: string
  ): Promise<{ changed: boolean; task: TranscodeTask }> {
    const task = await this.getTaskById(taskId, false);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    const changed = task.fileHash !== newFileHash;

    if (changed && task.status === TaskStatus.FAILED) {
      task.status = TaskStatus.CONFLICT;
      task.conflictNote = `源文件已变更，旧文件哈希: ${task.fileHash}，新文件哈希: ${newFileHash}`;
      await this.taskRepository.save(task);

      const history = this.historyRepository.create({
        taskId,
        retryType: RetryType.CALLBACK,
        retryTrigger: RetryTrigger.API_CALL,
        statusBefore: TaskStatus.FAILED,
        statusAfter: TaskStatus.CONFLICT,
        fileHashBefore: task.fileHash,
        fileHashAfter: newFileHash,
        isHashChanged: true,
        isCallbackOverride: true,
        sourceFileReplaced: true,
        retryNote: '检测到源文件被替换，任务标记为冲突状态',
      });
      await this.historyRepository.save(history);
    }

    return { changed, task };
  }

  async resolveConflict(request: ResolveConflictRequest): Promise<TranscodeTask> {
    const task = await this.getTaskById(request.taskId, false);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }

    if (task.status !== TaskStatus.CONFLICT) {
      throw new Error('TASK_NOT_IN_CONFLICT');
    }

    let newTaskId: string | undefined;

    if (request.createNewTask) {
      const newTask = this.taskRepository.create({
        businessNo: task.businessNo,
        fileName: task.fileName,
        fileHash: task.fileHash,
        fileSize: task.fileSize,
        sourceFormat: task.sourceFormat,
        targetFormat: task.targetFormat,
        status: TaskStatus.PENDING,
        retryCount: 0,
        maxRetryCount: task.maxRetryCount,
        sourceFilePath: task.sourceFilePath,
        createdBy: request.resolvedBy,
        retryParams: task.retryParams,
      });
      const savedNewTask = await this.taskRepository.save(newTask);
      newTaskId = savedNewTask.id;
    }

    if (request.cancelOldTask) {
      task.status = TaskStatus.CANCELLED;
    } else {
      task.status = TaskStatus.FAILED;
    }

    task.resolvedBy = request.resolvedBy;
    task.resolvedAt = new Date();

    const history = this.historyRepository.create({
      taskId: task.id,
      retryType: RetryType.MANUAL,
      retryTrigger: RetryTrigger.CONFLICT_RESOLUTION,
      statusBefore: TaskStatus.CONFLICT,
      statusAfter: task.status,
      retriedBy: request.resolvedBy,
      retryNote: request.resolutionNote,
      sourceFileReplaced: true,
      newTaskId,
    });
    await this.historyRepository.save(history);

    return await this.taskRepository.save(task);
  }

  async addRowValidation(
    taskId: string,
    rowNumber: number,
    rowData: Record<string, any>,
    errors: Array<{
      field: string;
      rule: ValidationRule;
      message: string;
    }>,
    sheetName?: string
  ): Promise<RowValidation> {
    const validation = this.validationRepository.create({
      taskId,
      rowNumber,
      sheetName,
      rowData,
      status: errors.length > 0 ? ValidationStatus.FAILED : ValidationStatus.PASSED,
      validationErrors: errors.map((e) => ({ ...e, severity: 'error' as const })),
      isBadRow: errors.length > 0,
      validatedAt: new Date(),
    });

    return await this.validationRepository.save(validation);
  }

  async getTaskHistory(taskId: string): Promise<RetryHistory[]> {
    return await this.historyRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRowValidations(taskId: string): Promise<RowValidation[]> {
    return await this.validationRepository.find({
      where: { taskId },
      order: { rowNumber: 'ASC' },
    });
  }

  async getBadRows(taskId: string): Promise<RowValidation[]> {
    return await this.validationRepository.find({
      where: { taskId, isBadRow: true },
      order: { rowNumber: 'ASC' },
    });
  }

  async exportTasks(params: any): Promise<any[]> {
    const tasks = await this.taskRepository.find({
      where: params.status ? { status: params.status } : {},
      relations: params.includeHistory ? ['retryHistories'] : [],
    });

    return tasks.map((task) => ({
      id: task.id,
      businessNo: task.businessNo,
      fileName: task.fileName,
      status: task.status,
      failureCode: task.failureCode,
      retryCount: task.retryCount,
      isManuallyRetried: task.isManuallyRetried,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      retryHistories: params.includeHistory
        ? task.retryHistories?.map((h) => ({
            id: h.id,
            retryType: h.retryType,
            retriedBy: h.retriedBy,
            createdAt: h.createdAt,
          }))
        : undefined,
    }));
  }
}
