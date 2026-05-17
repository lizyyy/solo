import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { LintResult, RuleValidationResult } from "./types";

export class Reporter {
  generate(result: LintResult, outputDir?: string): void {
    console.log("\n" + chalk.bold.blue("=".repeat(60)));
    console.log(chalk.bold.blue("  Prometheus Rule Lint Report"));
    console.log(chalk.bold.blue("=".repeat(60)) + "\n");

    console.log(chalk.bold("📊 Summary:"));
    console.log(`  Total Rules: ${result.summary.totalRules}`);
    console.log(`  Total Groups: ${result.summary.totalGroups}`);
    console.log(`  Total Issues: ${result.summary.totalIssues}`);
    console.log(`    ${chalk.red("Errors:")} ${result.summary.errors}`);
    console.log(`    ${chalk.yellow("Warnings:")} ${result.summary.warnings}`);
    console.log(`    ${chalk.blue("Infos:")} ${result.summary.infos}`);
    console.log(`  Rules with Issues: ${result.summary.rulesWithIssues}`);
    console.log();

    if (result.summary.totalIssues > 0) {
      console.log(chalk.bold("🔍 Issues:\n"));
      for (const rule of result.results) {
        if (rule.issues.length > 0) {
          this.printRuleIssues(rule);
        }
      }
    }

    const evaluatedRules = result.results.filter(
      (r) => r.sampleEvaluations && r.sampleEvaluations.length > 0
    );
    if (evaluatedRules.length > 0) {
      console.log(chalk.bold("🧪 Sample Evaluations:\n"));
      for (const rule of evaluatedRules) {
        this.printRuleEvaluations(rule);
      }
    }

    console.log("\n" + chalk.bold.blue("=".repeat(60)));

    if (outputDir) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const basePath = path.join(outputDir, "prom-rule-lint-" + timestamp);
      
      fs.writeFileSync(basePath + ".json", JSON.stringify(result, null, 2));
      this.generateMarkdown(result, basePath + ".md");
      
      console.log(chalk.green("\n📄 Reports saved to: ") + outputDir);
    }
  }

  private printRuleIssues(rule: RuleValidationResult): void {
    console.log(chalk.bold(`  Rule: ${chalk.cyan(rule.ruleName)}`));
    console.log(`  Group: ${rule.groupName}`);
    console.log(`  File: ${path.basename(rule.filePath)}`);
    console.log(`  Expression: ${rule.expr}`);
    console.log();

    for (const issue of rule.issues) {
      const typeColor = issue.type === "error" ? chalk.red :
                        issue.type === "warning" ? chalk.yellow : chalk.blue;
      
      console.log(`    ${typeColor(`[${issue.type.toUpperCase()}]`)} ${issue.message}`);
      
      if (issue.line) {
        console.log(`      Line: ${issue.line}`);
      }
      
      if (issue.rawContent) {
        console.log(`      Content: ${chalk.gray(issue.rawContent)}`);
      }
      
      console.log();
    }

    console.log("  " + "-".repeat(56) + "\n");
  }

  private printRuleEvaluations(rule: RuleValidationResult): void {
    if (!rule.sampleEvaluations || rule.sampleEvaluations.length === 0) return;

    console.log(chalk.bold(`  Rule: ${chalk.cyan(rule.ruleName)}`));
    console.log(`  Expression: ${rule.expr}`);
    console.log();

    const triggeredCount = rule.sampleEvaluations.filter(e => e.triggersAlert).length;
    
    console.log(`  Total Evaluations: ${rule.sampleEvaluations.length}`);
    console.log(`  ${chalk.red("Alert Triggered:")} ${triggeredCount} samples`);
    console.log(`  ${chalk.green("No Alert:")} ${rule.sampleEvaluations.length - triggeredCount} samples`);
    console.log();

    for (const evaluation of rule.sampleEvaluations.slice(0, 5)) {
      const statusColor = evaluation.triggersAlert ? chalk.red : chalk.green;
      console.log(`    ${statusColor(evaluation.triggersAlert ? "🔴 TRIGGERED" : "🟢 OK")} Value: ${evaluation.value}`);
      console.log(`    Labels: ${JSON.stringify(evaluation.labels)}`);
      
      if (evaluation.annotationRendered) {
        console.log(`    Rendered Summary: ${evaluation.annotationRendered.summary || "N/A"}`);
      }
      console.log();
    }

    if (rule.sampleEvaluations.length > 5) {
      console.log(`    ... and ${rule.sampleEvaluations.length - 5} more evaluations\n`);
    }

    console.log("  " + "-".repeat(56) + "\n");
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
