import { TrackingManifest, VersionComparison } from '../types';
export declare class VersionComparator {
    compare(baseManifest: TrackingManifest, targetManifest: TrackingManifest): VersionComparison;
    private findRenamedFrom;
    private isEventModified;
    private compareParameters;
    generateDiffReport(baseManifest: TrackingManifest, targetManifest: TrackingManifest): string;
}
