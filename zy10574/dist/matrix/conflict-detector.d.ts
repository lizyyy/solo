import { VersionRequirement, VersionConflict, VersionMatrix, ScanResult, AnomalySample } from '../types.js';
export declare function detectConflicts(requirements: VersionRequirement[], ciVersions: string[]): {
    conflicts: VersionConflict[];
    anomalies: AnomalySample[];
};
export declare function buildVersionMatrix(scanResult: ScanResult): VersionMatrix;
