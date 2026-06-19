"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checklistService = exports.ChecklistService = void 0;
const data_store_1 = require("../store/data-store");
const messages_1 = require("../utils/messages");
const TRIGGER_ACTION_MAP = {
    'track-name-mismatch': '曲目别名表与课时签到照片曲目名称不一致，系统自动检测',
    'leave-counted-as-consumed': '请假课时被算进已消耗，系统自动检测',
    'duplicate-import': '检测到重复导入记录，系统自动检测',
};
const TYPE_TEXT_MAP = {
    'track-name-mismatch': '曲目名称不匹配',
    'leave-counted-as-consumed': '请假课时被误算为已消耗',
    'duplicate-import': '重复导入',
};
const SOURCE_TEXT_MAP = {
    normal: '正常材料导入',
    'wrong-caliber': '错口径材料导入',
    supplement: '补录材料导入',
};
class ChecklistService {
    generateChecklist(source) {
        const photos = source
            ? data_store_1.dataStore.getSessionPhotosBySource(source)
            : data_store_1.dataStore.getAllSessionPhotos();
        const schedules = data_store_1.dataStore.getAllScheduleRecords();
        const conflicts = [];
        const pendingLeaveReviews = [];
        const checklist = [];
        for (const photo of photos) {
            const matchingSchedule = schedules.find((s) => s.performerId === photo.performerId &&
                s.sessionDate.getTime() === photo.sessionDate.getTime() &&
                s.locationId === photo.locationId);
            const trackAlias = data_store_1.dataStore.findTrackAliasByName(photo.trackName);
            let verificationResult = 'match';
            let conflictEvidence;
            let conflictId;
            let leaveReviewStatus = 'pending';
            if (!trackAlias) {
                verificationResult = 'conflict';
                conflictEvidence = this.createMissingAliasConflict(photo, matchingSchedule);
                conflictId = conflictEvidence.id;
                conflicts.push(conflictEvidence);
            }
            else {
                const normalizedPhotoTrack = photo.trackName.trim().toLowerCase();
                const normalizedCanonical = trackAlias.canonicalName.trim().toLowerCase();
                const aliasMatch = trackAlias.aliases.some((a) => a.trim().toLowerCase() === normalizedPhotoTrack);
                if (normalizedPhotoTrack !== normalizedCanonical && !aliasMatch) {
                    verificationResult = 'conflict';
                    conflictEvidence = this.createTrackNameMismatchConflict(photo, trackAlias, matchingSchedule);
                    conflictId = conflictEvidence.id;
                    conflicts.push(conflictEvidence);
                }
            }
            if (photo.isLeave) {
                if (matchingSchedule && matchingSchedule.isConsumed) {
                    verificationResult = 'conflict';
                    conflictEvidence = this.createLeaveCountedConflict(photo, trackAlias, matchingSchedule);
                    conflictId = conflictEvidence.id;
                    conflicts.push(conflictEvidence);
                }
                leaveReviewStatus = 'pending';
            }
            else {
                leaveReviewStatus = 'reviewed-by-coordinator';
            }
            const item = {
                id: data_store_1.dataStore.generateId(),
                sessionDate: photo.sessionDate,
                performerId: photo.performerId,
                performerName: photo.performerName,
                locationId: photo.locationId,
                locationName: photo.locationName,
                trackNameFromPhoto: photo.trackName,
                trackNameFromAlias: trackAlias?.canonicalName || photo.trackName,
                canonicalTrackName: trackAlias?.canonicalName,
                verificationResult,
                conflictEvidence,
                conflictId,
                originalConflictType: conflictEvidence?.type,
                originalConflictDescription: conflictEvidence?.description,
                originalConflictSuggestion: conflictEvidence?.suggestion,
                originalPhotoEvidence: conflictEvidence
                    ? { ...conflictEvidence.photoEvidence }
                    : undefined,
                originalAliasEvidence: conflictEvidence
                    ? { ...conflictEvidence.aliasEvidence }
                    : undefined,
                originalScheduleEvidence: conflictEvidence?.scheduleEvidence
                    ? { ...conflictEvidence.scheduleEvidence }
                    : undefined,
                conflictTriggerAction: conflictEvidence
                    ? TRIGGER_ACTION_MAP[conflictEvidence.type]
                    : undefined,
                conflictNeedsCoordinatorReview: conflictEvidence?.needsCoordinatorReview,
                isLeave: photo.isLeave,
                leaveReviewStatus,
                source: photo.source,
            };
            data_store_1.dataStore.saveChecklistItem(item);
            checklist.push(item);
            this.recordAudit('checklist-item', item.id, 'create', null, {
                verificationResult,
                conflictId,
                originalConflictType: item.originalConflictType,
                isLeave: item.isLeave,
                leaveReviewStatus,
            }, '系统', `生成核对项：${item.performerName} ${item.sessionDate.toLocaleDateString()} ${item.locationName}` +
                (conflictEvidence ? `，触发冲突：${TYPE_TEXT_MAP[conflictEvidence.type]}` : ''));
            if (photo.isLeave && leaveReviewStatus === 'pending') {
                pendingLeaveReviews.push(item);
            }
        }
        return { checklist, conflicts, pendingLeaveReviews };
    }
    resolveConflict(checklistItemId, confirmed, resolverName) {
        const item = data_store_1.dataStore.getChecklistItem(checklistItemId);
        if (!item)
            return undefined;
        const beforeSnapshot = {
            verificationResult: item.verificationResult,
            trackNameFromPhoto: item.trackNameFromPhoto,
            conflictResolution: item.conflictResolution || null,
        };
        const resolution = {
            action: confirmed ? 'deer-confirmed' : 'deer-rejected',
            operator: resolverName,
            timestamp: new Date(),
            judgment: confirmed
                ? `${resolverName}（版权运营小鹿）确认以曲目别名表为准，采纳标准名称`
                : `${resolverName}（版权运营小鹿）驳回别名表，保留照片原始记录`,
            finalConclusion: confirmed
                ? `曲目名称已统一为标准名，冲突解决`
                : `保留照片原始记录，不做名称替换`,
        };
        const updated = {
            ...item,
            verificationResult: confirmed ? 'match' : 'pending-review',
            reviewedBy: resolverName,
            reviewedAt: new Date(),
            conflictEvidence: item.conflictEvidence,
            conflictResolution: resolution,
        };
        if (confirmed) {
            updated.trackNameFromPhoto = item.canonicalTrackName || item.trackNameFromAlias;
        }
        data_store_1.dataStore.saveChecklistItem(updated);
        this.recordAudit('checklist-item', item.id, 'conflict-resolve', beforeSnapshot, {
            verificationResult: updated.verificationResult,
            conflictId: item.conflictId,
            originalConflictType: item.originalConflictType,
            confirmed,
            resolution,
            trackNameFromPhoto: updated.trackNameFromPhoto,
        }, resolverName, `${resolverName} ${confirmed ? '确认' : '驳回'}冲突：${item.performerName} ${item.sessionDate.toLocaleDateString()}`);
        return updated;
    }
    reviewLeaveItem(checklistItemId, reviewerName) {
        const item = data_store_1.dataStore.getChecklistItem(checklistItemId);
        if (!item)
            return undefined;
        const beforeSnapshot = {
            leaveReviewStatus: item.leaveReviewStatus,
            verificationResult: item.verificationResult,
            conflictResolution: item.conflictResolution || null,
        };
        const resolution = {
            action: 'coordinator-reviewed',
            operator: reviewerName,
            timestamp: new Date(),
            judgment: `巡演统筹 ${reviewerName} 复核：确认为请假，课时不计入已消耗`,
            finalConclusion: `请假已复核通过，该课时标记为请假，不消耗版权配额`,
        };
        const updated = {
            ...item,
            leaveReviewStatus: 'reviewed-by-coordinator',
            reviewedBy: reviewerName,
            reviewedAt: new Date(),
            conflictEvidence: item.conflictEvidence,
            conflictResolution: resolution,
        };
        if (item.verificationResult === 'conflict' && item.conflictId) {
            updated.verificationResult = 'match';
        }
        data_store_1.dataStore.saveChecklistItem(updated);
        this.recordAudit('checklist-item', item.id, 'leave-review', beforeSnapshot, {
            leaveReviewStatus: updated.leaveReviewStatus,
            verificationResult: updated.verificationResult,
            conflictId: item.conflictId,
            originalConflictType: item.originalConflictType,
            resolution,
        }, reviewerName, `巡演统筹 ${reviewerName} 复核请假记录：${item.performerName} ${item.sessionDate.toLocaleDateString()}`);
        return updated;
    }
    getConflictReport() {
        const items = data_store_1.dataStore.getAllChecklistItems();
        const entries = [];
        for (const item of items) {
            if (!item.conflictId)
                continue;
            const originalType = item.originalConflictType || item.conflictEvidence?.type;
            const originalDescription = item.originalConflictDescription ||
                item.conflictEvidence?.description ||
                `冲突ID: ${item.conflictId}`;
            const originalSuggestion = item.originalConflictSuggestion || item.conflictEvidence?.suggestion || '';
            const originalPhoto = item.originalPhotoEvidence ||
                item.conflictEvidence?.photoEvidence || {
                trackName: item.trackNameFromPhoto,
                isLeave: item.isLeave,
                photoUrl: '-',
            };
            const originalAlias = item.originalAliasEvidence ||
                item.conflictEvidence?.aliasEvidence || {
                canonicalName: item.trackNameFromAlias,
                aliases: [],
                copyrightHolder: '-',
            };
            const originalSchedule = item.originalScheduleEvidence || item.conflictEvidence?.scheduleEvidence;
            const needsReview = item.conflictNeedsCoordinatorReview ??
                item.conflictEvidence?.needsCoordinatorReview ??
                false;
            let status = 'pending';
            let currentStatus = '待处理';
            let processingJudgment;
            let conclusion;
            if (item.conflictResolution) {
                processingJudgment = item.conflictResolution.judgment;
                conclusion = item.conflictResolution.finalConclusion;
                switch (item.conflictResolution.action) {
                    case 'deer-confirmed':
                        status = 'confirmed';
                        currentStatus = '版权运营小鹿已确认';
                        break;
                    case 'deer-rejected':
                        status = 'rejected';
                        currentStatus = '版权运营小鹿已驳回';
                        break;
                    case 'coordinator-reviewed':
                        status = 'reviewed';
                        currentStatus = '巡演统筹已复核';
                        break;
                    case 'auto-fixed':
                        status = 'confirmed';
                        currentStatus = '系统自动修复';
                        break;
                    case 'supplement-recalculated':
                        status = 'reviewed';
                        currentStatus = '补录后重算完成';
                        break;
                }
            }
            else if (item.verificationResult === 'conflict') {
                currentStatus = needsReview
                    ? '待巡演统筹复核'
                    : '待版权运营小鹿确认/驳回';
            }
            const auditLog = data_store_1.dataStore.getAuditLog('checklist-item', item.id);
            const historySummary = auditLog.map((e) => `[${e.timestamp.toLocaleString()}] ${e.operator} - ${e.action} - ${e.description}`);
            const exportRow = this.buildExportRow(item);
            entries.push({
                conflictId: item.conflictId,
                checklistItemId: item.id,
                type: originalType || 'track-name-mismatch',
                source: item.source,
                sourceDescription: SOURCE_TEXT_MAP[item.source],
                performerName: item.performerName,
                sessionDate: item.sessionDate,
                locationName: item.locationName,
                description: originalDescription,
                triggerAction: item.conflictTriggerAction ||
                    (originalType ? TRIGGER_ACTION_MAP[originalType] : '系统自动检测'),
                status,
                currentStatus,
                handledBy: item.reviewedBy,
                handledAt: item.reviewedAt,
                processingJudgment,
                conclusion,
                suggestion: originalSuggestion,
                needsCoordinatorReview: needsReview,
                photoEvidence: originalPhoto,
                aliasEvidence: originalAlias,
                scheduleEvidence: originalSchedule,
                historySummary,
                exportRow,
            });
        }
        return entries;
    }
    buildExportRow(item) {
        return {
            日期: item.sessionDate.toLocaleDateString(),
            艺人: item.performerName,
            点位: item.locationName,
            照片曲目: item.trackNameFromPhoto,
            标准曲目: item.canonicalTrackName || '-',
            冲突类型: item.originalConflictType
                ? TYPE_TEXT_MAP[item.originalConflictType]
                : '无',
            冲突描述: item.originalConflictDescription || '-',
            核对结果: item.verificationResult === 'match'
                ? '核对一致'
                : item.verificationResult === 'conflict'
                    ? '存在冲突'
                    : '待复核',
            是否请假: item.isLeave ? '是' : '否',
            请假复核状态: item.leaveReviewStatus === 'pending'
                ? '待巡演统筹复核'
                : '已复核',
            处理人: item.reviewedBy || '-',
            处理结论: item.conflictResolution?.finalConclusion || '-',
            数据来源: SOURCE_TEXT_MAP[item.source],
        };
    }
    getPendingConflictIds() {
        return data_store_1.dataStore
            .getAllChecklistItems()
            .filter((item) => item.verificationResult === 'conflict' && item.conflictId)
            .map((item) => item.conflictId);
    }
    recordAudit(entityType, entityId, action, before, after, operator, description) {
        const entry = {
            id: data_store_1.dataStore.generateId(),
            entityType,
            entityId,
            action,
            before,
            after,
            operator,
            timestamp: new Date(),
            description,
        };
        data_store_1.dataStore.addAuditEntry(entry);
    }
    createMissingAliasConflict(photo, schedule) {
        return {
            id: data_store_1.dataStore.generateId(),
            type: 'track-name-mismatch',
            description: messages_1.ErrorMessages.missingCanonicalName(photo.trackName).message,
            photoEvidence: {
                trackName: photo.trackName,
                isLeave: photo.isLeave,
                photoUrl: photo.photoUrl,
            },
            aliasEvidence: {
                canonicalName: '未找到',
                aliases: [],
                copyrightHolder: '未知',
            },
            scheduleEvidence: schedule
                ? {
                    isConsumed: schedule.isConsumed,
                    consumedHours: schedule.consumedHours,
                    isLeave: schedule.isLeave,
                }
                : undefined,
            suggestion: messages_1.ErrorMessages.missingCanonicalName(photo.trackName).suggestion,
            needsCoordinatorReview: false,
        };
    }
    createTrackNameMismatchConflict(photo, trackAlias, schedule) {
        return {
            id: data_store_1.dataStore.generateId(),
            type: 'track-name-mismatch',
            description: messages_1.ErrorMessages.trackNameMismatch(photo.trackName, trackAlias.canonicalName).message,
            photoEvidence: {
                trackName: photo.trackName,
                isLeave: photo.isLeave,
                photoUrl: photo.photoUrl,
            },
            aliasEvidence: {
                canonicalName: trackAlias.canonicalName,
                aliases: trackAlias.aliases,
                copyrightHolder: trackAlias.copyrightHolder,
            },
            scheduleEvidence: schedule
                ? {
                    isConsumed: schedule.isConsumed,
                    consumedHours: schedule.consumedHours,
                    isLeave: schedule.isLeave,
                }
                : undefined,
            suggestion: '请核对原始材料，确认以哪个为准。点击"确认"使用别名表标准名，"驳回"保留照片记录',
            needsCoordinatorReview: false,
        };
    }
    createLeaveCountedConflict(photo, trackAlias, schedule) {
        return {
            id: data_store_1.dataStore.generateId(),
            type: 'leave-counted-as-consumed',
            description: messages_1.ErrorMessages.leaveCountedAsConsumed(photo.performerName, photo.sessionDate.toLocaleDateString()).message,
            photoEvidence: {
                trackName: photo.trackName,
                isLeave: true,
                photoUrl: photo.photoUrl,
            },
            aliasEvidence: {
                canonicalName: trackAlias?.canonicalName || photo.trackName,
                aliases: trackAlias?.aliases || [],
                copyrightHolder: trackAlias?.copyrightHolder || '未知',
            },
            scheduleEvidence: {
                isConsumed: schedule.isConsumed,
                consumedHours: schedule.consumedHours,
                isLeave: schedule.isLeave,
            },
            suggestion: '请假课时不应计入已消耗。已自动标记为待巡演统筹复核，请不要直接归为正常课时',
            needsCoordinatorReview: true,
        };
    }
    exportChecklist(source) {
        const items = source
            ? data_store_1.dataStore.getChecklistItemsBySource(source)
            : data_store_1.dataStore.getAllChecklistItems();
        return items.map((item) => ({
            日期: item.sessionDate.toLocaleDateString(),
            艺人: item.performerName,
            点位: item.locationName,
            照片曲目: item.trackNameFromPhoto,
            标准曲目: item.canonicalTrackName || '-',
            原始冲突类型: item.originalConflictType
                ? TYPE_TEXT_MAP[item.originalConflictType]
                : '无',
            原始冲突描述: item.originalConflictDescription || '-',
            核对结果: this.getVerificationResultText(item.verificationResult),
            是否请假: item.isLeave ? '是' : '否',
            请假复核状态: this.getLeaveReviewStatusText(item.leaveReviewStatus),
            处理人: item.reviewedBy || '-',
            处理结论: item.conflictResolution?.finalConclusion || '-',
            冲突状态: item.conflictId
                ? item.verificationResult === 'conflict'
                    ? '待处理'
                    : '已处理'
                : '无冲突',
            数据来源: this.getSourceText(item.source),
        }));
    }
    getVerificationResultText(result) {
        const map = {
            match: '核对一致',
            conflict: '存在冲突',
            'pending-review': '待复核',
        };
        return map[result];
    }
    getLeaveReviewStatusText(status) {
        const map = {
            pending: '待巡演统筹复核',
            'reviewed-by-coordinator': '已复核',
        };
        return map[status];
    }
    getSourceText(source) {
        return SOURCE_TEXT_MAP[source];
    }
}
exports.ChecklistService = ChecklistService;
exports.checklistService = new ChecklistService();
