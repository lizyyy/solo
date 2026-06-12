import { DataStore } from '../store/DataStore';
import { BOUNDARY_RULES } from '../constants/boundaryRules';
import { getHumanReadableError } from '../constants/errorMessages';
import {
  WorkflowStep,
  ApprovalStatus,
  DisplayMode,
  HumanReadableError,
  ApprovalRecord,
  Snapshot
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

  initializeWorkflow(trackId: string, createdBy: string, importBatchId?: string): ApprovalRecord {
    return this.store.createApprovalRecord({
      trackId,
      status: ApprovalStatus.PENDING,
      currentStep: WorkflowStep.ALIAS_IMPORT,
      displayMode: DisplayMode.LIST,
      remarks: '曲目别名表已导入，等待审批',
      reviewedBy: undefined,
      reviewedAt: undefined,
      importBatchId
    });
  }

  takeSnapshot(approvalId: string, createdBy: string): Snapshot | undefined {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) return undefined;

    const remarks = this.store.getTrackRemarksByTrackId(approval.trackId);
    const trackRemarkSnapshots = remarks.map(r => ({
      id: r.id,
      content: r.content,
      hasReworkReason: r.hasReworkReason,
      reworkReason: r.reworkReason
    }));

    return this.store.createSnapshot({
      approvalId,
      step: approval.currentStep,
      status: approval.status,
      trackRemarkSnapshots,
      importBatchId: approval.importBatchId,
      createdBy
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

    const snapshot = this.takeSnapshot(approvalId, operator);

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
        '工作流推进',
        approval.importBatchId,
        'approval_record',
        approvalId,
        snapshot?.id
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
      const snapshot = this.takeSnapshot(approvalId, operator);
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
          '审批完成，标记为正常',
          approval.importBatchId,
          'approval_record',
          approvalId,
          snapshot?.id
        );
      }
    } else {
      const nextStep = steps[currentIndex + 1] as WorkflowStep;
      return this.advanceStep(approvalId, nextStep, operator);
    }

    return { success: true, record: updated };
  }

  executeRollback(
    approvalId: string,
    operator: string,
    reason: string
  ): { success: boolean; record?: ApprovalRecord; restoredRemarks?: number; error?: HumanReadableError } {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    if (approval.status === ApprovalStatus.NORMAL) {
      return { success: false, error: getHumanReadableError('cannot_rollback_normal') };
    }

    if (!this.rulesEngine.canRollback(approval.status)) {
      return { success: false, error: getHumanReadableError('invalid_status_transition') };
    }

    const snapshot = this.store.getLatestSnapshotForApproval(approvalId);
    if (!snapshot) {
      return { success: false, error: getHumanReadableError('rollback_no_snapshot') };
    }

    let restoredRemarks = 0;
    for (const remarkSnapshot of snapshot.trackRemarkSnapshots) {
      const currentRemark = this.store.getTrackRemark(remarkSnapshot.id);
      if (currentRemark) {
        this.store.updateTrackRemark(remarkSnapshot.id, {
          content: remarkSnapshot.content,
          hasReworkReason: remarkSnapshot.hasReworkReason,
          reworkReason: remarkSnapshot.reworkReason
        });
        restoredRemarks++;
      }
    }

    const oldStatus = approval.status;
    const oldStep = approval.currentStep;
    const updated = this.store.updateApprovalRecord(approvalId, {
      status: snapshot.status,
      currentStep: snapshot.step
    });

    if (updated) {
      this.historyService.recordChange(
        'approval_record',
        approvalId,
        'status',
        oldStatus,
        snapshot.status,
        operator,
        `回滚: ${reason}`,
        approval.importBatchId,
        'approval_record',
        approvalId,
        snapshot.id
      );
      this.historyService.recordChange(
        'approval_record',
        approvalId,
        'currentStep',
        oldStep,
        snapshot.step,
        operator,
        `回滚: ${reason}`,
        approval.importBatchId,
        'approval_record',
        approvalId,
        snapshot.id
      );
    }

    return { success: true, record: updated, restoredRemarks };
  }

  applyForRework(
    approvalId: string,
    reason: string,
    appliedBy: string
  ): { success: boolean; error?: HumanReadableError } {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    if (!reason || reason.trim() === '') {
      return { success: false, error: getHumanReadableError('rework_application_reason_required') };
    }

    const existingApps = this.store.getReworkApplicationsByApproval(approvalId);
    const pendingApp = existingApps.find(a => a.status === 'pending_review');
    if (pendingApp) {
      return { success: false, error: getHumanReadableError('rework_application_already_exists') };
    }

    this.store.createReworkApplication({
      approvalId,
      trackId: approval.trackId,
      reason,
      appliedBy,
      previousStatus: approval.status,
      status: 'pending_review'
    });

    return { success: true };
  }

  approveReworkApplication(
    applicationId: string,
    approvedBy: string
  ): { success: boolean; error?: HumanReadableError } {
    const app = this.store.getReworkApplication(applicationId);
    if (!app) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    this.store.updateReworkApplication(applicationId, { status: 'approved' });

    const snapshot = this.takeSnapshot(app.approvalId, approvedBy);

    const oldStatus = app.previousStatus;
    this.store.updateApprovalRecord(app.approvalId, {
      status: ApprovalStatus.REWORK_REQUIRED
    });

    this.historyService.recordChange(
      'approval_record',
      app.approvalId,
      'status',
      oldStatus,
      ApprovalStatus.REWORK_REQUIRED,
      approvedBy,
      `返工申请已批准: ${app.reason}`,
      undefined,
      'approval_record',
      app.approvalId,
      snapshot?.id
    );

    return { success: true };
  }

  rejectReworkApplication(
    applicationId: string,
    rejectedBy: string
  ): { success: boolean; error?: HumanReadableError } {
    const app = this.store.getReworkApplication(applicationId);
    if (!app) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    this.store.updateReworkApplication(applicationId, { status: 'rejected' });
    return { success: true };
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

    if (approval.currentStep === WorkflowStep.REHEARSAL_UPDATE && BOUNDARY_RULES.workflow.requireRehearsalUpdate) {
      const changes = this.store.getRehearsalChangesByTrack(approval.trackId);
      if (changes.length === 0) {
        blockers.push(getHumanReadableError('missing_rehearsal_change'));
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
