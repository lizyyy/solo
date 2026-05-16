import * as fs from "fs";
import * as path from "path";
import { LintResult } from "./types";

export class Reporter {
  generate(result: LintResult, outputDir?: string): void {
    console.log("\n=== Prometheus Rule Lint Report ===");
    console.log("Total Rules:", result.summary.totalRules);
    console.log("Total Groups:", result.summary.totalGroups);
    console.log("Total Issues:", result.summary.totalIssues);
    console.log("  Errors:", result.summary.errors);
    console.log("  Warnings:", result.summary.warnings);
    console.log("  Infos:", result.summary.infos);
    console.log("Rules with Issues:", result.summary.rulesWithIssues);
    console.log("===================================\n");

    if (outputDir) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const basePath = path.join(outputDir, "prom-rule-lint-" + timestamp);
      
      fs.writeFileSync(basePath + ".json", JSON.stringify(result, null, 2));
      this.generateMarkdown(result, basePath + ".md");
      
      console.log("Reports saved to:", outputDir);
    }
  }

  private generateMarkdown(result: LintResult, filePath: string): void {
    const lines = [
      "# Prometheus Rule Lint Report",
      "",
      "Generated: " + new Date().toISOString(),
      "",
      "## Summary",
      "",
      "| Metric | Value |",
      "|--------|-------|",
      "| Total Rules | " + result.summary.totalRules + " |",
      "| Total Groups | " + result.summary.totalGroups + " |",
      "| Total Issues | " + result.summary.totalIssues + " |",
      "| Errors | " + result.summary.errors + " |",
      "| Warnings | " + result.summary.warnings + " |",
      "| Infos | " + result.summary.infos + " |",
      "",
      "## Files Scanned",
      ""
    ];

    for (const file of result.files) {
      lines.push("- " + file);
    }

    lines.push("");
    lines.push("## Rules with Issues");
    lines.push("");

    for (const rule of result.results) {
      if (rule.issues.length > 0) {
        lines.push("### " + rule.ruleName);
        lines.push("- Group: " + rule.groupName);
        lines.push("- File: " + rule.filePath);
        lines.push("- Expression: " + rule.expr);
        lines.push("");
        lines.push("#### Issues:");
        
        for (const issue of rule.issues) {
          lines.push("- **[" + issue.type.toUpperCase() + "]** " + issue.message);
          if (issue.line) {
            lines.push("  - Line: " + issue.line);
          }
          if (issue.rawContent) {
            lines.push("  - Content: " + issue.rawContent);
          }
        }
        lines.push("");
      }
    }

    fs.writeFileSync(filePath, lines.join("\n"));
  }
}
