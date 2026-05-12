"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanEngine = void 0;
const config_loader_1 = require("./config-loader");
const openapi_parser_1 = require("./openapi-parser");
const diff_engine_1 = require("./diff-engine");
const sample_analyzer_1 = require("./sample-analyzer");
const compliance_manager_1 = require("./compliance-manager");
class ScanEngine {
    constructor(baseDir = process.cwd()) {
        this.configLoader = new config_loader_1.ConfigLoader(baseDir);
        this.parser = new openapi_parser_1.OpenAPIParser(baseDir);
    }
    scan(configPath, filterOptions = {}) {
        const { config, anomalies: configAnomalies } = this.configLoader.loadCliConfig(configPath);
        const allDiffs = [];
        const allSampleAnalyses = [];
        const allAnomalies = [...configAnomalies];
        let totalPaths = 0;
        let exemptions = [];
        let confirmations = [];
        if (config.exemptionsPath) {
            const result = this.configLoader.loadExemptions(config.exemptionsPath);
            exemptions = result.exemptions;
            allAnomalies.push(...result.anomalies);
        }
        if (config.confirmationsPath) {
            const result = this.configLoader.loadConfirmations(config.confirmationsPath);
            confirmations = result.confirmations;
            allAnomalies.push(...result.anomalies);
        }
        const compliance = new compliance_manager_1.ComplianceManager(config.services, exemptions, confirmations);
        const diffEngine = new diff_engine_1.ContractDiffEngine(this.parser);
        const sampleAnalyzer = new sample_analyzer_1.SampleAnalyzer(this.parser);
        for (const service of config.services) {
            try {
                const oldResult = this.parser.parse(service.serviceName, service.oldContractPath);
                allAnomalies.push(...oldResult.anomalies);
                const newResult = this.parser.parse(service.serviceName, service.newContractPath);
                allAnomalies.push(...newResult.anomalies);
                totalPaths += Math.max(oldResult.parsed.paths.length, newResult.parsed.paths.length);
                const diffs = diffEngine.compare(service.serviceName, oldResult.parsed, newResult.parsed);
                allDiffs.push(...diffs);
                if (service.samplesPath) {
                    const sampleResult = sampleAnalyzer.analyze(service.serviceName, service.samplesPath, oldResult.parsed, newResult.parsed, diffs);
                    allSampleAnalyses.push(...sampleResult.analyses);
                    allAnomalies.push(...sampleResult.anomalies);
                }
            }
            catch (error) {
                allAnomalies.push({
                    type: 'invalid_contract',
                    serviceName: service.serviceName,
                    message: `服务 ${service.serviceName} 扫描失败: ${error.message}`,
                    source: service.oldContractPath
                });
            }
        }
        const filteredDiffs = compliance.applyFilters(allDiffs, filterOptions);
        const nonExemptedDiffs = compliance.filterByExemptionStatus(filteredDiffs, false);
        const summary = {
            totalServices: config.services.length,
            totalPaths,
            totalDiffs: allDiffs.length,
            blockerCount: nonExemptedDiffs.filter(d => d.severity === 'blocker').length,
            warningCount: nonExemptedDiffs.filter(d => d.severity === 'warning').length,
            infoCount: nonExemptedDiffs.filter(d => d.severity === 'info').length,
            callerMustChangeCount: nonExemptedDiffs.filter(d => d.impact === 'caller-must-change').length,
            attentionOnlyCount: nonExemptedDiffs.filter(d => d.impact === 'attention-only').length,
            ignorableCount: nonExemptedDiffs.filter(d => d.impact === 'ignorable').length,
            samplesAnalyzed: allSampleAnalyses.length,
            sampleIssues: allSampleAnalyses.reduce((acc, a) => acc + a.issues.length, 0),
            anomaliesCount: allAnomalies.length,
            exemptedCount: allDiffs.filter(d => compliance.isExempted(d)).length,
            confirmedCount: filteredDiffs.filter(d => compliance.isConfirmed(d)).length,
            hasBlockers: nonExemptedDiffs.some(d => d.severity === 'blocker')
        };
        return {
            summary,
            diffs: allDiffs,
            sampleAnalyses: allSampleAnalyses,
            anomalies: allAnomalies,
            exemptions,
            confirmations,
            filteredDiffs
        };
    }
    getConfigLoader() {
        return this.configLoader;
    }
    getParser() {
        return this.parser;
    }
}
exports.ScanEngine = ScanEngine;
//# sourceMappingURL=scan-engine.js.map