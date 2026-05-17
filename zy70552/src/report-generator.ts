import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import Table from "cli-table3";
import { ReplayReport } from "./types";

export class ReportGenerator {
  private report: ReplayReport;
  private outputDir: string;

  constructor(report: ReplayReport, outputDir: string) {
    this.report = report;
    this.outputDir = outputDir;
  }

  printTerminalSummary(): void {
    console.log("");
    console.log(chalk.bold("=== REPLAY SUMMARY ==="));
    console.log("");

    const summaryTable = new Table({
      head: [chalk.cyan("Metric"), chalk.cyan("Value")],
      colWidths: [30, 50]
    });

    summaryTable.push(
      ["Run ID", this.report.runId],
      ["Start Time", this.report.startTime.toLocaleString()],
      ["End Time", this.report.endTime.toLocaleString()],
      ["Duration", `${this.report.totalDurationMs}ms`],
      ["Database", `${this.report.databaseConfig.type}://${this.report.databaseConfig.host}/${this.report.databaseConfig.database}`],
      ["Total Scripts", this.report.summary.totalScripts.toString()],
      ["Successful Scripts", chalk.green(this.report.summary.successfulScripts.toString())],
      ["Failed Scripts", chalk.red(this.report.summary.failedScripts.toString())],
      ["Total Affected Rows", this.report.summary.totalAffectedRows.toString()],
      ["Bad Rows", chalk.yellow(this.report.summary.badRowsCount.toString())],
      ["Rollback Success Rate", `${this.report.summary.rollbackSuccessRate}%`]
    );

    console.log(summaryTable.toString());
    console.log("");

    if (this.report.executionResults.length > 0) {
      console.log(chalk.bold("=== EXECUTION RESULTS ==="));
      console.log("");

      const execTable = new Table({
        head: [chalk.cyan("Script"), chalk.cyan("Status"), chalk.cyan("Duration"), chalk.cyan("Affected"), chalk.cyan("Rollback")],
        colWidths: [25, 15, 15, 15, 15]
      });

      for (const result of this.report.executionResults) {
        const status = result.success 
          ? chalk.green("SUCCESS") 
          : chalk.red("FAILED");
        
        let rollbackStatus = "-";
        if (result.rollbackResult) {
          if (result.rollbackResult.success) {
            rollbackStatus = result.rollbackResult.verified 
              ? chalk.green("VERIFIED") 
              : chalk.yellow("UNVERIFIED");
          } else {
            rollbackStatus = chalk.red("FAILED");
          }
        }

        execTable.push([
          result.scriptName,
          status,
          `${result.durationMs}ms`,
          result.affectedRows.toString(),
          rollbackStatus
        ]);
      }

      console.log(execTable.toString());
      console.log("");
    }

    if (this.report.badRows.length > 0) {
      console.log(chalk.bold.yellow("=== BAD ROWS ==="));
      console.log("");

      const badRowsTable = new Table({
        head: [chalk.cyan("Row ID"), chalk.cyan("Table"), chalk.cyan("Source"), chalk.cyan("Reason")],
        colWidths: [20, 20, 25, 35]
      });

      for (const badRow of this.report.badRows) {
        badRowsTable.push([
          badRow.id,
          badRow.tableName,
          `${badRow.sourceFile}:${badRow.sourceLine}`,
          badRow.reason
        ]);
      }

      console.log(badRowsTable.toString());
      console.log("");
    }
  }

  exportJson(): void {
    const filePath = path.join(this.outputDir, "report.json");
    const jsonData = {
      ...this.report,
      startTime: this.report.startTime.toISOString(),
      endTime: this.report.endTime.toISOString(),
      executionResults: this.report.executionResults.map(r => ({
        ...r,
        startTime: r.startTime.toISOString(),
        endTime: r.endTime.toISOString()
      }))
    };
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
  }

