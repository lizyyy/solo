import { DataStore } from '../store/DataStore';
import { ImportService, ImportTrackData } from './ImportService';
import { BoundaryRulesEngine } from './BoundaryRulesEngine';
import { WorkflowEngine } from './WorkflowEngine';
import { DisplayModeService } from './DisplayModeService';
import { ChangeHistoryService } from './ChangeHistoryService';
import { getHumanReadableError } from '../constants/errorMessages';
import {
  ApprovalStatus,
  WorkflowStep,
  DisplayMode,
  HumanReadableError,
  ApprovalRecord,
  TrackRemark,
  ClassCheckinPhoto,
  RehearsalChangeRecord
} from '../types';

export class ApprovalService {
  private store: DataStore;
  private importService: ImportService;
  private rulesEngine: BoundaryRulesEngine;
  private workflowEngine: WorkflowEngine;
  private displayModeService: DisplayModeService;
  private historyService: ChangeHistoryService;

  constructor() {
    this.store = DataStore.getInstance();
    this.importService = new ImportService();
    this.rulesEngine = new BoundaryRulesEngine();
    this.workflowEngine = new WorkflowEngine();
    this.displayModeService = new DisplayModeService();
    this.historyService = new ChangeHistoryService();
  }

  importTrackAliases(
    batchIdentifier: string,
    trackDataList: ImportTrackData[],
    importedBy: string
  ) {
    const result = this.importService.importTrackAliases(batchIdentifier, trackDataList, importedBy);
    
    for (const track of result.importedTracks) {
      this.workflowEngine.initializeWorkflow(track.trackId, importedBy);
    }
    
    return result;
  }

  addTrackRemark(
    trackId: string,
    content: string,
    createdBy: string
  ): {
    success: boolean;
    remark?: TrackRemark;
    warning?: HumanReadableError;
    error?: HumanReadableError;
  } {
    const alias = this.store.getTrackAliasByTrackId(trackId);
    if (!alias) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    const result = this.rulesEngine.processTrackRemark(trackId, content, createdBy);

    if (result.approvalImpact.shouldSetReworkRequired) {
      const approval = this.store.getApprovalRecordByTrackId(trackId);
      if (approval) {
        const oldStatus = approval.status;
        this.store.updateApprovalRecord(approval.id, {
          status: ApprovalStatus.REWORK_REQUIRED
        });
        this.historyService.recordChange(
          'approval_record',
          approval.id,
          'status',
          oldStatus,
          ApprovalStatus.REWORK_REQUIRED,
          createdBy,
          '检测到返工原因，自动标记为需返工'
        );
      }
    }

    return {
      success: true,
      remark: result.remark,
      warning: result.approvalImpact.warning
    };
  }

  updateTrackRemark(
    remarkId: string,
    newContent: string,
    updatedBy: string
  ): {
    success: boolean;
    remark?: TrackRemark;
    warning?: HumanReadableError;
    error?: HumanReadableError;
  } {
    const oldRemark = this.store.getTrackRemark(remarkId);
    if (!oldRemark) {
      return { success: false, error: getHumanReadableError('track_not_found') };
    }

    const detection = this.rulesEngine.detectReworkReason(newContent);
    const updated = this.store.updateTrackRemark(remarkId, {
      content: newContent,
      hasReworkReason: detection.hasReworkReason,
      reworkReason: detection.reworkReason
    });

    if (updated) {
      this.historyService.recordChange(
        'track_remark',
        remarkId,
        'content',
        oldRemark.content,
        newContent,
        updatedBy,
        '修改轨道备注'
      );

      if (detection.hasReworkReason && !oldRemark.hasReworkReason) {
        const approval = this.store.getApprovalRecordByTrackId(oldRemark.trackId);
        if (approval) {
          const oldStatus = approval.status;
          this.store.updateApprovalRecord(approval.id, {
            status: ApprovalStatus.REWORK_REQUIRED
          });
          this.historyService.recordChange(
            'approval_record',
            approval.id,
            'status',
            oldStatus,
            ApprovalStatus.REWORK_REQUIRED,
            updatedBy,
            '备注修改后检测到返工原因'
          );
        }
      }

      return {
        success: true,
        remark: updated,
        warning: detection.hasReworkReason ? getHumanReadableError('rework_reason_pending') : undefined
      };
    }

    return { success: false };
  }

  uploadCheckinPhoto(
    classSessionId: string,
    trackId: string,
    photoUrl: string,
    uploadedBy: string
  ): ClassCheckinPhoto {
    return this.store.createCheckinPhoto({
      classSessionId,
      trackId,
      photoUrl,
      uploadedBy,
      reviewed: false
    });
  }

  reviewCheckinPhoto(
    photoId: string,
    reviewedBy: string
  ): ClassCheckinPhoto | undefined {
    return this.store.reviewCheckinPhoto(photoId, reviewedBy);
  }

  addRehearsalChange(
    trackId: string,
    changeType: string,
    changeContent: string,
    createdBy: string
  ): RehearsalChangeRecord {
    return this.store.createRehearsalChange({
      trackId,
      changeType,
      changeContent,
      createdBy
    });
  }

  advanceWorkflow(
    approvalId: string,
    operator: string
  ) {
    return this.workflowEngine.completeStep(approvalId, operator);
  }

  getWorkflowStepInfo(approvalId: string) {
    return this.workflowEngine.getCurrentStepInfo(approvalId);
  }

  setDisplayMode(
    approvalId: string,
    displayMode: DisplayMode,
    operator: string
  ) {
    return this.displayModeService.setDisplayMode(approvalId, displayMode, operator);
  }

  getNavigationTargets(trackId: string) {
    return this.displayModeService.getNavigationTargets(trackId);
  }

  navigateToSource(
    trackId: string,
    targetType: 'alias_table' | 'checkin_photo' | 'rehearsal_record',
    targetId: string
  ) {
    return this.displayModeService.navigateToSource(trackId, targetType, targetId);
  }

  getChangeHistory(entityType: 'track_alias' | 'track_remark' | 'approval_record', entityId: string) {
    return this.historyService.getDiffForEntity(entityType, entityId);
  }

  getApprovalRecord(approvalId: string): ApprovalRecord | undefined {
    return this.store.getApprovalRecord(approvalId);
  }

  getApprovalByTrackId(trackId: string): ApprovalRecord | undefined {
    return this.store.getApprovalRecordByTrackId(trackId);
  }

  getAllApprovals(): ApprovalRecord[] {
    return this.store.getAllApprovalRecords();
  }

  getTrackRemarks(trackId: string): TrackRemark[] {
    return this.store.getTrackRemarksByTrackId(trackId);
  }
}
