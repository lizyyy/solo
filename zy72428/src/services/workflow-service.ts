import { dataStore } from '../store/data-store';
import {
  WorkflowState,
  WorkflowStep,
  MaterialSource,
  WorkflowState as WorkflowStateType,
  UserMessage,
  ConflictEvidence,
  TrackChecklistItem,
} from '../types';
import { aliasImportService, AliasImportInput } from './alias-import-service';
import { photoReviewService, PhotoUploadInput } from './photo-review-service';
import { scheduleImportService, ScheduleImportInput } from './schedule-import-service';
import { checklistService } from './checklist-service';
import { createInfoMessage, createWarningMessage, ErrorMessages } from '../utils/messages';

export class WorkflowService {
  startWorkflow(source: MaterialSource): WorkflowState {
    const batchId = dataStore.generateBatchId();
    const state: WorkflowState = {
      currentStep: 'alias-import',
      batchId,
      source,
      aliasImported: false,
      photosReviewed: false,
      checklistUpdated: false,
      pendingConflicts: [],
      pendingLeaveReviews: [],
      messages: [
        createInfoMessage(
          `开始处理${this.getSourceText(source)}，当前步骤：第一步 - 导入曲目别名表`
        ),
      ],
    };
    dataStore.saveWorkflowState(state);
    return state;
  }

  step1_ImportAliases(
    batchId: string,
    aliasInputs: AliasImportInput[],
    scheduleInputs: ScheduleImportInput[]
  ): WorkflowStateType {
    const state = this.getState(batchId);
    if (state.currentStep !== 'alias-import') {
      throw new Error('当前不在别名导入步骤，请按顺序执行');
    }

    const aliasResult = aliasImportService.importAliases(aliasInputs);
    const scheduleResult = scheduleImportService.importSchedule(scheduleInputs);

    const messages: UserMessage[] = [...state.messages];
    messages.push(...aliasResult.warnings, ...scheduleResult.warnings);

    if (aliasResult.reused.length > 0) {
      messages.push(
        createInfoMessage(
          `曲目别名表复用 ${aliasResult.reused.length} 条已有记录，新增 ${aliasResult.imported.length} 条`
        )
      );
    }

    if (scheduleResult.duplicates.length > 0) {
      messages.push(
        createWarningMessage(
          ErrorMessages.duplicateImport(scheduleResult.duplicates.length).message,
          ErrorMessages.duplicateImport(scheduleResult.duplicates.length).suggestion
        )
      );
    }

    const updatedState: WorkflowStateType = {
      ...state,
      currentStep: 'photo-review',
      aliasImported: true,
      messages,
    };

    dataStore.saveWorkflowState(updatedState);
    return updatedState;
  }

  step2_ReviewPhotos(
    batchId: string,
    photoInputs: PhotoUploadInput[]
  ): WorkflowStateType {
    const state = this.getState(batchId);
    if (state.currentStep !== 'photo-review') {
      throw new Error('当前不在照片审核步骤，请按顺序执行');
    }

    const photoResult = photoReviewService.uploadPhotos(photoInputs);
    const messages: UserMessage[] = [...state.messages];

    for (const warning of photoResult.warnings) {
      messages.push(createWarningMessage(warning));
    }

    const leaveIssues = photoReviewService.identifyLeaveCountedAsConsumed();
    if (leaveIssues.length > 0) {
      messages.push(
        createWarningMessage(
          ErrorMessages.coordinatorReviewRequired(leaveIssues.length).message,
          ErrorMessages.coordinatorReviewRequired(leaveIssues.length).suggestion
        )
      );
    }

    if (state.source === 'supplement') {
      messages.push(
        createWarningMessage(
          ErrorMessages.supplementRecalculateNeeded().message,
          ErrorMessages.supplementRecalculateNeeded().suggestion
        )
      );
    }

    const updatedState: WorkflowStateType = {
      ...state,
      currentStep: 'checklist-update',
      photosReviewed: true,
      messages,
    };

    dataStore.saveWorkflowState(updatedState);
    return updatedState;
  }

