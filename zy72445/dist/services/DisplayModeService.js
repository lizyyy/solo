"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisplayModeService = void 0;
const DataStore_1 = require("../store/DataStore");
const boundaryRules_1 = require("../constants/boundaryRules");
const errorMessages_1 = require("../constants/errorMessages");
const ChangeHistoryService_1 = require("./ChangeHistoryService");
class DisplayModeService {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
        this.historyService = new ChangeHistoryService_1.ChangeHistoryService();
    }
    setDisplayMode(approvalId, displayMode, operator) {
        const approval = this.store.getApprovalRecord(approvalId);
        if (!approval) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        const modeConfig = boundaryRules_1.BOUNDARY_RULES.displayMode[displayMode];
        if (modeConfig && modeConfig.requireServiceReview) {
            const hasRework = this.store.hasReworkReasonForTrack(approval.trackId);
            if (hasRework) {
                return {
                    success: false,
                    error: (0, errorMessages_1.getHumanReadableError)('display_mode_requires_review'),
                    requiresReview: true
                };
            }
        }
        const oldMode = approval.displayMode;
        const updated = this.store.updateApprovalRecord(approvalId, { displayMode });
        if (updated) {
            this.historyService.recordChange('approval_record', approvalId, 'displayMode', oldMode, displayMode, operator, '切换展示模式');
        }
        return { success: true };
    }
    getNavigationTargets(trackId) {
        const targets = [];
        const alias = this.store.getTrackAliasByTrackId(trackId);
        if (alias) {
            targets.push({
                type: 'alias_table',
                id: alias.id,
                label: `曲目别名表: ${alias.trackName}`
            });
        }
        const photos = this.store.getCheckinPhotosByTrack(trackId);
        photos.forEach((photo, index) => {
            targets.push({
                type: 'checkin_photo',
                id: photo.id,
                label: `课时签到照片 ${index + 1}`
            });
        });
        const rehearsals = this.store.getRehearsalChangesByTrack(trackId);
        rehearsals.forEach((record, index) => {
            targets.push({
                type: 'rehearsal_record',
                id: record.id,
                label: `排练变更记录 ${index + 1}: ${record.changeType}`
            });
        });
        return targets;
    }
    navigateToSource(trackId, targetType, targetId) {
        let valid = false;
        let context;
        switch (targetType) {
            case 'alias_table':
                const alias = this.store.getTrackAlias(targetId);
                valid = alias !== undefined && alias.trackId === trackId;
                if (valid) {
                    context = { trackId, source: 'alias_table', sourceId: targetId };
                }
                break;
            case 'checkin_photo':
                const photo = this.store.getCheckinPhoto(targetId);
                valid = photo !== undefined && photo.trackId === trackId;
                if (valid) {
                    context = { trackId, source: 'checkin_photo', sourceId: targetId };
                }
                break;
            case 'rehearsal_record':
                const rehearsal = this.store.getRehearsalChangesByTrack(trackId).find(r => r.id === targetId);
                valid = rehearsal !== undefined;
                if (valid) {
                    context = { trackId, source: 'rehearsal_record', sourceId: targetId };
                }
                break;
        }
        if (!valid) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        return { success: true, context };
    }
    checkServiceReviewRequired(displayMode, trackId) {
        const modeConfig = boundaryRules_1.BOUNDARY_RULES.displayMode[displayMode];
        if (!modeConfig || !modeConfig.requireServiceReview) {
            return { required: false };
        }
        const hasRework = this.store.hasReworkReasonForTrack(trackId);
        if (hasRework) {
            return {
                required: true,
                reason: '该轨道存在未处理的返工原因，需先由版权运营复核'
            };
        }
        return { required: false };
    }
}
exports.DisplayModeService = DisplayModeService;
//# sourceMappingURL=DisplayModeService.js.map