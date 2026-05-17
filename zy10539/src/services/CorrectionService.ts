import { correctionStorage } from '../models/CorrectionModel';
import type {
  CorrectionRequest,
  CorrectionStatus,
  TagDiff,
  CostImpact,
  ExceptionRecord,
  ExceptionType,
  RollbackPoint,
  CreateCorrectionRequest
} from '../types';
import { CorrectionStatus as StatusEnum, ExceptionType as ExceptionEnum } from '../types';
import * as crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

export class CorrectionService {
  async createCorrection(request: CreateCorrectionRequest): Promise<CorrectionRequest> {
    const now = new Date();
    const correction: CorrectionRequest = {
      id: generateId(),
      title: request.title,
      description: request.description,
      applicant: request.applicant,
      applicantDepartment: request.applicantDepartment,
      status: StatusEnum.DRAFT,
      assets: request.assets.map(asset => ({
        assetId: asset.assetId,
        currentTags: this.mockGetCurrentTags(asset.assetId),
        targetTags: asset.targetTags,
        costProject: asset.costProject,
        originalCostProject: this.mockGetOriginalCostProject(asset.assetId)
      })),
      rollbackPoints: [],
      exceptions: [],
      createdAt: now,
      updatedAt: now
    };

    return correctionStorage.saveCorrection(correction);
  }

  async getCorrection(id: string): Promise<CorrectionRequest | undefined> {
    return correctionStorage.getCorrection(id);
  }

  async listCorrections(filters?: {
    status?: string;
    applicant?: string;
    department?: string;
  }): Promise<CorrectionRequest[]> {
    return correctionStorage.listCorrections(filters);
  }

  async generatePreview(correctionId: string): Promise<{
    tagDiffs: TagDiff[];
    costImpacts: CostImpact[];
  }> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    const tagDiffs = correction.assets.map(asset => 
      this.calculateTagDiff(asset.assetId, asset.currentTags, asset.targetTags)
    );

    const costImpacts = correction.assets.map(asset => 
      this.calculateCostImpact(asset)
    );

    correction.tagDiffs = tagDiffs;
    correction.costImpacts = costImpacts;
    correction.status = StatusEnum.PREVIEWED;

    await correctionStorage.saveCorrection(correction);

