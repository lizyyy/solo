import { store } from './store';
import {
  SyncTask,
  SyncTaskStatus,
  PauseWindow,
  PauseWindowStatus,
  RecoveryAction,
  RecoveryActionStatus,
  FailureDetail,
  FailureType,
  SyncReport,
  CreateSyncTaskRequest,
  CreatePauseWindowRequest,
  StartRecoveryRequest,
  ManualCorrectionRequest,
  BacklogStats
} from './models';
import * as fs from 'fs';
import * as path from 'path';

export class SyncPauseService {
  async createSyncTask(request: CreateSyncTaskRequest): Promise<SyncTask> {
    const now = new Date().toISOString();
    const initialBacklog: BacklogStats = {
      totalCount: 0,
      pendingCount: 0,
      processingCount: 0,
      failedCount: 0,
      lastUpdated: now
    };

    return store.createSyncTask({
      name: request.name,
      description: request.description,
      sourceSystem: request.sourceSystem,
      targetSystem: request.targetSystem,
      status: SyncTaskStatus.ACTIVE,
      backlogStats: initialBacklog,
      createdBy: request.createdBy,
      metadata: request.metadata
    });
  }

  async getSyncTask(id: string): Promise<SyncTask | undefined> {
    return store.getSyncTask(id);
  }

  async listSyncTasks(): Promise<SyncTask[]> {
    return store.listSyncTasks();
  }

  async createPauseWindow(request: CreatePauseWindowRequest): Promise<PauseWindow> {
    const task = await this.getSyncTask(request.syncTaskId);
    if (!task) {
      throw new Error(`Sync task not found: ${request.syncTaskId}`);
    }

    if (task.status === SyncTaskStatus.PAUSED) {
      throw new Error(`Task is already paused`);
    }

    const startTime = request.startTime || new Date().toISOString();
    const isImmediate = !request.startTime || new Date(request.startTime) <= new Date();

    const window = store.createPauseWindow({
      syncTaskId: request.syncTaskId,
      name: request.name,
      reason: request.reason,
      startTime,
      status: isImmediate ? PauseWindowStatus.ACTIVE : PauseWindowStatus.SCHEDULED,
      expectedDuration: request.expectedDuration,
      backlogAtPause: task.backlogStats.totalCount,
      createdBy: request.createdBy
    });

    if (isImmediate) {
      store.updateSyncTask(request.syncTaskId, {
        status: SyncTaskStatus.PAUSED,
        currentPauseWindowId: window.id
      });
    }

    return window;
  }

  async getPauseWindow(id: string): Promise<PauseWindow | undefined> {
    return store.getPauseWindow(id);
  }

  async listPauseWindows(syncTaskId: string): Promise<PauseWindow[]> {
    return store.listPauseWindowsByTask(syncTaskId);
  }

  async activatePauseWindow(windowId: string): Promise<PauseWindow> {
    const window = await this.getPauseWindow(windowId);
    if (!window) {
      throw new Error(`Pause window not found: ${windowId}`);
    }

    if (window.status !== PauseWindowStatus.SCHEDULED) {
      throw new Error(`Window is not in SCHEDULED state`);
    }

    const task = await this.getSyncTask(window.syncTaskId);
    if (!task) {
      throw new Error(`Sync task not found: ${window.syncTaskId}`);
    }

    store.updatePauseWindow(windowId, {
      status: PauseWindowStatus.ACTIVE,
      startTime: new Date().toISOString()
    });

    store.updateSyncTask(window.syncTaskId, {
      status: SyncTaskStatus.PAUSED,
      currentPauseWindowId: windowId
    });

    return store.getPauseWindow(windowId)!;
  }

