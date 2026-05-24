"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanEngine = void 0;
const yaml_parser_1 = require("../utils/yaml-parser");
const template_renderer_1 = require("../utils/template-renderer");
const scanner_1 = require("./scanner");
const exception_manager_1 = require("./exception-manager");
class ScanEngine {
    constructor(config) {
        this.findings = [];
        this.errors = [];
        this.warnings = [];
        this.scannedFiles = new Set();
        this.config = config;
        for (const ex of config.exceptions) {
            const validationErrors = (0, exception_manager_1.validateException)(ex);
            for (const err of validationErrors) {
                this.warnings.push(`例外配置警告: ${err}`);
            }
        }
    }
    async scan() {
        this.findings = [];
        this.errors = [];
        this.warnings = [];
        this.scannedFiles = new Set();
        try {
            await this.scanValuesFile();
            if (this.config.options.templateDir) {
                await this.scanTemplateDir();
            }
            this.applyExceptionsToFindings();
        }
        catch (e) {
            this.errors.push(`扫描失败: ${e.message}`);
        }
        return this.buildResult();
    }
    async scanValuesFile() {
        const { valuesPath } = this.config.options;
        try {
            const parsed = (0, yaml_parser_1.parseYamlFile)(valuesPath);
            this.scannedFiles.add(valuesPath);
            const context = {
                filePath: valuesPath,
                rules: this.config.rules,
                verbose: this.config.options.verbose
            };
            const contentFindings = (0, scanner_1.scanContent)(parsed.content, context);
            this.findings.push(...contentFindings);
            const valueNodes = (0, yaml_parser_1.extractAllValues)(parsed.data);
            const valueFindings = (0, scanner_1.scanValueNodes)(valueNodes, context);
            this.findings.push(...valueFindings);
        }
        catch (e) {
            this.errors.push(`解析 values 文件失败: ${e.message}`);
        }
    }
    async scanTemplateDir() {
        const { templateDir, valuesPath } = this.config.options;
        try {
            const valuesParsed = (0, yaml_parser_1.parseYamlFile)(valuesPath);
            const values = valuesParsed.data;
            const renderedTemplates = (0, template_renderer_1.renderTemplateDir)(templateDir, values);
            for (const rendered of renderedTemplates) {
                this.scanRenderedTemplate(rendered);
            }
            const yamlFiles = (0, yaml_parser_1.findYamlFiles)(templateDir);
            for (const file of yamlFiles) {
                if (!this.scannedFiles.has(file)) {
                    this.scannedFiles.add(file);
                    const parsed = (0, yaml_parser_1.parseYamlFile)(file);
                    const resolvedContent = (0, template_renderer_1.resolveTemplateReferences)(parsed.content, values);
                    const context = {
                        filePath: file,
                        rules: this.config.rules,
                        verbose: this.config.options.verbose
                    };
                    const findings = (0, scanner_1.scanContent)(resolvedContent, context);
                    this.findings.push(...findings);
                }
            }
        }
        catch (e) {
            this.errors.push(`扫描模板目录失败: ${e.message}`);
        }
    }
    scanRenderedTemplate(rendered) {
        this.scannedFiles.add(rendered.filePath);
        const context = {
            filePath: rendered.filePath,
            rules: this.config.rules,
            verbose: this.config.options.verbose
        };
        if (rendered.renderedContent !== rendered.originalContent) {
            const renderedFindings = (0, scanner_1.scanContent)(rendered.renderedContent, context);
            for (const finding of renderedFindings) {
                finding.evidence = `[模板渲染后] ${finding.evidence}`;
                this.findings.push(finding);
            }
        }
        const originalFindings = (0, scanner_1.scanContent)(rendered.originalContent, context);
        this.findings.push(...originalFindings);
    }
    applyExceptionsToFindings() {
        if (this.config.exceptions.length === 0) {
            return;
        }
        const result = (0, exception_manager_1.applyExceptions)(this.findings, this.config.exceptions, this.config.options.environment);
        this.findings = result.findings;
    }
    dedupeFindings() {
        const seen = new Set();
        const unique = [];
        for (const finding of this.findings) {
            const key = `${finding.ruleId}:${finding.location.file}:${finding.location.path}:${finding.matchedValue.substring(0, 30)}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(finding);
            }
        }
        return unique;
    }
    buildResult() {
        const uniqueFindings = this.dedupeFindings();
        const bySeverity = {
            critical: uniqueFindings.filter(f => f.severity === 'critical' && !f.excepted).length,
            high: uniqueFindings.filter(f => f.severity === 'high' && !f.excepted).length,
            medium: uniqueFindings.filter(f => f.severity === 'medium' && !f.excepted).length,
            low: uniqueFindings.filter(f => f.severity === 'low' && !f.excepted).length
        };
        const excepted = uniqueFindings.filter(f => f.excepted).length;
        const expiredExceptions = uniqueFindings.filter(f => f.exceptionExpired).length;
        return {
            metadata: {
                scannedAt: new Date().toISOString(),
                environment: this.config.options.environment,
                valuesFile: this.config.options.valuesPath,
                templateDir: this.config.options.templateDir,
                rulesFile: this.config.options.rulesPath,
                exceptionsFile: this.config.options.exceptionsPath
            },
            summary: {
                totalFiles: this.scannedFiles.size,
                totalFindings: uniqueFindings.filter(f => !f.excepted).length,
                bySeverity,
                excepted,
                expiredExceptions
            },
            findings: uniqueFindings,
            errors: this.errors,
            warnings: this.warnings
        };
    }
}
exports.ScanEngine = ScanEngine;
