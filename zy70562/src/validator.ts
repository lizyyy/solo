import * as path from "path";
import { FileReader, resolveInputPath } from "./parsers/file-reader";
import { PromQLParser } from "./parsers/promql-parser";
import { AnnotationParser } from "./parsers/annotation-parser";
import {
  CliOptions,
  LintResult,
  RuleValidationResult,
  ValidationIssue,
} from "./types";

export class Validator {
  private options: CliOptions;

  constructor(options: CliOptions) {
    this.options = options;
  }

  async run(): Promise<LintResult> {
    const files = resolveInputPath(this.options.input);
    const allResults: RuleValidationResult[] = [];

    for (const filePath of files) {
      const fileResults = this.validateFile(filePath);
      allResults.push(...fileResults);
    }

    const allIssues = allResults.flatMap((r) => r.issues);

    return {
      summary: {
        totalRules: allResults.length,
        totalGroups: new Set(allResults.map((r) => r.groupName)).size,
        totalIssues: allIssues.length,
        errors: allIssues.filter((i) => i.type === "error").length,
        warnings: allIssues.filter((i) => i.type === "warning").length,
        infos: allIssues.filter((i) => i.type === "info").length,
        rulesWithIssues: new Set(allResults.filter((r) => r.issues.length > 0).map((r) => r.ruleName)).size,
      },
      results: allResults,
      files,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  private validateFile(filePath: string): RuleValidationResult[] {
    const results: RuleValidationResult[] = [];
    const reader = new FileReader(filePath);

    try {
      const rulesFile = reader.parseYaml();

      for (const group of rulesFile.groups) {
        for (const rule of group.rules) {
          const result = this.validateRule(rule, group.name, filePath, reader);
          results.push(result);
        }
      }
    } catch (error) {
      console.error("Failed to parse ${filePath}:", error);
    }

    return results;
  }

  private validateRule(
    rule: any, groupName: string, filePath: string, reader: FileReader): RuleValidationResult {
    const issues: ValidationIssue[] = [];
    const lineNumber = reader.findRuleLineNumber(rule.alert, groupName);

    const promqlParser = new PromQLParser(rule.expr);
    const syntaxCheck = promqlParser.validateSyntax();
    const parsedLabels = promqlParser.parse();
    const availableLabels = promqlParser.getAvailableLabels();

    if (!syntaxCheck.valid) {
      issues.push({
        type: "error",
        category: "syntax",
        message: "PromQL syntax error: ${syntaxCheck.error}",
        ruleName: rule.alert,
        groupName,
        filePath,
        line: lineNumber,
        rawContent: rule.expr,
      });
    }

    if (rule.annotations) {
        for (const [annoKey, annoValue] of Object.entries(rule.annotations)) {
          const annotationParser = new AnnotationParser(annoValue as string)
          const placeholders = annotationParser.extractPlaceholders();
          
          for (const placeholder of placeholders) {
            const placeholderParts = placeholder.name.split(".");
            const labelName = placeholderParts[placeholderParts.length - 1];
            
            if (!availableLabels.includes(labelName) && 
                !["labels", "value", "externalURL", "expr"].includes(labelName)) {
              issues.push({
                type: "warning",
                category: "annotation",
                message: "Annotation placeholder references label not available in expression",
                ruleName: rule.alert,
                groupName,
                filePath,
                line: lineNumber,
                rawContent: placeholder.fullMatch,
              });
            }
          }
        }
      }

    if (!rule.annotations || !rule.annotations.summary) {
      issues.push({
        type: "warning",
        category: "annotation",
        message: "Missing summary annotation for alert",
        ruleName: rule.alert,
        groupName,
        filePath,
        line: lineNumber,
      });
    }

    if (!rule.annotations || !rule.annotations.description) {
      issues.push({
        type: "info",
        category: "annotation",
        message: "Missing description annotation for alert",
        ruleName: rule.alert,
        groupName,
        filePath,
        line: lineNumber,
      });
    }

    return {
      ruleName: rule.alert,
      groupName,
      filePath,
      expr: rule.expr,
      parsedLabels,
      issues,
    };
  }
}
