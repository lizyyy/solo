import { DriftReport, CliOptions } from './types';
export declare class DriftDetector {
    private templateLoader;
    private fileComparator;
    private configComparator;
    private repairPreviewGenerator;
    constructor();
    detect(options: CliOptions): Promise<DriftReport>;
}
