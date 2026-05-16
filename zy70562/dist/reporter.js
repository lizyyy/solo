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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Reporter {
    generate(result, outputDir) {
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
