"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoReviewService = exports.PhotoReviewService = void 0;
const data_store_1 = require("../store/data-store");
class PhotoReviewService {
    uploadPhotos(inputs) {
        const uploaded = [];
        const warnings = [];
        let leaveCount = 0;
        for (const input of inputs) {
            const photo = {
                id: data_store_1.dataStore.generateId(),
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
            data_store_1.dataStore.saveSessionPhoto(photo);
            uploaded.push(photo);
            if (photo.isLeave) {
                leaveCount++;
                warnings.push(`${photo.performerName} 在 ${photo.sessionDate.toLocaleDateString()} 标记为请假（${photo.leaveReason || '未填写原因'}），待巡演统筹复核`);
            }
            if (input.source === 'supplement' && input.supplementNote) {
                warnings.push(`补录材料：${photo.performerName} ${photo.sessionDate.toLocaleDateString()} - ${input.supplementNote}`);
            }
        }
        return {
            success: true,
            uploaded,
            warnings,
            leaveCount,
        };
    }
    getLeavePhotosForReview(source) {
        const photos = source
            ? data_store_1.dataStore.getSessionPhotosBySource(source)
            : data_store_1.dataStore.getAllSessionPhotos();
        return photos.filter((p) => p.isLeave);
    }
    identifyLeaveCountedAsConsumed() {
        const results = [];
        const photos = data_store_1.dataStore.getAllSessionPhotos();
        const schedules = data_store_1.dataStore.getAllScheduleRecords();
        for (const photo of photos) {
            if (!photo.isLeave)
                continue;
            const matchingSchedule = schedules.find((s) => s.performerId === photo.performerId &&
                s.sessionDate.getTime() === photo.sessionDate.getTime() &&
                s.locationId === photo.locationId);
            if (matchingSchedule && matchingSchedule.isConsumed) {
                results.push({ photo, scheduleId: matchingSchedule.id });
            }
            else if (!matchingSchedule) {
                results.push({ photo });
            }
        }
        return results;
    }
}
exports.PhotoReviewService = PhotoReviewService;
exports.photoReviewService = new PhotoReviewService();
