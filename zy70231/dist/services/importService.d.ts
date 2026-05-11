import { Storage } from '../store/storage';
import { ImportResult, MaintenanceWindow, WorkTask, WorkZone, Resource, BlockSection } from '../types/models';
interface ImportData {
    workZones?: WorkZone[];
    resources?: Resource[];
    blockSections?: BlockSection[];
    maintenanceWindows?: MaintenanceWindow[];
    workTasks?: WorkTask[];
}
export declare class ImportService {
    private storage;
    constructor(storage: Storage);
    importFromFile(filePath: string): ImportResult;
    importData(data: ImportData): ImportResult;
    getImportStats(): {
        workZones: number;
        blockSections: number;
        resources: number;
        maintenanceWindows: number;
        workTasks: number;
    };
}
export {};