  step3_UpdateChecklist(
    batchId: string
  ): {
    state: WorkflowStateType;
    conflicts: ConflictEvidence[];
    pendingLeaveReviews: TrackChecklistItem[];
  } {
    const state = this.getState(batchId);
    if (state.currentStep !== 'checklist-update') {
      throw new Error('当前不在核对表更新步骤，请按顺序执行');
    }

    const result = checklistService.generateChecklist(state.source);
    const messages: UserMessage[] = [...state.messages];

    if (result.conflicts.length > 0) {
      messages.push(
        createWarningMessage(
          `发现 ${result.conflicts.length} 条冲突记录，请逐一确认或驳回`,
          '对于曲目名称冲突，由版权运营小鹿确认；对于请假课时冲突，需巡演统筹复核'
        )
      );
    }

    if (result.pendingLeaveReviews.length > 0) {
      messages.push(
        createWarningMessage(
          `有 ${result.pendingLeaveReviews.length} 条请假记录待巡演统筹复核`,
          '请假课时不要直接归为正常，请联系巡演统筹确认后再处理'
        )
      );
    }

    if (state.source === 'supplement') {
      const schedules = dataStore.getAllScheduleRecords().filter(
        (s) => s.source === 'supplement' && s.importBatchId === batchId
      );
      for (const schedule of schedules) {
        scheduleImportService.recalculateConsumedHours(schedule.importBatchId);
      }
      messages.push(createInfoMessage('补录材料已自动重新计算课时消耗'));
    }

    const updatedState: WorkflowStateType = {
      ...state,
      checklistUpdated: true,
      pendingConflicts: result.conflicts,
      pendingLeaveReviews: result.pendingLeaveReviews,
      messages,
    };

    dataStore.saveWorkflowState(updatedState);

    return {
      state: updatedState,
      conflicts: result.conflicts,
      pendingLeaveReviews: result.pendingLeaveReviews,
    };
  }

  resolveConflict(
    batchId: string,
    checklistItemId: string,
    confirmed: boolean,
    resolverName: string
  ): WorkflowStateType {
    const state = this.getState(batchId);
    const itemBefore = dataStore.getChecklistItem(checklistItemId);
    const updated = checklistService.resolveConflict(checklistItemId, confirmed, resolverName);

    if (!updated) {
      return state;
    }

    const messages: UserMessage[] = [...state.messages];
    messages.push(
      createInfoMessage(
        `${resolverName} 已${confirmed ? '确认' : '驳回'}冲突：${updated.performerName} ${updated.sessionDate.toLocaleDateString()}`
      )
    );

    const resolvedConflictId = itemBefore?.conflictId || updated.conflictId;
    const pendingConflicts = resolvedConflictId
      ? state.pendingConflicts.filter((c) => c.id !== resolvedConflictId)
      : state.pendingConflicts;

    const pendingLeaveReviews = state.pendingLeaveReviews.filter(
      (r) => r.id !== checklistItemId
    );

    const updatedState: WorkflowStateType = {
      ...state,
      pendingConflicts,
      pendingLeaveReviews,
      messages,
    };

    dataStore.saveWorkflowState(updatedState);
    return updatedState;
  }

  reviewLeaveByCoordinator(
    batchId: string,
    checklistItemId: string,
    coordinatorName: string
  ): WorkflowStateType {
    const state = this.getState(batchId);
    const itemBefore = dataStore.getChecklistItem(checklistItemId);
    const updated = checklistService.reviewLeaveItem(checklistItemId, coordinatorName);

    if (!updated) {
      return state;
    }

    const messages: UserMessage[] = [...state.messages];
    messages.push(
      createInfoMessage(
        `巡演统筹 ${coordinatorName} 已复核请假记录：${updated.performerName} ${updated.sessionDate.toLocaleDateString()}`
      )
    );

    const resolvedConflictId = itemBefore?.conflictId;
    const pendingConflicts = resolvedConflictId
      ? state.pendingConflicts.filter((c) => c.id !== resolvedConflictId)
      : state.pendingConflicts;

    const pendingLeaveReviews = state.pendingLeaveReviews.filter(
      (r) => r.id !== checklistItemId
    );

    const updatedState: WorkflowStateType = {
      ...state,
      pendingConflicts,
      pendingLeaveReviews,
      messages,
    };

    dataStore.saveWorkflowState(updatedState);
    return updatedState;
  }

