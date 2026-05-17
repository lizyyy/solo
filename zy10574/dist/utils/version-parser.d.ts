import { VersionRange, AnomalySample } from '../types.js';
export declare function parseVersionRange(range: string, context?: {
    file: string;
    packageName: string;
}): {
    range: VersionRange;
    anomaly?: AnomalySample;
};
export declare function isVersionInRange(version: string, range: string): boolean;
export declare function findIntersection(ranges: string[]): string | null;
export declare function normalizeVersion(version: string): string;
