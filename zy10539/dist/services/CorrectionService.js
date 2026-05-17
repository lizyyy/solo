"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctionService = exports.CorrectionService = void 0;
const CorrectionModel_1 = require("../models/CorrectionModel");
const types_1 = require("../types");
const crypto = __importStar(require("crypto"));
function generateId() {
    return crypto.randomUUID();
}
class CorrectionService {
    async createCorrection(request) {
        const now = new Date();
        const correction = {
            id: generateId(),
            title: request.title,
            description: request.description,
            applicant: request.applicant,
            applicantDepartment: request.applicantDepartment,
            status: types_1.CorrectionStatus.DRAFT,
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
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async getCorrection(id) {
        return CorrectionModel_1.correctionStorage.getCorrection(id);
    }
    async listCorrections(filters) {
        return CorrectionModel_1.correctionStorage.listCorrections(filters);
    }
    async generatePreview(correctionId) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        const tagDiffs = correction.assets.map(asset => this.calculateTagDiff(asset.assetId, asset.currentTags, asset.targetTags));
        const costImpacts = correction.assets.map(asset => this.calculateCostImpact(asset));
        correction.tagDiffs = tagDiffs;
        correction.costImpacts = costImpacts;
        correction.status = types_1.CorrectionStatus.PREVIEWED;
        await CorrectionModel_1.correctionStorage.saveCorrection(correction);
        return { tagDiffs, costImpacts };
    }
    async submitForApproval(correctionId, approver) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        if (correction.status !== types_1.CorrectionStatus.PREVIEWED) {
            throw new Error('Correction must be previewed before submission');
        }
        correction.status = types_1.CorrectionStatus.PENDING_APPROVAL;
        correction.approver = approver;
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async approveCorrection(correctionId, approver, comment) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        if (correction.status !== types_1.CorrectionStatus.PENDING_APPROVAL) {
            throw new Error('Correction is not pending approval');
        }
        correction.status = types_1.CorrectionStatus.APPROVED;
        correction.approvedAt = new Date();
        correction.approvalComment = comment;
        await this.createRollbackPoint(correction, approver);
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async rejectCorrection(correctionId, approver, comment) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        correction.status = types_1.CorrectionStatus.REJECTED;
        correction.approvedAt = new Date();
        correction.approvalComment = comment;
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async executeCorrection(correctionId, operator) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        if (correction.status !== types_1.CorrectionStatus.APPROVED) {
            throw new Error('Correction must be approved before execution');
        }
        correction.status = types_1.CorrectionStatus.EXECUTING;
        correction.executedAt = new Date();
        await CorrectionModel_1.correctionStorage.saveCorrection(correction);
        try {
            for (const asset of correction.assets) {
                await this.simulateTagUpdate(asset.assetId, asset.targetTags);
            }
            correction.status = types_1.CorrectionStatus.COMPLETED;
            correction.completedAt = new Date();
        }
        catch (error) {
            await this.recordException(correctionId, types_1.ExceptionType.EXECUTION_FAILED, 'Failed to execute correction', error);
            correction.status = types_1.CorrectionStatus.EXCEPTION;
        }
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async rollbackCorrection(correctionId, operator) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        const rollbackPoints = await CorrectionModel_1.correctionStorage.getRollbackPointsByCorrection(correctionId);
        if (rollbackPoints.length === 0) {
            throw new Error('No rollback points available');
        }
        const latestPoint = rollbackPoints[0];
        try {
            for (const snapshot of latestPoint.snapshot) {
                await this.simulateTagUpdate(snapshot.assetId, snapshot.tags);
            }
            correction.status = types_1.CorrectionStatus.ROLLED_BACK;
        }
        catch (error) {
            await this.recordException(correctionId, types_1.ExceptionType.ROLLBACK_FAILED, 'Failed to rollback correction', error);
            throw error;
        }
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async manualFix(correctionId, assetId, correctedTags, operator, reason) {
        const correction = await CorrectionModel_1.correctionStorage.getCorrection(correctionId);
        if (!correction) {
            throw new Error('Correction request not found');
        }
        const asset = correction.assets.find(a => a.assetId === assetId);
        if (!asset) {
            throw new Error('Asset not found in correction');
        }
        asset.targetTags = correctedTags;
        await this.recordException(correctionId, types_1.ExceptionType.TAG_CONFLICT, `Manual correction applied to asset ${assetId}`, { reason, correctedTags, operator });
        return CorrectionModel_1.correctionStorage.saveCorrection(correction);
    }
    async resolveException(exceptionId, resolver, resolution) {
        const exceptions = await CorrectionModel_1.correctionStorage.getExceptionsByCorrection(exceptionId.split('-')[0] || '');
        const exception = exceptions.find(e => e.id === exceptionId);
        if (!exception) {
            throw new Error('Exception not found');
        }
        exception.resolved = true;
        exception.resolvedBy = resolver;
        exception.resolvedAt = new Date();
        exception.resolution = resolution;
        return CorrectionModel_1.correctionStorage.saveException(exception);
    }
    calculateTagDiff(assetId, currentTags, targetTags) {
        const addedTags = {};
        const removedTags = {};
        const modifiedTags = {};
        const unchangedTags = {};
        const allKeys = new Set([...Object.keys(currentTags), ...Object.keys(targetTags)]);
        for (const key of allKeys) {
            const current = currentTags[key];
            const target = targetTags[key];
            if (current === undefined && target !== undefined) {
                addedTags[key] = target;
            }
            else if (current !== undefined && target === undefined) {
                removedTags[key] = current;
            }
            else if (current !== target) {
                modifiedTags[key] = { from: current, to: target };
            }
            else {
                unchangedTags[key] = current;
            }
        }
        return { assetId, addedTags, removedTags, modifiedTags, unchangedTags };
    }
    calculateCostImpact(asset) {
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
    async createRollbackPoint(correction, createdBy) {
        const point = {
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
        return CorrectionModel_1.correctionStorage.saveRollbackPoint(point);
    }
    async recordException(correctionId, type, message, originalInput) {
        const exception = {
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
        return CorrectionModel_1.correctionStorage.saveException(exception);
    }
    mockGetCurrentTags(assetId) {
        return {
            'Environment': 'Production',
            'CostCenter': 'WRONG-CC-001',
            'Project': 'WRONG-PROJECT',
            'Owner': 'team-wrong'
        };
    }
    mockGetOriginalCostProject(assetId) {
        return 'OLD-COST-PROJECT-001';
    }
    mockGetAssetCost(assetId) {
        return 5000 + Math.floor(Math.random() * 10000);
    }
    async simulateTagUpdate(assetId, tags) {
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`Updated tags for asset ${assetId}:`, tags);
    }
}
exports.CorrectionService = CorrectionService;
exports.correctionService = new CorrectionService();
//# sourceMappingURL=CorrectionService.js.map