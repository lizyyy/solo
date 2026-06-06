import { dataStore } from '../store/data-store';
import {
  TrackChecklistItem,
  ConflictEvidence,
  VerificationResult,
  LeaveReviewStatus,
  MaterialSource,
  ScheduleRecord,
} from '../types';
import { ErrorMessages } from '../utils/messages';

export class ChecklistService {
  generateChecklist(source?: MaterialSource): {
    checklist: TrackChecklistItem[];
    conflicts: ConflictEvidence[];
    pendingLeaveReviews: TrackChecklistItem[];
  } {
    const photos = source
      ? dataStore.getSessionPhotosBySource(source)
      : dataStore.getAllSessionPhotos();
    const schedules = dataStore.getAllScheduleRecords();
    const conflicts: ConflictEvidence[] = [];
    const pendingLeaveReviews: TrackChecklistItem[] = [];
    const checklist: TrackChecklistItem[] = [];

    for (const photo of photos) {
      const matchingSchedule = schedules.find(
        (s) =>
          s.performerId === photo.performerId &&
          s.sessionDate.getTime() === photo.sessionDate.getTime() &&
          s.locationId === photo.locationId
      );

      const trackAlias = dataStore.findTrackAliasByName(photo.trackName);

      let verificationResult: VerificationResult = 'match';
      let conflictEvidence: ConflictEvidence | undefined;
      let leaveReviewStatus: LeaveReviewStatus = 'pending';

      if (!trackAlias) {
        verificationResult = 'conflict';
        conflictEvidence = this.createMissingAliasConflict(photo, matchingSchedule);
        conflicts.push(conflictEvidence);
      } else {
        const normalizedPhotoTrack = photo.trackName.trim().toLowerCase();
        const normalizedCanonical = trackAlias.canonicalName.trim().toLowerCase();
        const aliasMatch = trackAlias.aliases.some(
          (a) => a.trim().toLowerCase() === normalizedPhotoTrack
        );

        if (normalizedPhotoTrack !== normalizedCanonical && !aliasMatch) {
          verificationResult = 'conflict';
          conflictEvidence = this.createTrackNameMismatchConflict(
            photo,
            trackAlias,
            matchingSchedule
          );
          conflicts.push(conflictEvidence);
        }
      }

      if (photo.isLeave) {
        if (matchingSchedule && matchingSchedule.isConsumed) {
          verificationResult = 'conflict';
          conflictEvidence = this.createLeaveCountedConflict(photo, trackAlias, matchingSchedule);
          conflicts.push(conflictEvidence);
        }
        leaveReviewStatus = 'pending';
      } else {
        leaveReviewStatus = 'reviewed-by-coordinator';
      }

      const item: TrackChecklistItem = {
        id: dataStore.generateId(),
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
        isLeave: photo.isLeave,
        leaveReviewStatus,
        source: photo.source,
      };

      dataStore.saveChecklistItem(item);
      checklist.push(item);

      if (photo.isLeave && leaveReviewStatus === 'pending') {
        pendingLeaveReviews.push(item);
      }
    }

    return { checklist, conflicts, pendingLeaveReviews };
  }

  private createMissingAliasConflict(
    photo: any,
    schedule?: ScheduleRecord
  ): ConflictEvidence {
    return {
      id: dataStore.generateId(),
      type: 'track-name-mismatch',
      description: ErrorMessages.missingCanonicalName(photo.trackName).message,
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
      suggestion: ErrorMessages.missingCanonicalName(photo.trackName).suggestion,
      needsCoordinatorReview: false,
    };
  }

  private createTrackNameMismatchConflict(
    photo: any,
    trackAlias: any,
    schedule?: ScheduleRecord
  ): ConflictEvidence {
    return {
      id: dataStore.generateId(),
      type: 'track-name-mismatch',
      description: ErrorMessages.trackNameMismatch(
        photo.trackName,
        trackAlias.canonicalName
      ).message,
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
      suggestion:
        '请核对原始材料，确认以哪个为准。点击"确认"使用别名表标准名，"驳回"保留照片记录',
      needsCoordinatorReview: false,
    };
  }

  private createLeaveCountedConflict(
    photo: any,
    trackAlias: any,
    schedule: ScheduleRecord
  ): ConflictEvidence {
    return {
      id: dataStore.generateId(),
      type: 'leave-counted-as-consumed',
      description: ErrorMessages.leaveCountedAsConsumed(
        photo.performerName,
        photo.sessionDate.toLocaleDateString()
      ).message,
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
      suggestion:
        '请假课时不应计入已消耗。已自动标记为待巡演统筹复核，请不要直接归为正常课时',
      needsCoordinatorReview: true,
    };
  }

  resolveConflict(
    checklistItemId: string,
    confirmed: boolean,
    resolverName: string
  ): TrackChecklistItem | undefined {
    const item = dataStore.getChecklistItem(checklistItemId);
    if (!item) return undefined;

    const updated: TrackChecklistItem = {
      ...item,
      verificationResult: confirmed ? 'match' : 'pending-review',
      reviewedBy: resolverName,
      reviewedAt: new Date(),
    };

    if (confirmed && item.conflictEvidence) {
      updated.trackNameFromPhoto = item.canonicalTrackName || item.trackNameFromAlias;
      updated.conflictEvidence = undefined;
    }

    dataStore.saveChecklistItem(updated);
    return updated;
  }

  reviewLeaveItem(
    checklistItemId: string,
    reviewerName: string
  ): TrackChecklistItem | undefined {
    const item = dataStore.getChecklistItem(checklistItemId);
    if (!item) return undefined;

    const updated: TrackChecklistItem = {
      ...item,
      leaveReviewStatus: 'reviewed-by-coordinator',
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    };

    dataStore.saveChecklistItem(updated);
    return updated;
  }

  exportChecklist(source?: MaterialSource): any[] {
    const items = source
      ? dataStore.getChecklistItemsBySource(source)
      : dataStore.getAllChecklistItems();

    return items.map((item) => ({
      日期: item.sessionDate.toLocaleDateString(),
      艺人: item.performerName,
      点位: item.locationName,
      照片曲目: item.trackNameFromPhoto,
      标准曲目: item.canonicalTrackName || '-',
      核对结果: this.getVerificationResultText(item.verificationResult),
      是否请假: item.isLeave ? '是' : '否',
      请假复核状态: this.getLeaveReviewStatusText(item.leaveReviewStatus),
      数据来源: this.getSourceText(item.source),
    }));
  }

  private getVerificationResultText(result: VerificationResult): string {
    const map = {
      match: '核对一致',
      conflict: '存在冲突',
      'pending-review': '待复核',
    };
    return map[result];
  }

  private getLeaveReviewStatusText(status: LeaveReviewStatus): string {
    const map = {
      pending: '待巡演统筹复核',
      'reviewed-by-coordinator': '已复核',
    };
    return map[status];
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

export const checklistService = new ChecklistService();
