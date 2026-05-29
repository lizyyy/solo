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
exports.RegressionValidator = void 0;
const event_aligner_1 = require("./event-aligner");
const parameter_validator_1 = require("./parameter-validator");
const page_path_validator_1 = require("./page-path-validator");
const sampling_delay_detector_1 = require("./sampling-delay-detector");
const version_comparator_1 = require("./version-comparator");
const config_1 = require("./config");
const crypto = __importStar(require("crypto"));
class RegressionValidator {
    constructor(config) {
        this.config = (0, config_1.mergeConfig)(config || {});
    }
    validate(manifest, eventLog, baselineManifest) {
        const startTime = Date.now();
        const eventAligner = new event_aligner_1.EventAligner(manifest.events, eventLog.entries);
        const alignResult = eventAligner.align();
        const parameterValidator = new parameter_validator_1.ParameterValidator(this.config);
        const pagePathValidator = new page_path_validator_1.PagePathValidator(this.config);
        const samplingDelayDetector = new sampling_delay_detector_1.SamplingDelayDetector(this.config);
        const results = [];
        const allIssues = [...alignResult.issues];
        for (const [eventId, entries] of alignResult.matchedEvents) {
            const eventDef = manifest.events.find(e => e.id === eventId);
            const paramResult = parameterValidator.validate(eventDef.parameters, entries);
            const pageResult = pagePathValidator.validate(eventDef.pagePath, entries);
            const delayResult = samplingDelayDetector.detect(entries);
            allIssues.push(...paramResult.issues, ...pageResult.issues, ...delayResult.issues);
            const hasFailIssues = paramResult.issues.some(i => i.severity === 'high' || i.severity === 'critical');
            const hasWarningIssues = paramResult.issues.some(i => i.severity === 'medium' || i.severity === 'low') ||
                pageResult.issues.length > 0 ||
                delayResult.issues.length > 0;
            const eventResult = {
                eventId,
                eventName: eventDef.name,
                status: hasFailIssues ? 'fail' : hasWarningIssues ? 'warning' : 'pass',
                issues: [...paramResult.issues, ...pageResult.issues, ...delayResult.issues],
                parameterValidations: paramResult.results,
                pagePathMatch: pageResult.result.matches,
                expectedPagePath: pageResult.result.expected,
                actualPagePath: pageResult.result.actual,
                sampleCount: entries.length,
                firstSeen: delayResult.result.firstSeen,
                lastSeen: delayResult.result.lastSeen,
                samplingDelayMs: delayResult.result.maxDelayMs
            };
            results.push(eventResult);
        }
        for (const missingEvent of alignResult.missingEvents) {
            results.push({
                eventId: missingEvent.id,
                eventName: missingEvent.name,
                status: 'missing',
                issues: [],
                parameterValidations: [],
                pagePathMatch: false,
                expectedPagePath: missingEvent.pagePath,
                actualPagePath: undefined,
                sampleCount: 0
            });
        }
        let versionComparison;
        if (baselineManifest) {
            const versionComparator = new version_comparator_1.VersionComparator();
            versionComparison = versionComparator.compare(baselineManifest, manifest);
        }
        const summary = this.summarizeIssues(allIssues);
        const statusCounts = this.countStatuses(results);
        const report = {
            id: this.generateReportId(),
            title: `埋点回归报告 - ${manifest.releaseVersion}`,
            generatedAt: new Date().toISOString(),
            manifestVersion: manifest.version,
            releaseVersion: manifest.releaseVersion,
            totalEvents: manifest.events.filter(e => e.status === 'active').length,
            passedEvents: statusCounts.pass,
            failedEvents: statusCounts.fail,
            warningEvents: statusCounts.warning,
            missingEvents: statusCounts.missing,
            summary,
            results,
            issues: allIssues,
            versionComparison,
            notes: `生成耗时: ${Date.now() - startTime}ms`,
            attachments: []
        };
        return report;
    }
    summarizeIssues(issues) {
        const summary = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0
        };
        for (const issue of issues) {
            summary[issue.severity]++;
        }
        return summary;
    }
    countStatuses(results) {
        const counts = { pass: 0, fail: 0, warning: 0, missing: 0 };
        for (const result of results) {
            counts[result.status]++;
        }
        return counts;
    }
    generateReportId() {
        return 'report-' + crypto.randomBytes(8).toString('hex');
    }
    filterBySeverity(report, minSeverity) {
        const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
        const minIndex = severityOrder.indexOf(minSeverity);
        const filteredIssues = report.issues.filter(issue => {
            const issueIndex = severityOrder.indexOf(issue.severity);
            return issueIndex <= minIndex;
        });
        const filteredResults = report.results.map(result => ({
            ...result,
            issues: result.issues.filter(issue => {
                const issueIndex = severityOrder.indexOf(issue.severity);
                return issueIndex <= minIndex;
            })
        }));
        return {
            ...report,
            issues: filteredIssues,
            results: filteredResults,
            summary: this.summarizeIssues(filteredIssues)
        };
    }
    filterByPagePath(report, pagePath, manifest) {
        const matchingEvents = manifest.events.filter(e => e.pagePath.includes(pagePath) || pagePath.includes(e.pagePath));
        const matchingEventIds = new Set(matchingEvents.map(e => e.id));
        const filteredResults = report.results.filter(r => matchingEventIds.has(r.eventId));
        const filteredIssues = report.issues.filter(i => i.eventId && matchingEventIds.has(i.eventId));
        return {
            ...report,
            results: filteredResults,
            issues: filteredIssues,
            summary: this.summarizeIssues(filteredIssues),
            totalEvents: filteredResults.length,
            passedEvents: filteredResults.filter(r => r.status === 'pass').length,
            failedEvents: filteredResults.filter(r => r.status === 'fail').length,
            warningEvents: filteredResults.filter(r => r.status === 'warning').length,
            missingEvents: filteredResults.filter(r => r.status === 'missing').length
        };
    }
    filterByCategory(report, category, manifest) {
        const matchingEvents = manifest.events.filter(e => e.categories?.includes(category));
        const matchingEventIds = new Set(matchingEvents.map(e => e.id));
        const filteredResults = report.results.filter(r => matchingEventIds.has(r.eventId));
        const filteredIssues = report.issues.filter(i => i.eventId && matchingEventIds.has(i.eventId));
        return {
            ...report,
            results: filteredResults,
            issues: filteredIssues,
            summary: this.summarizeIssues(filteredIssues),
            totalEvents: filteredResults.length,
            passedEvents: filteredResults.filter(r => r.status === 'pass').length,
            failedEvents: filteredResults.filter(r => r.status === 'fail').length,
            warningEvents: filteredResults.filter(r => r.status === 'warning').length,
            missingEvents: filteredResults.filter(r => r.status === 'missing').length
        };
    }
}
exports.RegressionValidator = RegressionValidator;
//# sourceMappingURL=validator.js.map