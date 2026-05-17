import { JsonPatch, Conflict } from "./types";
export declare class ConflictDetector {
    detectConflicts(patches: JsonPatch[], originalJson: any): Conflict[];
    private detectPatchConflicts;
    private detectDuplicatePaths;
    private pathExists;
    private getValueAtPath;
    private decodePathSegment;
}
