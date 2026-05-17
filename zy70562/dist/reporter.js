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
exports.Reporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class Reporter {
    generate(result, outputDir) {
        console.log("\n" + chalk_1.default.bold.blue("=".repeat(60)));
        console.log(chalk_1.default.bold.blue("  Prometheus Rule Lint Report"));
        console.log(chalk_1.default.bold.blue("=".repeat(60)) + "\n");
        console.log(chalk_1.default.bold("📊 Summary:"));
        console.log(`  Total Rules: ${result.summary.totalRules}`);
        console.log(`  Total Groups: ${result.summary.totalGroups}`);
        console.log(`  Total Issues: ${result.summary.totalIssues}`);
        console.log(`    ${chalk_1.default.red("Errors:")} ${result.summary.errors}`);
        console.log(`    ${chalk_1.default.yellow("Warnings:")} ${result.summary.warnings}`);
        console.log(`    ${chalk_1.default.blue("Infos:")} ${result.summary.infos}`);
        console.log(`  Rules with Issues: ${result.summary.rulesWithIssues}`);
        console.log();
        if (result.summary.totalIssues > 0) {
            console.log(chalk_1.default.bold("🔍 Issues:\n"));
            for (const rule of result.results) {
                if (rule.issues.length > 0) {
                    this.printRuleIssues(rule);
                }
            }
        }
        const evaluatedRules = result.results.filter((r) => r.sampleEvaluations && r.sampleEvaluations.length > 0);
        if (evaluatedRules.length > 0) {
            console.log(chalk_1.default.bold("🧪 Sample Evaluations:\n"));
            for (const rule of evaluatedRules) {
                this.printRuleEvaluations(rule);
            }
        }
        console.log("\n" + chalk_1.default.bold.blue("=".repeat(60)));
        if (outputDir) {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const basePath = path.join(outputDir, "prom-rule-lint-" + timestamp);
            fs.writeFileSync(basePath + ".json", JSON.stringify(result, null, 2));
            this.generateMarkdown(result, basePath + ".md");
            console.log(chalk_1.default.green("\n📄 Reports saved to: ") + outputDir);
        }
    }
    printRuleIssues(rule) {
        console.log(chalk_1.default.bold(`  Rule: ${chalk_1.default.cyan(rule.ruleName)}`));
        console.log(`  Group: ${rule.groupName}`);
        console.log(`  File: ${path.basename(rule.filePath)}`);
        console.log(`  Expression: ${rule.expr}`);
        console.log();
        for (const issue of rule.issues) {
            const typeColor = issue.type === "error" ? chalk_1.default.red :
                issue.type === "warning" ? chalk_1.default.yellow : chalk_1.default.blue;
            console.log(`    ${typeColor(`[${issue.type.toUpperCase()}]`)} ${issue.message}`);
            if (issue.line) {
                console.log(`      Line: ${issue.line}`);
            }
            if (issue.rawContent) {
                console.log(`      Content: ${chalk_1.default.gray(issue.rawContent)}`);
            }
            console.log();
        }
        console.log("  " + "-".repeat(56) + "\n");
    }
    printRuleEvaluations(rule) {
        if (!rule.sampleEvaluations || rule.sampleEvaluations.length === 0)
            return;
        console.log(chalk_1.default.bold(`  Rule: ${chalk_1.default.cyan(rule.ruleName)}`));
        console.log(`  Expression: ${rule.expr}`);
        console.log();
        const triggeredCount = rule.sampleEvaluations.filter(e => e.triggersAlert).length;
        console.log(`  Total Evaluations: ${rule.sampleEvaluations.length}`);
        console.log(`  ${chalk_1.default.red("Alert Triggered:")} ${triggeredCount} samples`);
        console.log(`  ${chalk_1.default.green("No Alert:")} ${rule.sampleEvaluations.length - triggeredCount} samples`);
        console.log();
        for (const evaluation of rule.sampleEvaluations.slice(0, 5)) {
            const statusColor = evaluation.triggersAlert ? chalk_1.default.red : chalk_1.default.green;
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
    generateMarkdown(result, filePath) {
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
exports.Reporter = Reporter;
