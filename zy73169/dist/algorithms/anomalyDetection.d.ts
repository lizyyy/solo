import type { Sample, Anomaly } from '../models/types';
export interface DetectionConfig {
    duplicateTolerance?: number;
    boundaryThreshold?: number;
    outlierIqrMultiplier?: number;
    minBoundarySamples?: number;
}
export declare function detectDuplicates(samples: Sample[], tolerance?: number): Anomaly[];
export declare function detectBoundarySamples(samples: Sample[], threshold?: number, minSamples?: number): Anomaly[];
export declare function detectOutliers(samples: Sample[], iqrMultiplier?: number): Anomaly[];
export declare function clearDetectionAnomalies(samples: Sample[]): void;
export declare function detectAllAnomalies(samples: Sample[], config?: DetectionConfig): Anomaly[];
export declare function getAnomalySummary(samples: Sample[]): Record<string, number>;
export declare function isolateAnomalousSamples(samples: Sample[]): {
    normal: Sample[];
    anomalous: Sample[];
};
