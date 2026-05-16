import { ReplayOptions, ReplayReport } from "./types";
export declare class ReplayExecutor {
    private options;
    private engine;
    private executionResults;
    private badRows;
    private runId;
    private outputDir;
    constructor(options: ReplayOptions);
    execute(): Promise<ReplayReport>;
}
