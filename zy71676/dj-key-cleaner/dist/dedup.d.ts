import type { CleanTrack, DuplicateGroup, ChangeRecord } from './models.js';
export declare function findDuplicates(tracks: CleanTrack[], threshold?: number): DuplicateGroup[];
export declare function mergeDuplicates(tracks: CleanTrack[], groups: DuplicateGroup[]): {
    merged: CleanTrack[];
    changes: ChangeRecord[];
    fieldsFilled: number;
};
