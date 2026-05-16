import { v4 as uuidv4 } from "uuid";
import { ReplayOptions, ReplayReport } from "./types";
import { createDatabaseEngine } from "./engines/factory";
import { loadMigrationScripts, loadShadowData, loadTableSchemas, ensureOutputDir } from "./utils/config";
import { ReportGenerator } from "./report-generator";
import * as fs from "fs";
import * as path from "path";

export class ReplayExecutor {
  private options: ReplayOptions;
  private engine: any;
  private executionResults: any[] = [];
  private badRows: any[] = [];
  private runId: string | undefined;
  private outputDir: string | undefined;

  constructor(options: ReplayOptions) {
    this.options = { failFast: false, verifyRollback: true, preserveFailedState: false, ...options };
  }

  async execute(): Promise<ReplayReport> {
    const startTime = new Date();
    this.runId = this.options.runId || "replay_" + Date.now() + "_" + uuidv4().substring(0, 8);
    this.outputDir = ensureOutputDir(this.options.outputDir, this.runId);
    console.log("Starting migration replay - Run ID: " + this.runId);
    console.log("Output directory: " + this.outputDir);
    this.engine = createDatabaseEngine(this.options.databaseConfig);
    await this.engine.connect();
    console.log("Database connected");
    const scripts = loadMigrationScripts(this.options.migrationScriptsPath);
    const successfulScripts = 0; const failedScripts = 0;
    for (const script of scripts) { const result = await this.executeScript(script); }
    const endTime = new Date();
    const report = { runId: this.runId, summary: { totalScripts: scripts.length, successfulScripts, failedScripts, badRowsCount: this.badRows.length } } as ReplayReport;
    const reportGen = new ReportGenerator(report, this.outputDir);
    reportGen.exportAll();
    await this.engine.disconnect();
    return report;
  }

  private async executeScript(script: any): Promise<void> {
    console.log("Executing: " + script.id);
    try {
      await this.engine.beginTransaction();
      const result = await this.engine.executeQuery(script.sql || "SELECT 1");
      await this.engine.commitTransaction();
      this.executionResults.push({ scriptId: script.id, success: true, affectedRows: result.affectedRows });
    } catch (error: any) {
      await this.engine.rollbackTransaction();
      this.executionResults.push({ scriptId: script.id, success: false, error: error.message });
      throw error;
    }
  }
}