import { DataStore } from '../store/DataStore';
import { BOUNDARY_RULES } from '../constants/boundaryRules';
import { getHumanReadableError } from '../constants/errorMessages';
import {
  WorkflowStep,
  ApprovalStatus,
  DisplayMode,
  HumanReadableError,
  ApprovalRecord
} from '../types';
import { BoundaryRulesEngine } from './BoundaryRulesEngine';
import { ChangeHistoryService } from './ChangeHistoryService';

export class WorkflowEngine {
  private store: DataStore;
  private rulesEngine: BoundaryRulesEngine;
  private historyService: ChangeHistoryService;

  constructor() {
    this.store = DataStore.getInstance();
    this.rulesEngine = new BoundaryRulesEngine();
    this.historyService = new ChangeHistoryService();
  }

  initializeWorkflow(trackId: string, createdBy: string): ApprovalRecord {
    return this.store.createApprovalRecord({
      trackId,
      status: ApprovalStatus.PENDING,
      currentStep: WorkflowStep.ALIAS_IMPORT,
      displayMode: DisplayMode.LIST,
      remarks: '曲目别名表已导入，等待审批',
      reviewedBy: undefined,
      reviewedAt: undefined
    });
  }

  advanceStep(
    approvalId: string,
    nextStep: WorkflowStep,
    operator: string
  ): { success: boolean; record?: ApprovalRecord; error?: HumanReadableError } {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    const steps = BOUNDARY_RULES.workflow.steps;
    const currentIndex = steps.indexOf(approval.currentStep);
    const nextIndex = steps.indexOf(nextStep);

    if (nextIndex !== currentIndex + 1) {
      return { success: false, error: getHumanReadableError('invalid_status_transition') };
    }

    if (BOUNDARY_RULES.reworkReason.preventAutoNormal) {
      const hasRework = this.store.hasReworkReasonForTrack(approval.trackId);
      if (hasRework) {
        return { success: false, error: getHumanReadableError('rework_reason_pending') };
      }
    }

    if (nextStep === WorkflowStep.PHOTO_REVIEW && BOUNDARY_RULES.workflow.requirePhotoReview) {
      const photos = this.store.getCheckinPhotosByTrack(approval.trackId);
      const hasReviewedPhoto = photos.some(p => p.reviewed);
      if (!hasReviewedPhoto) {
        return { success: false, error: getHumanReadableError('missing_checkin_photo') };
      }
    }

    const oldStep = approval.currentStep;
    const updated = this.store.updateApprovalRecord(approvalId, {
      currentStep: nextStep,
      status: ApprovalStatus.REVIEWING
    });

    if (updated) {
      this.historyService.recordChange(
        'approval_record',
        approvalId,
        'currentStep',
        oldStep,
        nextStep,
        operator,
        '工作流推进'
      );
    }

    return { success: true, record: updated };
  }

  completeStep(
    approvalId: string,
    operator: string,
    remarks?: string
  ): { success: boolean; record?: ApprovalRecord; error?: HumanReadableError } {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    const steps = BOUNDARY_RULES.workflow.steps;
    const currentIndex = steps.indexOf(approval.currentStep);
    const isLastStep = currentIndex === steps.length - 1;

    const now = this.store.now();
    let updated: ApprovalRecord | undefined;

    if (isLastStep) {
      if (!this.rulesEngine.canMarkNormal(approval, operator)) {
        return { success: false, error: getHumanReadableError('rework_reason_pending') };
      }
      const oldStatus = approval.status;
      updated = this.store.updateApprovalRecord(approvalId, {
        status: ApprovalStatus.NORMAL,
        reviewedBy: operator,
        reviewedAt: now,
        remarks: remarks || approval.remarks
      });
      if (updated) {
        this.historyService.recordChange(
          'approval_record',
          approvalId,
          'status',
          oldStatus,
          ApprovalStatus.NORMAL,
          operator,
          '审批完成，标记为正常'
        );
      }
    } else {
      const nextStep = steps[currentIndex + 1] as WorkflowStep;
      return this.advanceStep(approvalId, nextStep, operator);
    }

    return { success: true, record: updated };
  }

  getCurrentStepInfo(approvalId: string): {
    step: WorkflowStep;
    stepName: string;
    canAdvance: boolean;
    blockers: HumanReadableError[];
  } | undefined {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) return undefined;

    const blockers: HumanReadableError[] = [];

    const hasRework = this.store.hasReworkReasonForTrack(approval.trackId);
    if (hasRework) {
      blockers.push(getHumanReadableError('rework_reason_pending'));
    }

    if (approval.currentStep === WorkflowStep.PHOTO_REVIEW && BOUNDARY_RULES.workflow.requirePhotoReview) {
      const photos = this.store.getCheckinPhotosByTrack(approval.trackId);
      const hasReviewedPhoto = photos.some(p => p.reviewed);
      if (!hasReviewedPhoto) {
        blockers.push(getHumanReadableError('missing_checkin_photo'));
      }
    }

    const stepNames: Record<WorkflowStep, string> = {
      [WorkflowStep.ALIAS_IMPORT]: '曲目别名表导入',
      [WorkflowStep.PHOTO_REVIEW]: '课时签到照片复核',
      [WorkflowStep.REHEARSAL_UPDATE]: '排练变更记录更新'
    };

    return {
      step: approval.currentStep,
      stepName: stepNames[approval.currentStep],
      canAdvance: blockers.length === 0,
      blockers
    };
  }

  getAllApprovals(): ApprovalRecord[] {
    return this.store.getAllApprovalRecords();
  }

  getApproval(id: string): ApprovalRecord | undefined {
    return this.store.getApprovalRecord(id);
  }

  getApprovalByTrackId(trackId: string): ApprovalRecord | undefined {
    return this.store.getApprovalRecordByTrackId(trackId);
  }
}