    return { tagDiffs, costImpacts };
  }

  async submitForApproval(correctionId: string, approver: string): Promise<CorrectionRequest> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    if (correction.status !== StatusEnum.PREVIEWED) {
      throw new Error('Correction must be previewed before submission');
    }

    correction.status = StatusEnum.PENDING_APPROVAL;
    correction.approver = approver;

    return correctionStorage.saveCorrection(correction);
  }

  async approveCorrection(
    correctionId: string, 
    approver: string, 
    comment?: string
  ): Promise<CorrectionRequest> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    if (correction.status !== StatusEnum.PENDING_APPROVAL) {
      throw new Error('Correction is not pending approval');
    }

    correction.status = StatusEnum.APPROVED;
    correction.approvedAt = new Date();
    correction.approvalComment = comment;

    await this.createRollbackPoint(correction, approver);

    return correctionStorage.saveCorrection(correction);
  }

  async rejectCorrection(
    correctionId: string, 
    approver: string, 
    comment: string
  ): Promise<CorrectionRequest> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    correction.status = StatusEnum.REJECTED;
    correction.approvedAt = new Date();
    correction.approvalComment = comment;

    return correctionStorage.saveCorrection(correction);
  }

  async executeCorrection(correctionId: string, operator: string): Promise<CorrectionRequest> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    if (correction.status !== StatusEnum.APPROVED) {
      throw new Error('Correction must be approved before execution');
    }

    correction.status = StatusEnum.EXECUTING;
    correction.executedAt = new Date();
    await correctionStorage.saveCorrection(correction);

    try {
      for (const asset of correction.assets) {
        await this.simulateTagUpdate(asset.assetId, asset.targetTags);
      }

      correction.status = StatusEnum.COMPLETED;
      correction.completedAt = new Date();
    } catch (error) {
      await this.recordException(
        correctionId,
        ExceptionEnum.EXECUTION_FAILED,
        'Failed to execute correction',
        error
      );
      correction.status = StatusEnum.EXCEPTION;
    }

    return correctionStorage.saveCorrection(correction);
  }

  async rollbackCorrection(correctionId: string, operator: string): Promise<CorrectionRequest> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    const rollbackPoints = await correctionStorage.getRollbackPointsByCorrection(correctionId);
    if (rollbackPoints.length === 0) {
      throw new Error('No rollback points available');
    }

    const latestPoint = rollbackPoints[0]!;

    try {
      for (const snapshot of latestPoint.snapshot) {
        await this.simulateTagUpdate(snapshot.assetId, snapshot.tags);
      }

      correction.status = StatusEnum.ROLLED_BACK;
    } catch (error) {
      await this.recordException(
        correctionId,
        ExceptionEnum.ROLLBACK_FAILED,
        'Failed to rollback correction',
        error
      );
      throw error;
    }

    return correctionStorage.saveCorrection(correction);
  }

  async manualFix(
    correctionId: string, 
    assetId: string, 
    correctedTags: Record<string, string>,
    operator: string,
    reason: string
  ): Promise<CorrectionRequest> {
    const correction = await correctionStorage.getCorrection(correctionId);
    if (!correction) {
      throw new Error('Correction request not found');
    }

    const asset = correction.assets.find(a => a.assetId === assetId);
    if (!asset) {
      throw new Error('Asset not found in correction');
    }

    asset.targetTags = correctedTags;

    await this.recordException(
      correctionId,
      ExceptionEnum.TAG_CONFLICT,
      `Manual correction applied to asset ${assetId}`,
      { reason, correctedTags, operator }
    );

    return correctionStorage.saveCorrection(correction);
  }

  async resolveException(
    exceptionId: string,
    resolver: string,
    resolution: string
  ): Promise<ExceptionRecord> {
    const exceptions = await correctionStorage.getExceptionsByCorrection(
      exceptionId.split('-')[0] || ''
    );
    const exception = exceptions.find(e => e.id === exceptionId);
    
    if (!exception) {
      throw new Error('Exception not found');
    }

    exception.resolved = true;
    exception.resolvedBy = resolver;
    exception.resolvedAt = new Date();
    exception.resolution = resolution;

    return correctionStorage.saveException(exception);
  }

  private calculateTagDiff(
    assetId: string,
    currentTags: Record<string, string>,
    targetTags: Record<string, string>
  ): TagDiff {
    const addedTags: Record<string, string> = {};
    const removedTags: Record<string, string> = {};
    const modifiedTags: Record<string, { from: string; to: string }> = {};
    const unchangedTags: Record<string, string> = {};

    const allKeys = new Set([...Object.keys(currentTags), ...Object.keys(targetTags)]);

    for (const key of allKeys) {
      const current = currentTags[key];
      const target = targetTags[key];

      if (current === undefined && target !== undefined) {
        addedTags[key] = target;
      } else if (current !== undefined && target === undefined) {
        removedTags[key] = current;
      } else if (current !== target) {
        modifiedTags[key] = { from: current!, to: target! };
      } else {
        unchangedTags[key] = current!;
      }
    }

    return { assetId, addedTags, removedTags, modifiedTags, unchangedTags };
  }

  private calculateCostImpact(asset: { assetId: string; costProject?: string; originalCostProject?: string }): CostImpact {
    const previousCost = this.mockGetAssetCost(asset.assetId);
    const estimatedNewCost = previousCost * (0.9 + Math.random() * 0.2);

    return {
      assetId: asset.assetId,
      previousCost,
      estimatedNewCost,
      costChange: estimatedNewCost - previousCost,
      affectedPeriods: ['2026-05', '2026-06'],
      costProjectChange: asset.costProject && asset.originalCostProject 
        ? { from: asset.originalCostProject, to: asset.costProject }
        : undefined
    };
  }

  private async createRollbackPoint(correction: CorrectionRequest, createdBy: string): Promise<RollbackPoint> {
    const point: RollbackPoint = {
      id: generateId(),
      correctionId: correction.id,
      timestamp: new Date(),
      snapshot: correction.assets.map(asset => ({
        assetId: asset.assetId,
        tags: { ...asset.currentTags },
        costProject: asset.originalCostProject || 'unknown'
      })),
      createdBy
    };

    return correctionStorage.saveRollbackPoint(point);
  }

  private async recordException(
    correctionId: string,
    type: ExceptionType,
    message: string,
    originalInput: unknown
  ): Promise<ExceptionRecord> {
    const exception: ExceptionRecord = {
      id: generateId(),
      correctionId,
      type,
      message,
      timestamp: new Date(),
      originalInput,
      processingEvidence: [
        `Exception recorded at ${new Date().toISOString()}`,
        `Type: ${type}`,
        `Message: ${message}`
      ],
      resolved: false
    };

    return correctionStorage.saveException(exception);
  }

  private mockGetCurrentTags(assetId: string): Record<string, string> {
    return {
      'Environment': 'Production',
      'CostCenter': 'WRONG-CC-001',
      'Project': 'WRONG-PROJECT',
      'Owner': 'team-wrong'
    };
  }

  private mockGetOriginalCostProject(assetId: string): string {
    return 'OLD-COST-PROJECT-001';
  }

  private mockGetAssetCost(assetId: string): number {
    return 5000 + Math.floor(Math.random() * 10000);
  }

  private async simulateTagUpdate(assetId: string, tags: Record<string, string>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`Updated tags for asset ${assetId}:`, tags);
  }
}

export const correctionService = new CorrectionService();
