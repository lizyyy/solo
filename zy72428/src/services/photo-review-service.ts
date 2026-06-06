import { dataStore } from '../store/data-store';
import { ClassSessionPhoto, MaterialSource } from '../types';
import { createWarningMessage, createInfoMessage } from '../utils/messages';

export interface PhotoUploadInput {
  sessionDate: Date;
  performerId: string;
  performerName: string;
  locationId: string;
  locationName: string;
  trackName: string;
  isLeave: boolean;
  leaveReason?: string;
  photoUrl: string;
  source: MaterialSource;
  supplementNote?: string;
}

export class PhotoReviewService {
  uploadPhotos(inputs: PhotoUploadInput[]): {
    success: boolean;
    uploaded: ClassSessionPhoto[];
    warnings: string[];
    leaveCount: number;
  } {
    const uploaded: ClassSessionPhoto[] = [];
    const warnings: string[] = [];
    let leaveCount = 0;

    for (const input of inputs) {
      const photo: ClassSessionPhoto = {
        id: dataStore.generateId(),
        sessionDate: input.sessionDate,
        performerId: input.performerId,
        performerName: input.performerName,
        locationId: input.locationId,
        locationName: input.locationName,
        trackName: input.trackName.trim(),
        isLeave: input.isLeave,
        leaveReason: input.leaveReason?.trim(),
        photoUrl: input.photoUrl,
        uploadedAt: new Date(),
        source: input.source,
        supplementNote: input.supplementNote?.trim(),
      };

      dataStore.saveSessionPhoto(photo);
      uploaded.push(photo);

      if (photo.isLeave) {
        leaveCount++;
        warnings.push(
          `${photo.performerName} 在 ${photo.sessionDate.toLocaleDateString()} 标记为请假（${photo.leaveReason || '未填写原因'}），待巡演统筹复核`
        );
      }

      if (input.source === 'supplement' && input.supplementNote) {
        warnings.push(
          `补录材料：${photo.performerName} ${photo.sessionDate.toLocaleDateString()} - ${input.supplementNote}`
        );
      }
    }

    return {
      success: true,
      uploaded,
      warnings,
      leaveCount,
    };
  }

  getLeavePhotosForReview(source?: MaterialSource): ClassSessionPhoto[] {
    const photos = source
      ? dataStore.getSessionPhotosBySource(source)
      : dataStore.getAllSessionPhotos();

    return photos.filter((p) => p.isLeave);
  }

  identifyLeaveCountedAsConsumed(): {
    photo: ClassSessionPhoto;
    scheduleId?: string;
  }[] {
    const results: { photo: ClassSessionPhoto; scheduleId?: string }[] = [];
    const photos = dataStore.getAllSessionPhotos();
    const schedules = dataStore.getAllScheduleRecords();

    for (const photo of photos) {
      if (!photo.isLeave) continue;

      const matchingSchedule = schedules.find(
        (s) =>
          s.performerId === photo.performerId &&
          s.sessionDate.getTime() === photo.sessionDate.getTime() &&
          s.locationId === photo.locationId
      );

      if (matchingSchedule && matchingSchedule.isConsumed) {
        results.push({ photo, scheduleId: matchingSchedule.id });
      } else if (!matchingSchedule) {
        results.push({ photo });
      }
    }

    return results;
  }
}

export const photoReviewService = new PhotoReviewService();
