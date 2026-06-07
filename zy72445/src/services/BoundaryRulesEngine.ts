import { DataStore } from '../store/DataStore';
import { BOUNDARY_RULES } from '../constants/boundaryRules';
import { getHumanReadableError } from '../constants/errorMessages';
import { ApprovalStatus, HumanReadableError, TrackRemark, ApprovalRecord } from '../types';

export class BoundaryRulesEngine {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  detectReworkReason(content: string): {
    hasReworkReason: boolean;
    detectedKeywords: string[];
    reworkReason?: string;
  } {
    if (!BOUNDARY_RULES.reworkReason.autoDetect) {
      return { hasReworkReason: false, detectedKeywords: [] };
    }

    const detected: string[] = [];
    for (const keyword of BOUNDARY_RULES.reworkReason.keywords) {
      if (content.includes(keyword)) {
        detected.push(keyword);
      }
    }

    return {
      hasReworkReason: detected.length > 0,
      detectedKeywords: detected,
      reworkReason: detected.length > 0 ? content : undefined
    };
  }

  canTransitionStatus(currentStatus: ApprovalStatus, nextStatus: ApprovalStatus): boolean {
    const allowedPaths = BOUNDARY_RULES.statusTransition.allowedPaths as unknown as Record<string, readonly string[]>;
    const allowed = allowedPaths[currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  validateStatusTransition(
    currentStatus: ApprovalStatus,
    nextStatus: ApprovalStatus,
    trackId: string
  ): { valid: boolean; error?: HumanReadableError } {
    if (!this.canTransitionStatus(currentStatus, nextStatus)) {
      return {
        valid: false,
        error: getHumanReadableError('invalid_status_transition')
      };
    }

    if (nextStatus === ApprovalStatus.NORMAL) {
      if (BOUNDARY_RULES.reworkReason.preventAutoNormal) {
        const hasRework = this.store.hasReworkReasonForTrack(trackId);
        if (hasRework) {
          return {
            valid: false,
            error: getHumanReadableError('rework_reason_pending')
          };
        }
      }
    }

    return { valid: true };
  }

  canRollback(status: ApprovalStatus): boolean {
    return (BOUNDARY_RULES.statusTransition.allowRollbackFrom as readonly string[]).includes(status);
  }

  validateRollback(approvalId: string): { valid: boolean; error?: HumanReadableError } {
    const approval = this.store.getApprovalRecord(approvalId);
    if (!approval) {
      return {
        valid: false,
        error: getHumanReadableError('track_not_found')
      };
    }

    if (approval.status === ApprovalStatus.NORMAL) {
      return {
        valid: false,
        error: getHumanReadableError('cannot_rollback_normal')
      };
    }

    if (!this.canRollback(approval.status)) {
      return {
        valid: false,
        error: getHumanReadableError('invalid_status_transition')
      };
    }

    return { valid: true };
  }

  processTrackRemark(
    trackId: string,
    content: string,
    createdBy: string
  ): {
    remark: TrackRemark;
    approvalImpact: {
      shouldSetReworkRequired: boolean;
      warning?: HumanReadableError;
    };
  } {
    const detection = this.detectReworkReason(content);
    const remark = this.store.createTrackRemark({
      trackId,
      content,
      hasReworkReason: detection.hasReworkReason,
      reworkReason: detection.reworkReason,
      createdBy
    });

    let shouldSetReworkRequired = false;
    let warning: HumanReadableError | undefined;

    if (detection.hasReworkReason) {
      shouldSetReworkRequired = true;
      warning = getHumanReadableError('rework_reason_pending');
    }

    return {
      remark,
      approvalImpact: {
        shouldSetReworkRequired,
        warning
      }
    };
  }

  canMarkNormal(approval: ApprovalRecord, reviewedBy?: string): boolean {
    if (BOUNDARY_RULES.statusTransition.requireReviewBeforeNormal) {
      if (!reviewedBy && !approval.reviewedBy) {
        return false;
      }
    }
    if (BOUNDARY_RULES.reworkReason.preventAutoNormal) {
      if (this.store.hasReworkReasonForTrack(approval.trackId)) {
        return false;
      }
    }
    return true;
  }
}