  async endPauseWindow(windowId: string): Promise<{ window: PauseWindow; task: SyncTask }> {
    const window = await this.getPauseWindow(windowId);
    if (!window) {
      throw new Error(`Pause window not found: ${windowId}`);
    }

    if (window.status !== PauseWindowStatus.ACTIVE) {
      throw new Error(`Window is not in ACTIVE state`);
    }

    const task = await this.getSyncTask(window.syncTaskId);
    if (!task) {
      throw new Error(`Sync task not found: ${window.syncTaskId}`);
    }

    const endTime = new Date().toISOString();
    const updatedWindow = store.updatePauseWindow(windowId, {
      status: PauseWindowStatus.ENDED,
      endTime,
      backlogAtResume: task.backlogStats.totalCount
    })!;

    const updatedTask = store.updateSyncTask(window.syncTaskId, {
      status: SyncTaskStatus.RESUMING,
      currentPauseWindowId: undefined
    })!;

    return { window: updatedWindow, task: updatedTask };
  }

  async cancelPauseWindow(windowId: string): Promise<PauseWindow> {
    const window = await this.getPauseWindow(windowId);
    if (!window) {
      throw new Error(`Pause window not found: ${windowId}`);
    }

    if (window.status === PauseWindowStatus.ENDED) {
      throw new Error(`Cannot cancel an ended window`);
    }

    const updatedWindow = store.updatePauseWindow(windowId, {
      status: PauseWindowStatus.CANCELLED,
      endTime: new Date().toISOString()
    })!;

    if (window.status === PauseWindowStatus.ACTIVE) {
      store.updateSyncTask(window.syncTaskId, {
        status: SyncTaskStatus.ACTIVE,
        currentPauseWindowId: undefined
      });
    }

    return updatedWindow;
  }

  async startRecovery(request: StartRecoveryRequest): Promise<RecoveryAction> {
    const existing = store.getRecoveryActionByIdempotencyKey(request.idempotencyKey);
    if (existing) {
      return existing;
    }

    const task = await this.getSyncTask(request.syncTaskId);
    if (!task) {
      throw new Error(`Sync task not found: ${request.syncTaskId}`);
    }

    const window = await this.getPauseWindow(request.pauseWindowId);
    if (!window) {
      throw new Error(`Pause window not found: ${request.pauseWindowId}`);
    }

    const backlogCount = task.backlogStats.pendingCount;

    const action = store.createRecoveryAction({
      syncTaskId: request.syncTaskId,
      pauseWindowId: request.pauseWindowId,
      batchId: `batch_${Date.now()}`,
      status: RecoveryActionStatus.PENDING,
      totalRecords: backlogCount,
      processedRecords: 0,
      successRecords: 0,
      failedRecords: 0,
      idempotencyKey: request.idempotencyKey,
      createdBy: request.createdBy
    });

    this.processRecovery(action.id, request.batchSize || 100).catch(err => {
      console.error('Recovery processing failed:', err);
    });

    return action;
  }

