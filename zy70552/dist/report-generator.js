"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
class ReportGenerator {
    constructor(report, outputDir) {
        this.report = report;
        this.outputDir = outputDir;
    }
    printTerminalSummary() {
        console.log("");
        console.log(chalk_1.default.bold("=== REPLAY SUMMARY ==="));
        console.log("");
        const summaryTable = new cli_table3_1.default({
            head: [chalk_1.default.cyan("Metric"), chalk_1.default.cyan("Value")],
            colWidths: [30, 50]
        });
        summaryTable.push(["Run ID", this.report.runId], ["Start Time", this.report.startTime.toLocaleString()], ["End Time", this.report.endTime.toLocaleString()], ["Duration", `${this.report.totalDurationMs}ms`], ["Database", `${this.report.databaseConfig.type}://${this.report.databaseConfig.host}/${this.report.databaseConfig.database}`], ["Total Scripts", this.report.summary.totalScripts.toString()], ["Successful Scripts", chalk_1.default.green(this.report.summary.successfulScripts.toString())], ["Failed Scripts", chalk_1.default.red(this.report.summary.failedScripts.toString())], ["Total Affected Rows", this.report.summary.totalAffectedRows.toString()], ["Bad Rows", chalk_1.default.yellow(this.report.summary.badRowsCount.toString())], ["Rollback Success Rate", `${this.report.summary.rollbackSuccessRate}%`]);
        console.log(summaryTable.toString());
        console.log("");
        if (this.report.executionResults.length > 0) {
            console.log(chalk_1.default.bold("=== EXECUTION RESULTS ==="));
            console.log("");
            const execTable = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Script"), chalk_1.default.cyan("Status"), chalk_1.default.cyan("Duration"), chalk_1.default.cyan("Affected"), chalk_1.default.cyan("Rollback")],
                colWidths: [25, 15, 15, 15, 15]
            });
            for (const result of this.report.executionResults) {
                const status = result.success
                    ? chalk_1.default.green("SUCCESS")
                    : chalk_1.default.red("FAILED");
                let rollbackStatus = "-";
                if (result.rollbackResult) {
                    if (result.rollbackResult.success) {
                        rollbackStatus = result.rollbackResult.verified
                            ? chalk_1.default.green("VERIFIED")
                            : chalk_1.default.yellow("UNVERIFIED");
                    }
                    else {
                        rollbackStatus = chalk_1.default.red("FAILED");
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
            console.log(chalk_1.default.bold.yellow("=== BAD ROWS ==="));
            console.log("");
            const badRowsTable = new cli_table3_1.default({
                head: [chalk_1.default.cyan("Row ID"), chalk_1.default.cyan("Table"), chalk_1.default.cyan("Source"), chalk_1.default.cyan("Reason")],
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
    exportJson() {
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
    exportMarkdown() {
        const filePath = path.join(this.outputDir, "report.md");
        const lines = [];
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
                }
                else {
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
    exportAll() {
        this.printTerminalSummary();
        this.exportJson();
        this.exportMarkdown();
    }
}
exports.ReportGenerator = ReportGenerator;
