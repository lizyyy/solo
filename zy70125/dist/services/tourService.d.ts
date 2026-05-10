import { ServiceResult, TourManifest } from '../types';
export interface CreateTourInput {
    name: string;
    description?: string;
    caseIdentifiers: string[];
    cityIdentifiers: string[];
}
export declare function createTour(input: CreateTourInput): ServiceResult<TourManifest>;
export declare function startTour(tourId: string): ServiceResult<TourManifest>;
export declare function moveToNextCity(tourId: string): ServiceResult<TourManifest>;
export declare function completeTour(tourId: string): ServiceResult<TourManifest>;
export declare function getTour(tourId: string): ServiceResult<TourManifest>;
export declare function listTours(statusFilter?: string): ServiceResult<TourManifest[]>;
export declare function getTourStatusLabel(status: string): string;