  private async processRecovery(actionId: string, batchSize: number): Promise<void> {
    const action = store.getRecoveryAction(actionId);
    if (!action) return;

    store.updateRecoveryAction(actionId, {
      status: RecoveryActionStatus.PROCESSING,
      startTime: new Date().toISOString()
    });

    let processed = 0;
    let success = 0;
    let failed = 0;

    while (processed < action.totalRecords) {
      const batch = Math.min(batchSize, action.totalRecords - processed);
      
      for (let i = 0; i < batch; i++) {
        try {
          const shouldFail = Math.random() < 0.1;
          
          if (shouldFail) {
            failed++;
            store.createFailureDetail({
              syncTaskId: action.syncTaskId,
              pauseWindowId: action.pauseWindowId,
              recoveryActionId: actionId,
              failureType: FailureType.PROCESSING_ERROR,
              errorMessage: 'Simulated processing error',
              originalInput: { recordIndex: processed + i, batch: batchSize },
              processingBasis: { recoveryId: actionId, algorithm: 'v1' },
              finalConclusion: 'Record failed during recovery processing',
              resolved: false
            });
          } else {
            success++;
          }
          processed++;
        } catch (err) {
          failed++;
        }
      }

      store.updateRecoveryAction(actionId, {
        processedRecords: processed,
        successRecords: success,
        failedRecords: failed
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    store.updateRecoveryAction(actionId, {
      status: RecoveryActionStatus.COMPLETED,
      endTime: new Date().toISOString(),
      processedRecords: processed,
      successRecords: success,
      failedRecords: failed
    });

    store.updateBacklogStats(action.syncTaskId, {
      pendingCount: 0,
      failedCount: failed
    });

    const task = store.getSyncTask(action.syncTaskId);
    if (task && failed === 0) {
      store.updateSyncTask(action.syncTaskId, {
        status: SyncTaskStatus.ACTIVE
      });
    }
  }

  async getRecoveryAction(id: string): Promise<RecoveryAction | undefined> {
    return store.getRecoveryAction(id);
  }

  async listRecoveryActions(syncTaskId: string): Promise<RecoveryAction[]> {
    return store.listRecoveryActionsByTask(syncTaskId);
  }

  async recordFailure(
    syncTaskId: string,
    failureType: FailureType,
    errorMessage: string,
    originalInput: Record<string, any>,
    processingBasis: Record<string, any>,
    options: {
      pauseWindowId?: string;
      recoveryActionId?: string;
      errorCode?: string;
      stackTrace?: string;
    } = {}
  ): Promise<FailureDetail> {
    return store.createFailureDetail({
      syncTaskId,
      pauseWindowId: options.pauseWindowId,
      recoveryActionId: options.recoveryActionId,
      failureType,
      errorCode: options.errorCode,
      errorMessage,
      originalInput,
      processingBasis,
      stackTrace: options.stackTrace,
      resolved: false
    });
  }

  async getFailureDetail(id: string): Promise<FailureDetail | undefined> {
    return store.getFailureDetail(id);
  }

  async listFailureDetails(syncTaskId: string): Promise<FailureDetail[]> {
    return store.listFailureDetailsByTask(syncTaskId);
  }

  async applyManualCorrection(request: ManualCorrectionRequest): Promise<FailureDetail> {
    const failure = await this.getFailureDetail(request.failureId);
    if (!failure) {
      throw new Error(`Failure not found: ${request.failureId}`);
    }

    if (failure.resolved) {
      throw new Error(`Failure is already resolved`);
    }

    const updatedFailure = store.updateFailureDetail(request.failureId, {
      resolved: true,
      resolvedBy: request.correctedBy,
      resolvedAt: new Date().toISOString(),
      resolutionNote: request.resolutionNote,
      originalInput: {
        ...failure.originalInput,
        correctedInput: request.correctedInput
      },
      finalConclusion: `Manually corrected by ${request.correctedBy}: ${request.resolutionNote}`
    })!;

    if (request.retry) {
      store.updateBacklogStats(failure.syncTaskId, {
        failedCount: Math.max(0, (store.getSyncTask(failure.syncTaskId)?.backlogStats.failedCount || 1) - 1),
        pendingCount: (store.getSyncTask(failure.syncTaskId)?.backlogStats.pendingCount || 0) + 1
      });
    }

    return updatedFailure;
  }

  async updateBacklogStats(
    syncTaskId: string,
    pendingDelta: number = 0,
    processingDelta: number = 0,
    failedDelta: number = 0
  ): Promise<SyncTask | undefined> {
    const task = await this.getSyncTask(syncTaskId);
    if (!task) return undefined;

    const newPending = Math.max(0, task.backlogStats.pendingCount + pendingDelta);
    const newProcessing = Math.max(0, task.backlogStats.processingCount + processingDelta);
    const newFailed = Math.max(0, task.backlogStats.failedCount + failedDelta);

    return store.updateBacklogStats(syncTaskId, {
      pendingCount: newPending,
      processingCount: newProcessing,
      failedCount: newFailed,
      totalCount: newPending + newProcessing + newFailed
    });
  }

  async generateReport(
    syncTaskId: string,
    reportType: SyncReport['reportType'],
    generatedBy: string,
    pauseWindowId?: string
  ): Promise<SyncReport> {
    const task = await this.getSyncTask(syncTaskId);
    if (!task) {
      throw new Error(`Sync task not found: ${syncTaskId}`);
    }

    let window: PauseWindow | undefined;
    if (pauseWindowId) {
      window = await this.getPauseWindow(pauseWindowId);
    }

    const recoveries = await this.listRecoveryActions(syncTaskId);
    const failures = await this.listFailureDetails(syncTaskId);

    const failuresByType: Record<string, number> = {};
    for (const f of failures) {
      failuresByType[f.failureType] = (failuresByType[f.failureType] || 0) + 1;
    }

    const reportContent: SyncReport['content'] = {
      taskOverview: {
        taskName: task.name,
        status: task.status,
        sourceSystem: task.sourceSystem,
        targetSystem: task.targetSystem
      },
      failures: {
        totalCount: failures.length,
        byType: failuresByType,
        unresolvedCount: failures.filter(f => !f.resolved).length
      },
      backlogSummary: task.backlogStats
    };

    if (window) {
      let duration: number | undefined;
      if (window.endTime) {
        duration = new Date(window.endTime).getTime() - new Date(window.startTime).getTime();
      }
      reportContent.pauseWindow = {
        name: window.name,
        reason: window.reason,
        startTime: window.startTime,
        endTime: window.endTime,
        duration,
        backlogAtPause: window.backlogAtPause,
        backlogAtResume: window.backlogAtResume,
        backlogProcessed: window.backlogAtResume !== undefined
          ? window.backlogAtResume - window.backlogAtPause
          : undefined
      };
    }

    if (recoveries.length > 0) {
      reportContent.recoveryStats = {
        totalActions: recoveries.length,
        totalRecords: recoveries.reduce((sum, r) => sum + r.totalRecords, 0),
        successRecords: recoveries.reduce((sum, r) => sum + r.successRecords, 0),
        failedRecords: recoveries.reduce((sum, r) => sum + r.failedRecords, 0),
        averageProcessingTime: undefined
      };
    }

    return store.createSyncReport({
      syncTaskId,
      pauseWindowId,
      reportType,
      generatedBy,
      content: reportContent
    });
  }

  async exportReportToJson(reportId: string, exportDir: string = './exports'): Promise<string> {
    const report = store.getSyncReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, `report_${reportId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    store.updateSyncReport(reportId, {
      exportFormat: 'JSON',
      filePath
    });

    return filePath;
  }

  async exportReportToCsv(reportId: string, exportDir: string = './exports'): Promise<string> {
    const report = store.getSyncReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const content = report.content;
    let csv = 'Category,Field,Value\n';
    
    csv += `Task,Name,${content.taskOverview.taskName}\n`;
    csv += `Task,Status,${content.taskOverview.status}\n`;
    csv += `Task,SourceSystem,${content.taskOverview.sourceSystem}\n`;
    csv += `Task,TargetSystem,${content.taskOverview.targetSystem}\n`;
    
    if (content.pauseWindow) {
      csv += `PauseWindow,Name,${content.pauseWindow.name}\n`;
      csv += `PauseWindow,Reason,${content.pauseWindow.reason}\n`;
      csv += `PauseWindow,StartTime,${content.pauseWindow.startTime}\n`;
      csv += `PauseWindow,BacklogAtPause,${content.pauseWindow.backlogAtPause}\n`;
    }

    csv += `Backlog,Total,${content.backlogSummary.totalCount}\n`;
    csv += `Backlog,Pending,${content.backlogSummary.pendingCount}\n`;
    csv += `Backlog,Processing,${content.backlogSummary.processingCount}\n`;
    csv += `Backlog,Failed,${content.backlogSummary.failedCount}\n`;
    
    csv += `Failures,Total,${content.failures.totalCount}\n`;
    csv += `Failures,Unresolved,${content.failures.unresolvedCount}\n`;

    const filePath = path.join(exportDir, `report_${reportId}.csv`);
    fs.writeFileSync(filePath, csv, 'utf-8');

    store.updateSyncReport(reportId, {
      exportFormat: 'CSV',
      filePath
    });

    return filePath;
  }

  async getSyncReport(id: string): Promise<SyncReport | undefined> {
    return store.getSyncReport(id);
  }

  async listSyncReports(syncTaskId: string): Promise<SyncReport[]> {
    return store.listSyncReportsByTask(syncTaskId);
  }
}

export const syncService = new SyncPauseService();