  canComplete(batchId: string): { canComplete: boolean; reason?: string } {
    const state = this.getState(batchId);

    if (!state.aliasImported) {
      return { canComplete: false, reason: '尚未导入曲目别名表' };
    }
    if (!state.photosReviewed) {
      return { canComplete: false, reason: '尚未审核课时签到照片' };
    }
    if (!state.checklistUpdated) {
      return { canComplete: false, reason: '尚未更新曲目核对表' };
    }

    const stillPending = checklistService.getPendingConflictIds();
    if (stillPending.length > 0) {
      return {
        canComplete: false,
        reason: `还有 ${stillPending.length} 条冲突待确认/驳回`,
      };
    }

    const pendingLeave = dataStore
      .getAllChecklistItems()
      .filter((item) => item.isLeave && item.leaveReviewStatus === 'pending');
    if (pendingLeave.length > 0) {
      return {
        canComplete: false,
        reason: `还有 ${pendingLeave.length} 条请假记录待巡演统筹复核`,
      };
    }

    return { canComplete: true };
  }

  getState(batchId: string): WorkflowStateType {
    const state = dataStore.getWorkflowState(batchId);
    if (!state) {
      throw new Error(`工作流不存在：${batchId}`);
    }
    return state;
  }

  formatState(state: WorkflowStateType): string {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push(`工作流批次：${state.batchId}`);
    lines.push(`数据来源：${this.getSourceText(state.source)}`);
    lines.push(`当前步骤：${this.getStepText(state.currentStep)}`);
    lines.push('-'.repeat(60));
    lines.push(`步骤进度：`);
    lines.push(`  ${state.aliasImported ? '✅' : '⬜'} 第一步：导入曲目别名表`);
    lines.push(`  ${state.photosReviewed ? '✅' : '⬜'} 第二步：审核课时签到照片`);
    lines.push(`  ${state.checklistUpdated ? '✅' : '⬜'} 第三步：更新曲目核对表`);
    lines.push('-'.repeat(60));

    const stillPending = checklistService.getPendingConflictIds();
    lines.push(`待处理冲突：${stillPending.length} 条`);
    const pendingLeave = dataStore
      .getAllChecklistItems()
      .filter((item) => item.isLeave && item.leaveReviewStatus === 'pending');
    lines.push(`待统筹复核：${pendingLeave.length} 条`);

    if (stillPending.length > 0 || pendingLeave.length > 0) {
      lines.push('');
      lines.push('⚠️  未完成项：');
      if (stillPending.length > 0) {
        lines.push(`  - 还有 ${stillPending.length} 条冲突待确认/驳回`);
      }
      if (pendingLeave.length > 0) {
        lines.push(`  - 还有 ${pendingLeave.length} 条请假记录待巡演统筹复核`);
      }
    }

    lines.push('-'.repeat(60));
    lines.push('消息记录：');
    for (const msg of state.messages.slice(-5)) {
      const icon = msg.level === 'error' ? '❌' : msg.level === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} ${msg.message}`);
      if (msg.suggestion) {
        lines.push(`     建议：${msg.suggestion}`);
      }
    }
    lines.push('='.repeat(60));
    return lines.join('\n');
  }

  private getStepText(step: WorkflowStep): string {
    const map = {
      'alias-import': '第一步 - 导入曲目别名表',
      'photo-review': '第二步 - 审核课时签到照片',
      'checklist-update': '第三步 - 更新曲目核对表',
    };
    return map[step];
  }

  private getSourceText(source: MaterialSource): string {
    const map = {
      normal: '正常材料',
      'wrong-caliber': '错口径材料',
      supplement: '补录材料',
    };
    return map[source];
  }
}

export const workflowService = new WorkflowService();
