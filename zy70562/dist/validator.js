"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
const file_reader_1 = require("./parsers/file-reader");
const promql_parser_1 = require("./parsers/promql-parser");
const annotation_parser_1 = require("./parsers/annotation-parser");
class Validator {
    constructor(options) {
        this.options = options;
    }
    async run() {
        const files = (0, file_reader_1.resolveInputPath)(this.options.input);
        const allResults = [];
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
    validateFile(filePath) {
        const results = [];
        const reader = new file_reader_1.FileReader(filePath);
        try {
            const rulesFile = reader.parseYaml();
            for (const group of rulesFile.groups) {
                for (const rule of group.rules) {
                    const result = this.validateRule(rule, group.name, filePath, reader);
                    results.push(result);
                }
            }
        }
        catch (error) {
            console.error("Failed to parse ${filePath}:", error);
        }
        return results;
    }
    validateRule(rule, groupName, filePath, reader) {
        const issues = [];
        const lineNumber = reader.findRuleLineNumber(rule.alert, groupName);
        const promqlParser = new promql_parser_1.PromQLParser(rule.expr);
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
                const annotationParser = new annotation_parser_1.AnnotationParser(annoValue);
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
exports.Validator = Validator;
