import { ReplayOptions, ReplayReport } from "./types";
export declare class ReplayExecutor {
    private options;
    private engine;
    private executionResults;
    private badRows;
    private runId;
    private outputDir;
    private migrationScripts;
    private shadowData;
    private tableSchemas;
    private totalAffectedRows;
    constructor(options: ReplayOptions);
    execute(): Promise<ReplayReport>;
    private loadShadowDataIntoDatabase;
    private createTableFromSchema;
    private extractPrimaryKey;
    private executeScriptWithRollback;
    private verifyRollback;
    private calculateRollbackSuccessRate;
    private cleanupShadowData;
    private saveExecutionLog;
}
