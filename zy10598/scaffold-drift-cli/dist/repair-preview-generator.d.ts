import { DriftItem, RepairPreview } from './types';
export declare class RepairPreviewGenerator {
    generate(drifts: DriftItem[]): RepairPreview[];
    private generatePreview;
    private generateCreatePreview;
    private generateModifyPreview;
    private generateConfigAddPreview;
    private generateConfigFixPreview;
}
