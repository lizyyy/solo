import { JsonPatch, FilePreviewResult } from './types';
export declare class PreviewEngine {
    private validator;
    private conflictDetector;
    previewFile(filePath: string, originalJson: any, patches: JsonPatch[]): FilePreviewResult;
    private generatePatchPreviews;
    private calculateDiff;
    private getValueAtPath;
}
