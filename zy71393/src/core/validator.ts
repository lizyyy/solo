import {
  TrackingManifest,
  EventLog,
  RegressionReport,
  EventValidationResult,
  Issue,
  IssueSeverity,
  ValidationConfig,
  EventDefinition
} from '../types';
import { EventAligner } from './event-aligner';
import { ParameterValidator } from './parameter-validator';
import { PagePathValidator } from './page-path-validator';
import { SamplingDelayDetector } from './sampling-delay-detector';
import { VersionComparator } from './version-comparator';
import { mergeConfig } from './config';
import * as crypto from 'crypto';

export class RegressionValidator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = mergeConfig(config || {});
  }

  validate(
    manifest: TrackingManifest,
    eventLog: EventLog,
    baselineManifest?: TrackingManifest
  ): RegressionReport {
    const startTime = Date.now();
    
    const eventAligner = new EventAligner(manifest.events, eventLog.entries);
    const alignResult = eventAligner.align();

    const parameterValidator = new ParameterValidator(this.config);
    const pagePathValidator = new PagePathValidator(this.config);
    const samplingDelayDetector = new SamplingDelayDetector(this.config);

    const results: EventValidationResult[] = [];
    const allIssues: Issue[] = [...alignResult.issues];

    for (const [eventId, entries] of alignResult.matchedEvents) {
      const eventDef = manifest.events.find(e => e.id === eventId)!;
      
      const paramResult = parameterValidator.validate(eventDef.parameters, entries);
      const pageResult = pagePathValidator.validate(eventDef.pagePath, entries);
      const delayResult = samplingDelayDetector.detect(entries);

      allIssues.push(...paramResult.issues, ...pageResult.issues, ...delayResult.issues);

      const hasFailIssues = paramResult.issues.some(i => i.severity === 'high' || i.severity === 'critical');
      const hasWarningIssues = paramResult.issues.some(i => i.severity === 'medium' || i.severity === 'low') ||
                               pageResult.issues.length > 0 ||
                               delayResult.issues.length > 0;

      const eventResult: EventValidationResult = {
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
      const versionComparator = new VersionComparator();
      versionComparison = versionComparator.compare(baselineManifest, manifest);
    }

    const summary = this.summarizeIssues(allIssues);
    const statusCounts = this.countStatuses(results);

    const report: RegressionReport = {
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

  private summarizeIssues(issues: Issue[]): RegressionReport['summary'] {
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

  private countStatuses(results: EventValidationResult[]): {
    pass: number;
    fail: number;
    warning: number;
    missing: number;
  } {
    const counts = { pass: 0, fail: 0, warning: 0, missing: 0 };
    
    for (const result of results) {
      counts[result.status]++;
    }

    return counts;
  }

  private generateReportId(): string {
    return 'report-' + crypto.randomBytes(8).toString('hex');
  }

  filterBySeverity(report: RegressionReport, minSeverity: IssueSeverity): RegressionReport {
    const severityOrder: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
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

  filterByPagePath(report: RegressionReport, pagePath: string, manifest: TrackingManifest): RegressionReport {
    const matchingEvents = manifest.events.filter(e => 
      e.pagePath.includes(pagePath) || pagePath.includes(e.pagePath)
    );
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

  filterByCategory(report: RegressionReport, category: string, manifest: TrackingManifest): RegressionReport {
    const matchingEvents = manifest.events.filter(e => 
      e.categories?.includes(category)
    );
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
