import { AliasImportInput } from '../src/services/alias-import-service';
import { ScheduleImportInput } from '../src/services/schedule-import-service';
import { PhotoUploadInput } from '../src/services/photo-review-service';
export declare const performers: {
    id: string;
    name: string;
}[];
export declare const locations: {
    id: string;
    name: string;
}[];
export declare function createDate(daysOffset: number): Date;
export declare function getNormalAliases(): AliasImportInput[];
export declare function getNormalSchedules(): ScheduleImportInput[];
export declare function getNormalPhotos(): PhotoUploadInput[];
export declare function getWrongCaliberAliases(): AliasImportInput[];
export declare function getWrongCaliberSchedules(): ScheduleImportInput[];
export declare function getWrongCaliberPhotos(): PhotoUploadInput[];
export declare function getSupplementAliases(): AliasImportInput[];
export declare function getSupplementSchedules(): ScheduleImportInput[];
export declare function getSupplementPhotos(): PhotoUploadInput[];
