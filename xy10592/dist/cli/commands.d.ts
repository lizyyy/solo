import { FileStorage } from '../storage/FileStorage';
import { AssetService } from '../services/AssetService';
import { ReportService } from '../services/ReportService';
export interface CommandContext {
    storage: FileStorage;
    assetService: AssetService;
    reportService: ReportService;
    dataDir: string;
}
export declare function createContext(dataDir: string): CommandContext;
export declare function executeInit(ctx: CommandContext): Promise<void>;
export declare function executeImport(ctx: CommandContext, options: {
    sample?: boolean;
    invalid?: boolean;
    file?: string;
}): Promise<void>;
export declare function executeCheck(ctx: CommandContext): Promise<void>;
export declare function executeDetail(ctx: CommandContext, assetId: string): Promise<void>;
export declare function executeReport(ctx: CommandContext, options: {
    year?: number;
    month?: number;
    store?: string;
}): Promise<void>;
export declare function printHelp(): void;
