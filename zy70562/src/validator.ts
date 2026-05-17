import * as path from "path";
import { FileReader, resolveInputPath } from "./parsers/file-reader";
import { PromQLParser } from "./parsers/promql-parser";
import { AnnotationParser } from "./parsers/annotation-parser";
import {
  CliOptions,
  LintResult,
  RuleValidationResult,
  ValidationIssue,
  SampleSeries,
  SampleEvaluation,
} from "./types";

export class Validator {
  private options: CliOptions;

  constructor(options: CliOptions) {
    this.options = options;
  }

  async run(): Promise<LintResult> {
    const files = resolveInputPath(this.options.input);
    const allResults: RuleValidationResult[] = [];
    let samples: SampleSeries[] = [];

    if (this.options.samples) {
      try {
        const samplesReader = new FileReader(this.options.samples);
        samples = samplesReader.parseSamplesYaml();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to load samples: ${errorMessage}`);
      }
    }

    for (const filePath of files) {
      const fileResults = this.validateFile(filePath, samples);
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

  private validateFile(filePath: string, samples: SampleSeries[] = []): RuleValidationResult[] {
    const results: RuleValidationResult[] = [];
    const reader = new FileReader(filePath);

    try {
      const rulesFile = reader.parseYaml();

      if (!rulesFile || !rulesFile.groups || !Array.isArray(rulesFile.groups)) {
        results.push({
          ruleName: "__FILE_PARSE_ERROR__",
          groupName: "__INVALID_STRUCTURE__",
          filePath,
          expr: "",
          issues: [
            {
              type: "error",
              category: "structure",
              message: "Invalid or missing 'groups' field in rules file",
              ruleName: "__FILE_PARSE_ERROR__",
              groupName: "__INVALID_STRUCTURE__",
              filePath,
            },
          ],
        });
        return results;
      }

      for (const group of rulesFile.groups) {
        if (!group.name || !group.rules || !Array.isArray(group.rules)) {
          results.push({
            ruleName: "__GROUP_ERROR__",
            groupName: group.name || "__UNKNOWN_GROUP__",
            filePath,
            expr: "",
            issues: [
              {
                type: "error",
                category: "structure",
                message: `Group '${group.name || "unknown"}' is missing 'name' or 'rules' array`,
                ruleName: "__GROUP_ERROR__",
                groupName: group.name || "__UNKNOWN_GROUP__",
                filePath,
              },
            ],
          });
          continue;
        }

        for (const rule of group.rules) {
          if (!rule.alert || !rule.expr) {
            results.push({
              ruleName: rule.alert || "__MISSING_RULE_NAME__",
              groupName: group.name,
              filePath,
              expr: rule.expr || "",
              issues: [
                {
                  type: "error",
                  category: "structure",
                  message: "Rule missing required 'alert' name or 'expr' field",
                  ruleName: rule.alert || "__MISSING_RULE_NAME__",
                  groupName: group.name,
                  filePath,
                },
              ],
            });
            continue;
          }

          const result = this.validateRule(rule, group.name, filePath, reader, samples);
          results.push(result);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        ruleName: "__FILE_PARSE_ERROR__",
        groupName: "__PARSE_FAILURE__",
        filePath,
        expr: "",
        issues: [
          {
            type: "error",
            category: "parse",
            message: `Failed to parse file: ${errorMessage}`,
            ruleName: "__FILE_PARSE_ERROR__",
            groupName: "__PARSE_FAILURE__",
            filePath,
            rawContent: errorMessage,
          },
        ],
      });
    }

    return results;
  }

  private validateRule(
    rule: any, groupName: string, filePath: string, reader: FileReader, samples: SampleSeries[] = []): RuleValidationResult {
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
        message: `PromQL syntax error: ${syntaxCheck.error}`,
        ruleName: rule.alert,
        groupName,
        filePath,
        line: lineNumber,
        rawContent: rule.expr,
      });
    }

    if (rule.annotations) {
      for (const [annoKey, annoValue] of Object.entries(rule.annotations)) {
        const annotationParser = new AnnotationParser(annoValue as string);
        const referencedLabels = annotationParser.extractLabelNames();
        
        for (const labelName of referencedLabels) {
          if (!availableLabels.includes(labelName)) {
            issues.push({
              type: "warning",
              category: "annotation",
              message: `Annotation references label '${labelName}' which is not available in the expression labels. Available labels: [${availableLabels.join(", ")}]`,
              ruleName: rule.alert,
              groupName,
              filePath,
              line: lineNumber,
              rawContent: annoValue as string,
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

    const sampleEvaluations = samples.length > 0 ? 
      this.evaluateRuleWithSamples(rule, samples, parsedLabels.labels) : [];

    return {
      ruleName: rule.alert,
      groupName,
      filePath,
      expr: rule.expr,
      parsedLabels,
      issues,
      sampleEvaluations,
    };
  }

  private evaluateRuleWithSamples(
    rule: any, samples: SampleSeries[], ruleLabels: string[]): SampleEvaluation[] {
    const evaluations: SampleEvaluation[] = [];
    const parsed = new PromQLParser(rule.expr).parse();

    for (const sample of samples) {
      const hasRequiredLabels = ruleLabels.every(label => 
        Object.keys(sample.metric).includes(label)
      );

      if (!hasRequiredLabels) {
        continue;
      }

      for (const [timestamp, valueStr] of sample.values) {
        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;

        let triggersAlert = false;
        const comparisonMatch = rule.expr.match(/([=<>!]=?)\s*(-?\d+\.?\d*)/);
        if (comparisonMatch) {
          const operator = comparisonMatch[1];
          const threshold = parseFloat(comparisonMatch[2]);
          switch (operator) {
            case ">": triggersAlert = value > threshold; break;
            case ">=": triggersAlert = value >= threshold; break;
            case "<": triggersAlert = value < threshold; break;
            case "<=": triggersAlert = value <= threshold; break;
            case "==": triggersAlert = value === threshold; break;
            case "!=": triggersAlert = value !== threshold; break;
          }
        }

        const annotationRendered: Record<string, string> = {};
        if (rule.annotations) {
          for (const [key, annoValue] of Object.entries(rule.annotations)) {
            let rendered = String(annoValue);
            
            for (const [labelKey, labelValue] of Object.entries(sample.metric)) {
              rendered = rendered.replace(
                new RegExp(`{{\\s*\\.labels\\.${labelKey}\\s*}}`, "g"), labelValue
              );
              rendered = rendered.replace(
                new RegExp(`{{\\s*\\$labels\\.${labelKey}\\s*}}`, "g"), labelValue
              );
            }
            
            rendered = rendered.replace(
              new RegExp(`{{\\s*\\.value\\s*}}`, "g"), value.toString()
            );
            rendered = rendered.replace(
              new RegExp(`{{\\s*\\$value\\s*}}`, "g"), value.toString()
            );
            
            annotationRendered[key] = rendered;
          }
        }

        evaluations.push({
          labels: sample.metric,
          value,
          triggersAlert,
          annotationRendered,
        });
      }
    }

    return evaluations;
  }
}
