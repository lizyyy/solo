import { ClassSessionPhoto, MaterialSource } from '../types';
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
export declare class PhotoReviewService {
    uploadPhotos(inputs: PhotoUploadInput[]): {
        success: boolean;
        uploaded: ClassSessionPhoto[];
        warnings: string[];
        leaveCount: number;
    };
    getLeavePhotosForReview(source?: MaterialSource): ClassSessionPhoto[];
    identifyLeaveCountedAsConsumed(): {
        photo: ClassSessionPhoto;
        scheduleId?: string;
    }[];
}
export declare const photoReviewService: PhotoReviewService;
