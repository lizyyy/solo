import { CliOptions, ScanReport } from './types';
import { ExceptionLoader } from './exceptions';
export declare class SourcemapScanner {
    private options;
    private exceptionLoader;
    private startTime;
    constructor(options: CliOptions, exceptionLoader: ExceptionLoader);
    scan(): Promise<ScanReport>;
    private collectFiles;
    private getScanTargets;
    private scanFile;
    private createSourcemapFileIssue;
    private createReferenceIssue;
    private createPublicAccessIssue;
    private createPublicMapFileIssue;
    private createExpiredExceptionIssue;
    private getReferenceTypeName;
    private getSuggestedFixForReference;
    private getPublicUrl;
    private getRelativePath;
    private createSummary;
    private getVersion;
}
export declare function createScanner(options: CliOptions): Promise<SourcemapScanner>;
//# sourceMappingURL=scanner.d.ts.map