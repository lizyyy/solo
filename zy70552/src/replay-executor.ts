import { v4 as uuidv4 } from "uuid";
import { 
  ReplayOptions, 
  ReplayReport, 
  MigrationScript, 
  ExecutionResult, 
  BadRow,
  ShadowData,
  TableSchema
} from "./types";
import { createDatabaseEngine } from "./engines/factory";
import { 
  loadMigrationScripts, 
  loadShadowData, 
  loadTableSchemas, 
  ensureOutputDir 
} from "./utils/config";
import { ReportGenerator } from "./report-generator";
import * as fs from "fs";
import * as path from "path";

export class ReplayExecutor {
  private options: ReplayOptions;
  private engine: any;
  private executionResults: ExecutionResult[] = [];
  private badRows: BadRow[] = [];
  private runId: string | undefined;
  private outputDir: string | undefined;
  private migrationScripts: MigrationScript[] = [];
  private shadowData: ShadowData[] = [];
  private tableSchemas: TableSchema[] = [];
  private totalAffectedRows = 0;

  constructor(options: ReplayOptions) {
    this.options = { 
      failFast: false, 
      verifyRollback: true, 
      preserveFailedState: false, 
      ...options 
    };
  }

  async execute(): Promise<ReplayReport> {
    const startTime = new Date();
    this.runId = this.options.runId || "replay_" + Date.now() + "_" + uuidv4().substring(0, 8);
    this.outputDir = ensureOutputDir(this.options.outputDir, this.runId);
    
    console.log("========================================");
    console.log("SQL Migration Shadow Replay");
    console.log("========================================");
    console.log(`Run ID: ${this.runId}`);
    console.log(`Output: ${this.outputDir}`);
    console.log("");

    try {
      console.log("Loading input files...");
      this.migrationScripts = loadMigrationScripts(this.options.migrationScriptsPath);
      this.shadowData = loadShadowData(this.options.shadowDataPath);
      this.tableSchemas = loadTableSchemas(this.options.tableSchemasPath);
      
      console.log(`  - Migration scripts: ${this.migrationScripts.length}`);
      console.log(`  - Shadow data tables: ${this.shadowData.length}`);
      console.log(`  - Table schemas: ${this.tableSchemas.length}`);
      console.log("");

      console.log("Connecting to database...");
      this.engine = createDatabaseEngine(this.options.databaseConfig);
      await this.engine.connect();
      console.log("  ✓ Database connected");
      console.log("");

      console.log("Loading shadow data...");
      await this.loadShadowDataIntoDatabase();
      console.log("  ✓ Shadow data loaded");
      console.log("");

      console.log("Executing migration scripts...");
      console.log("");
      
      let successfulScripts = 0;
      let failedScripts = 0;

      for (const script of this.migrationScripts) {
        const result = await this.executeScriptWithRollback(script);
        this.executionResults.push(result);
        
        if (result.success) {
          successfulScripts++;
          this.totalAffectedRows += result.affectedRows;
          console.log(`  ✓ ${script.name}: SUCCESS (${result.affectedRows} rows affected)`);
        } else {
          failedScripts++;
          console.log(`  ✗ ${script.name}: FAILED - ${result.error?.message}`);
          
          if (this.options.failFast) {
            console.log("");
            console.log("Fail-fast mode enabled, stopping execution");
            break;
          }
        }
      }

      const endTime = new Date();
      const totalDurationMs = endTime.getTime() - startTime.getTime();

      console.log("");
      console.log("Generating reports...");
      
      const report: ReplayReport = {
        runId: this.runId,
        startTime,
        endTime,
        totalDurationMs,
        databaseConfig: {
          type: this.options.databaseConfig.type,
          host: this.options.databaseConfig.host,
          database: this.options.databaseConfig.database
        },
        summary: {
          totalScripts: this.migrationScripts.length,
          successfulScripts,
          failedScripts,
          totalAffectedRows: this.totalAffectedRows,
          badRowsCount: this.badRows.length,
          rollbackSuccessRate: this.calculateRollbackSuccessRate()
        },
        executionResults: this.executionResults,
        badRows: this.badRows,
        inputFiles: {
          migrationScripts: this.migrationScripts.map(s => path.basename(s.path)),
          shadowData: this.shadowData.map(d => d.tableName),
          tableSchemas: this.tableSchemas.map(s => s.tableName)
        },
        outputFiles: {
          jsonReport: path.join(this.outputDir, "report.json"),
          markdownReport: path.join(this.outputDir, "report.md"),
          executionLog: path.join(this.outputDir, "execution.log")
        }
      };

      const reportGen = new ReportGenerator(report, this.outputDir);
      reportGen.exportAll();
      
      this.saveExecutionLog();
      
      console.log("  ✓ Reports generated");
      console.log("");

      if (!this.options.preserveFailedState || failedScripts === 0) {
        console.log("Cleaning up shadow data...");
        await this.cleanupShadowData();
        console.log("  ✓ Shadow data cleaned");
      } else {
        console.log("Preserving database state for inspection...");
      }
      console.log("");

      await this.engine.disconnect();

      console.log("========================================");
      console.log("Replay Complete!");
      console.log(`  Success: ${successfulScripts}/${this.migrationScripts.length}`);
      console.log(`  Bad rows: ${this.badRows.length}`);
      console.log(`  Duration: ${totalDurationMs}ms`);
      console.log("========================================");

      return report;

    } catch (error: any) {
      console.error("");
      console.error("========================================");
      console.error("FATAL ERROR DURING REPLAY:");
      console.error(error.message);
      console.error("========================================");
      
      if (this.engine) {
        try {
          if (!this.options.preserveFailedState) {
            await this.engine.rollbackTransaction();
          }
          await this.engine.disconnect();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      throw error;
    }
  }

  private async loadShadowDataIntoDatabase(): Promise<void> {
    for (const data of this.shadowData) {
      try {
        const tableExists = await this.engine.tableExists(data.tableName);
        if (!tableExists) {
          console.log(`  Creating table: ${data.tableName}`);
          await this.createTableFromSchema(data.tableName);
        }

        let insertedCount = 0;
        for (let i = 0; i < data.rows.length; i++) {
          const row = data.rows[i];
          try {
            const columns = Object.keys(row).map(c => `\`${c}\``).join(", ");
            const values = Object.values(row).map(v => {
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
              return v;
            }).join(", ");
            
            const sql = `INSERT INTO \`${data.tableName}\` (${columns}) VALUES (${values})`;
            await this.engine.executeQuery(sql);
            insertedCount++;
          } catch (error: any) {
            this.badRows.push({
              id: `badrow_${uuidv4().substring(0, 8)}`,
              tableName: data.tableName,
              rowIndex: i,
              primaryKeyValues: this.extractPrimaryKey(row, data.primaryKey || []),
              reason: "Failed to insert shadow data",
              error: { message: error.message },
              rawData: row,
              sourceFile: `${data.tableName}.json`,
              sourceLine: i + 2
            });
          }
        }
        console.log(`  - ${data.tableName}: ${insertedCount} rows inserted`);
      } catch (error: any) {
        console.log(`  ⚠ ${data.tableName}: ${error.message}`);
      }
    }
  }

  private async createTableFromSchema(tableName: string): Promise<void> {
    const schema = this.tableSchemas.find(s => s.tableName === tableName);
    if (!schema) {
      throw new Error(`No schema found for table: ${tableName}`);
    }

    const columnDefs = schema.columns.map(col => {
      let def = `\`${col.name}\` ${col.type}`;
      if (!col.nullable) def += " NOT NULL";
      if (col.defaultValue !== undefined) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    if (schema.primaryKey.length > 0) {
      columnDefs.push(`PRIMARY KEY (${schema.primaryKey.map(k => `\`${k}\``).join(", ")})`);
    }

    const sql = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${columnDefs.join(", ")})`;
    await this.engine.executeQuery(sql);
  }

  private extractPrimaryKey(row: Record<string, any>, primaryKey: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of primaryKey) {
      result[key] = row[key];
    }
    return result;
  }

  private async executeScriptWithRollback(script: MigrationScript): Promise<ExecutionResult> {
    const startTime = new Date();
    let affectedRows = 0;

    try {
      await this.engine.beginTransaction();
      
      const upStart = Date.now();
      const upResult = await this.engine.executeQuery(script.sql);
      affectedRows = upResult.affectedRows;
      const upDuration = Date.now() - upStart;
      
      let rollbackResult: any = undefined;
      let rollbackVerified = false;
      const verificationErrors: string[] = [];

      if (this.options.verifyRollback && script.rollbackSql) {
        const rbStart = Date.now();
        try {
          const rbResult = await this.engine.executeQuery(script.rollbackSql);
          const rbDuration = Date.now() - rbStart;
          
          rollbackResult = {
            success: true,
            verified: false,
            affectedRows: rbResult.affectedRows,
            error: undefined
          };

          rollbackVerified = await this.verifyRollback(script, verificationErrors);
          rollbackResult.verified = rollbackVerified;
          rollbackResult.verificationErrors = verificationErrors;

        } catch (rollbackError: any) {
          rollbackResult = {
            success: false,
            verified: false,
            affectedRows: 0,
            error: { message: rollbackError.message }
          };
        }
      }

      await this.engine.commitTransaction();

      const endTime = new Date();
      
      return {
        scriptId: script.id,
        scriptName: script.name,
        success: true,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        affectedRows,
        rollbackResult
      };

    } catch (error: any) {
      await this.engine.rollbackTransaction();
      
      const endTime = new Date();
      
      return {
        scriptId: script.id,
        scriptName: script.name,
        success: false,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        affectedRows: 0,
        error: { message: error.message }
      };
    }
  }

  private async verifyRollback(script: MigrationScript, errors: string[]): Promise<boolean> {
    let verified = true;
    
    for (const data of this.shadowData) {
      try {
        const expectedCount = data.rows.length;
        const actualCount = await this.engine.getTableRowCount(data.tableName);
        
        if (actualCount !== expectedCount) {
          verified = false;
          errors.push(`Table ${data.tableName}: expected ${expectedCount} rows, found ${actualCount}`);
        }
      } catch (e: any) {
        verified = false;
        errors.push(`Table ${data.tableName}: verification failed - ${e.message}`);
      }
    }
    
    return verified;
  }

  private calculateRollbackSuccessRate(): number {
    const withRollback = this.executionResults.filter(r => r.rollbackResult);
    if (withRollback.length === 0) return 100;
    
    const successful = withRollback.filter(r => r.rollbackResult?.success).length;
    return Math.round((successful / withRollback.length) * 100);
  }

  private async cleanupShadowData(): Promise<void> {
    for (const data of this.shadowData) {
      try {
        await this.engine.executeQuery(`DROP TABLE IF EXISTS \`${data.tableName}\``);
      } catch (e) {
        // Ignore drop errors
      }
    }
  }

  private saveExecutionLog(): void {
    if (!this.outputDir) return;
    
    const logPath = path.join(this.outputDir, "execution.log");
    const lines: string[] = [];
    
    lines.push(`SQL Migration Shadow Replay Log`);
    lines.push(`Run ID: ${this.runId}`);
    lines.push(`Started: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("=".repeat(80));
    lines.push("");
    
    for (const result of this.executionResults) {
      lines.push(`Script: ${result.scriptName}`);
      lines.push(`Status: ${result.success ? "SUCCESS" : "FAILED"}`);
      lines.push(`Duration: ${result.durationMs}ms`);
      lines.push(`Affected rows: ${result.affectedRows}`);
      
      if (result.error) {
        lines.push(`Error: ${result.error.message}`);
      }
      
      if (result.rollbackResult) {
        lines.push(`Rollback: ${result.rollbackResult.success ? "SUCCESS" : "FAILED"}`);
        lines.push(`Rollback verified: ${result.rollbackResult.verified ? "YES" : "NO"}`);
        if (result.rollbackResult.verificationErrors?.length) {
          lines.push("Verification errors:");
          for (const err of result.rollbackResult.verificationErrors) {
            lines.push(`  - ${err}`);
          }
        }
      }
      
      lines.push("");
    }
    
    if (this.badRows.length > 0) {
      lines.push("=".repeat(80));
      lines.push("Bad Rows:");
      lines.push("");
      
      for (const badRow of this.badRows) {
        lines.push(`Row ID: ${badRow.id}`);
        lines.push(`Table: ${badRow.tableName}`);
        lines.push(`Source: ${badRow.sourceFile}:${badRow.sourceLine}`);
        lines.push(`Reason: ${badRow.reason}`);
        if (badRow.error) {
          lines.push(`Error: ${badRow.error.message}`);
        }
        lines.push(`Data: ${JSON.stringify(badRow.rawData, null, 2)}`);
        lines.push("");
      }
    }
    
    fs.writeFileSync(logPath, lines.join("\n"));
  }
}
