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
    const table = new Table({ head: ["指标", "值"] });
    table.push(["运行ID", this.report.runId], ["总脚本数", this.report.summary.totalScripts], ["成功脚本", chalk.green(this.report.summary.successfulScripts)], ["失败脚本", chalk.red(this.report.summary.failedScripts)], ["坏行数", chalk.yellow(this.report.summary.badRowsCount)]);
    console.log("\n" + table.toString());
  }

  exportJson(): void {
    const filePath = path.join(this.outputDir, "report.json");
    fs.writeFileSync(filePath, JSON.stringify(this.report, null, 2));
    console.log(chalk.cyan("JSON报告已导出: " + filePath));
  }

  exportMarkdown(): void {
    const filePath = path.join(this.outputDir, "report.md");
    const md = "# SQL迁移影子回放报告\n\n## 摘要\n\n| 指标 | 值 |\n|------|-----|\n| 运行ID | " + this.report.runId + " |\n| 总脚本数 | " + this.report.summary.totalScripts + " |\n| 成功脚本 | " + this.report.summary.successfulScripts + " |\n| 失败脚本 | " + this.report.summary.failedScripts + " |\n| 坏行数 | " + this.report.summary.badRowsCount + " |\n";
    fs.writeFileSync(filePath, md);
    console.log(chalk.cyan("Markdown报告已导出: " + filePath));
  }

  exportAll(): void {
    this.printTerminalSummary();
    this.exportJson();
    this.exportMarkdown();
  }
}