  exportMarkdown(): void {
    const filePath = path.join(this.outputDir, "report.md");
    const lines: string[] = [];

    lines.push("# SQL Migration Shadow Replay Report");
    lines.push("");
    lines.push(`**Run ID**: ${this.report.runId}`);
    lines.push(`**Started**: ${this.report.startTime.toLocaleString()}`);
    lines.push(`**Completed**: ${this.report.endTime.toLocaleString()}`);
    lines.push(`**Duration**: ${this.report.totalDurationMs}ms`);
    lines.push("");

    lines.push("## Summary");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Database | ${this.report.databaseConfig.type}://${this.report.databaseConfig.host}/${this.report.databaseConfig.database} |`);
    lines.push(`| Total Scripts | ${this.report.summary.totalScripts} |`);
    lines.push(`| Successful Scripts | ${this.report.summary.successfulScripts} |`);
    lines.push(`| Failed Scripts | ${this.report.summary.failedScripts} |`);
    lines.push(`| Total Affected Rows | ${this.report.summary.totalAffectedRows} |`);
    lines.push(`| Bad Rows | ${this.report.summary.badRowsCount} |`);
    lines.push(`| Rollback Success Rate | ${this.report.summary.rollbackSuccessRate}% |`);
    lines.push("");

    lines.push("## Input Files");
    lines.push("");
    lines.push("### Migration Scripts");
    lines.push("");
    this.report.inputFiles.migrationScripts.forEach(s => lines.push(`- ${s}`));
    lines.push("");
    
    lines.push("### Shadow Data Tables");
    lines.push("");
    this.report.inputFiles.shadowData.forEach(d => lines.push(`- ${d}`));
    lines.push("");

    lines.push("## Execution Results");
    lines.push("");
    lines.push("| Script | Status | Duration | Affected Rows | Rollback |");
    lines.push("|--------|--------|----------|---------------|----------|");
    
    for (const result of this.report.executionResults) {
      const status = result.success ? "✅ SUCCESS" : "❌ FAILED";
      let rollback = "-";
      if (result.rollbackResult) {
        if (result.rollbackResult.success) {
          rollback = result.rollbackResult.verified ? "✅ VERIFIED" : "⚠️ UNVERIFIED";
        } else {
          rollback = "❌ FAILED";
        }
      }
      lines.push(`| ${result.scriptName} | ${status} | ${result.durationMs}ms | ${result.affectedRows} | ${rollback} |`);
    }
    lines.push("");

    if (this.report.badRows.length > 0) {
      lines.push("## Bad Rows");
      lines.push("");
      lines.push("| Row ID | Table | Source | Reason |");
      lines.push("|--------|-------|--------|--------|");
      
      for (const badRow of this.report.badRows) {
        lines.push(`| ${badRow.id} | ${badRow.tableName} | ${badRow.sourceFile}:${badRow.sourceLine} | ${badRow.reason} |`);
      }
      lines.push("");
      
      lines.push("### Bad Row Details");
      lines.push("");
      for (const badRow of this.report.badRows) {
        lines.push(`#### ${badRow.id}`);
        lines.push("");
        lines.push(`- **Table**: ${badRow.tableName}`);
        lines.push(`- **Source**: ${badRow.sourceFile}:${badRow.sourceLine}`);
        lines.push(`- **Reason**: ${badRow.reason}`);
        if (badRow.error) {
          lines.push(`- **Error**: ${badRow.error.message}`);
        }
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(badRow.rawData, null, 2));
        lines.push("```");
        lines.push("");
      }
    }

    lines.push("## Output Files");
    lines.push("");
    lines.push(`- [JSON Report](report.json)`);
    lines.push(`- [Execution Log](execution.log)`);
    lines.push("");

    fs.writeFileSync(filePath, lines.join("\n"));
  }

  exportAll(): void {
    this.printTerminalSummary();
    this.exportJson();
    this.exportMarkdown();
  }
}
