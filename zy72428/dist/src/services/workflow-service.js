"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowService = exports.WorkflowService = void 0;
const data_store_1 = require("../store/data-store");
const alias_import_service_1 = require("./alias-import-service");
const photo_review_service_1 = require("./photo-review-service");
const schedule_import_service_1 = require("./schedule-import-service");
const checklist_service_1 = require("./checklist-service");
const messages_1 = require("../utils/messages");
class WorkflowService {
    startWorkflow(source) {
        const batchId = data_store_1.dataStore.generateBatchId();
        const state = {
            currentStep: 'alias-import',
            batchId,
            source,
            aliasImported: false,
            photosReviewed: false,
            checklistUpdated: false,
            pendingConflicts: [],
            pendingLeaveReviews: [],
            messages: [
                (0, messages_1.createInfoMessage)(`开始处理${this.getSourceText(source)}，当前步骤：第一步 - 导入曲目别名表`),
            ],
        };
        data_store_1.dataStore.saveWorkflowState(state);
        return state;
    }
    step1_ImportAliases(batchId, aliasInputs, scheduleInputs) {
        const state = this.getState(batchId);
        if (state.currentStep !== 'alias-import') {
            throw new Error('当前不在别名导入步骤，请按顺序执行');
        }
        const aliasResult = alias_import_service_1.aliasImportService.importAliases(aliasInputs);
        const scheduleResult = schedule_import_service_1.scheduleImportService.importSchedule(scheduleInputs);
        const messages = [...state.messages];
        messages.push(...aliasResult.warnings, ...scheduleResult.warnings);
        if (aliasResult.reused.length > 0) {
            messages.push((0, messages_1.createInfoMessage)(`曲目别名表复用 ${aliasResult.reused.length} 条已有记录，新增 ${aliasResult.imported.length} 条`));
        }
        if (scheduleResult.duplicates.length > 0) {
            messages.push((0, messages_1.createWarningMessage)(messages_1.ErrorMessages.duplicateImport(scheduleResult.duplicates.length).message, messages_1.ErrorMessages.duplicateImport(scheduleResult.duplicates.length).suggestion));
        }
        const updatedState = {
            ...state,
            currentStep: 'photo-review',
            aliasImported: true,
            messages,
        };
        data_store_1.dataStore.saveWorkflowState(updatedState);
        return updatedState;
    }
    step2_ReviewPhotos(batchId, photoInputs) {
        const state = this.getState(batchId);
        if (state.currentStep !== 'photo-review') {
            throw new Error('当前不在照片审核步骤，请按顺序执行');
        }
        const photoResult = photo_review_service_1.photoReviewService.uploadPhotos(photoInputs);
        const messages = [...state.messages];
        for (const warning of photoResult.warnings) {
            messages.push((0, messages_1.createWarningMessage)(warning));
        }
        const leaveIssues = photo_review_service_1.photoReviewService.identifyLeaveCountedAsConsumed();
        if (leaveIssues.length > 0) {
            messages.push((0, messages_1.createWarningMessage)(messages_1.ErrorMessages.coordinatorReviewRequired(leaveIssues.length).message, messages_1.ErrorMessages.coordinatorReviewRequired(leaveIssues.length).suggestion));
        }
        if (state.source === 'supplement') {
            messages.push((0, messages_1.createWarningMessage)(messages_1.ErrorMessages.supplementRecalculateNeeded().message, messages_1.ErrorMessages.supplementRecalculateNeeded().suggestion));
        }
        const updatedState = {
            ...state,
            currentStep: 'checklist-update',
            photosReviewed: true,
            messages,
        };
        data_store_1.dataStore.saveWorkflowState(updatedState);
        return updatedState;
    }
    step3_UpdateChecklist(batchId) {
        const state = this.getState(batchId);
        if (state.currentStep !== 'checklist-update') {
            throw new Error('当前不在核对表更新步骤，请按顺序执行');
        }
        const result = checklist_service_1.checklistService.generateChecklist(state.source);
        const messages = [...state.messages];
        if (result.conflicts.length > 0) {
            messages.push((0, messages_1.createWarningMessage)(`发现 ${result.conflicts.length} 条冲突记录，请逐一确认或驳回`, '对于曲目名称冲突，由版权运营小鹿确认；对于请假课时冲突，需巡演统筹复核'));
        }
        if (result.pendingLeaveReviews.length > 0) {
            messages.push((0, messages_1.createWarningMessage)(`有 ${result.pendingLeaveReviews.length} 条请假记录待巡演统筹复核`, '请假课时不要直接归为正常，请联系巡演统筹确认后再处理'));
        }
        if (state.source === 'supplement') {
            const schedules = data_store_1.dataStore.getAllScheduleRecords().filter((s) => s.source === 'supplement' && s.importBatchId === batchId);
            for (const schedule of schedules) {
                schedule_import_service_1.scheduleImportService.recalculateConsumedHours(schedule.importBatchId);
            }
            messages.push((0, messages_1.createInfoMessage)('补录材料已自动重新计算课时消耗'));
        }
        const updatedState = {
            ...state,
            checklistUpdated: true,
            pendingConflicts: result.conflicts,
            pendingLeaveReviews: result.pendingLeaveReviews,
            messages,
        };
        data_store_1.dataStore.saveWorkflowState(updatedState);
        return {
            state: updatedState,
            conflicts: result.conflicts,
            pendingLeaveReviews: result.pendingLeaveReviews,
        };
    }
    resolveConflict(batchId, checklistItemId, confirmed, resolverName) {
        const state = this.getState(batchId);
        const itemBefore = data_store_1.dataStore.getChecklistItem(checklistItemId);
        const updated = checklist_service_1.checklistService.resolveConflict(checklistItemId, confirmed, resolverName);
        if (!updated) {
            return state;
        }
        const messages = [...state.messages];
        messages.push((0, messages_1.createInfoMessage)(`${resolverName} 已${confirmed ? '确认' : '驳回'}冲突：${updated.performerName} ${updated.sessionDate.toLocaleDateString()}`));
        const resolvedConflictId = itemBefore?.conflictId || updated.conflictId;
        const pendingConflicts = resolvedConflictId
            ? state.pendingConflicts.filter((c) => c.id !== resolvedConflictId)
            : state.pendingConflicts;
        const pendingLeaveReviews = state.pendingLeaveReviews.filter((r) => r.id !== checklistItemId);
        const updatedState = {
            ...state,
            pendingConflicts,
            pendingLeaveReviews,
            messages,
        };
        data_store_1.dataStore.saveWorkflowState(updatedState);
        return updatedState;
    }
    reviewLeaveByCoordinator(batchId, checklistItemId, coordinatorName) {
        const state = this.getState(batchId);
        const itemBefore = data_store_1.dataStore.getChecklistItem(checklistItemId);
        const updated = checklist_service_1.checklistService.reviewLeaveItem(checklistItemId, coordinatorName);
        if (!updated) {
            return state;
        }
        const messages = [...state.messages];
        messages.push((0, messages_1.createInfoMessage)(`巡演统筹 ${coordinatorName} 已复核请假记录：${updated.performerName} ${updated.sessionDate.toLocaleDateString()}`));
        const resolvedConflictId = itemBefore?.conflictId;
        const pendingConflicts = resolvedConflictId
            ? state.pendingConflicts.filter((c) => c.id !== resolvedConflictId)
            : state.pendingConflicts;
        const pendingLeaveReviews = state.pendingLeaveReviews.filter((r) => r.id !== checklistItemId);
        const updatedState = {
            ...state,
            pendingConflicts,
            pendingLeaveReviews,
            messages,
        };
        data_store_1.dataStore.saveWorkflowState(updatedState);
        return updatedState;
    }
    canComplete(batchId) {
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
        const stillPending = checklist_service_1.checklistService.getPendingConflictIds();
        if (stillPending.length > 0) {
            return {
                canComplete: false,
                reason: `还有 ${stillPending.length} 条冲突待确认/驳回`,
            };
        }
        const pendingLeave = data_store_1.dataStore
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
    getState(batchId) {
        const state = data_store_1.dataStore.getWorkflowState(batchId);
        if (!state) {
            throw new Error(`工作流不存在：${batchId}`);
        }
        return state;
    }
    formatState(state) {
        const lines = [];
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
        const stillPending = checklist_service_1.checklistService.getPendingConflictIds();
        lines.push(`待处理冲突：${stillPending.length} 条`);
        const pendingLeave = data_store_1.dataStore
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
    getStepText(step) {
        const map = {
            'alias-import': '第一步 - 导入曲目别名表',
            'photo-review': '第二步 - 审核课时签到照片',
            'checklist-update': '第三步 - 更新曲目核对表',
        };
        return map[step];
    }
    getSourceText(source) {
        const map = {
            normal: '正常材料',
            'wrong-caliber': '错口径材料',
            supplement: '补录材料',
        };
        return map[source];
    }
}
exports.WorkflowService = WorkflowService;
exports.workflowService = new WorkflowService();
