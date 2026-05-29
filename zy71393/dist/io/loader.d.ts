import { TrackingManifest, EventLog } from '../types';
export declare class DataLoader {
    static loadManifest(filePath: string): TrackingManifest;
    static loadEventLog(filePath: string): EventLog;
    private static readFile;
    private static validateManifest;
    private static validateEventLog;
}
