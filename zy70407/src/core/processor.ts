import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingResult,
  ApprovalTicket,
  ApprovalLog,
  ApprovalStatus,
  BlockReason,
  RuleEvaluationResult
} from '../types';
import { TimelineBuilder } from './timeline-builder';
import { RuleEngine } from './rule-engine';
import { ResultManager } from './result-manager';
import { ReportGenerator } from './report-generator';

export class ApprovalProcessor {
  private timelineBuilder: TimelineBuilder;
  private ruleEngine: RuleEngine;
  private resultManager: ResultManager;
  private reportGenerator: ReportGenerator;

  constructor() {
    this.timelineBuilder = new TimelineBuilder();
    this.ruleEngine = new RuleEngine();
    this.resultManager = new ResultManager();
    this.reportGenerator = new ReportGenerator();
  }

  loadLogs(logs: ApprovalLog[]): void {
    this.timelineBuilder.addLogs(logs);
  }

  loadRules(rules: any[]): void {
    const parsedRules = rules.map(rule => ({
      ...rule,
      effectiveFrom: new Date(rule.effectiveFrom),
      effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : undefined
    }));
    this.ruleEngine.loadRules(parsedRules);
  }

  processBatch(ticket: ApprovalTicket, evaluationDate?: Date): ProcessingResult {
    const startTime = Date.now();
    const originalStatus = ticket.currentStatus;

    const timeline = this.timelineBuilder.buildTimeline(ticket.batchId, ticket.ticketId);

    const duplicates = this.resultManager.findDuplicates(timeline, ticket.ticketId, ticket);
    if (duplicates.length > 0) {
      const existingResult = this.resultManager.reuseExistingResult(ticket.batchId, duplicates[0]);
      if (existingResult) {
        this.resultManager.saveResult(existingResult, ticket);
        return existingResult;
      }
    }

    const ruleResults = this.ruleEngine.evaluateTimeline(timeline, ticket, evaluationDate);
    const failedResults = ruleResults.filter(r => !r.passed);

    const blockReasons: BlockReason[] = [];
    const blockExplanations: string[] = [];
    const nextSteps: string[] = [];

    for (const failed of failedResults) {
      if (failed.ruleId === 'RULE-001') {
        blockReasons.push(BlockReason.MISSING_APPROVAL_COMMENT);
      }
      if (failed.failureExplanation) {
        blockExplanations.push(failed.failureExplanation);
      }
      if (failed.nextStepSuggestion) {
        nextSteps.push(failed.nextStepSuggestion);
      }
    }

    let finalStatus: ApprovalStatus;
    if (blockReasons.length > 0) {
      finalStatus = ApprovalStatus.BLOCKED;
    } else if (originalStatus === ApprovalStatus.IN_PROGRESS) {
      finalStatus = ApprovalStatus.APPROVED;
    } else {
      finalStatus = originalStatus;
    }

    const relatedTicketReferences = this.resultManager.getEscalationTicketReferences(ticket.batchId);

    const result: ProcessingResult = {
      batchId: ticket.batchId,
      ticketId: ticket.ticketId,
      processedAt: new Date(),
      processingDurationMs: Date.now() - startTime,
      originalStatus,
      finalStatus,
      timeline,
      ruleResults,
      blockReasons,
      blockExplanations,
      isDuplicate: false,
      hasConflicts: false,
      nextSteps,
      relatedTicketReferences: relatedTicketReferences.length > 0 ? relatedTicketReferences : undefined,
      ruleSnapshotVersion: this.ruleEngine.getRuleVersion()
    };

    const conflicts = this.resultManager.checkForConflicts(result);
    if (conflicts.length > 0) {
      result.hasConflicts = true;
      result.conflictDetails = conflicts;
    }

    this.resultManager.saveResult(result, ticket);
    return result;
  }

  processBatches(tickets: ApprovalTicket[], evaluationDate?: Date): ProcessingResult[] {
    const startTime = Date.now();
    const results = tickets.map(ticket => this.processBatch(ticket, evaluationDate));
    const totalTime = Date.now() - startTime;

    const report = this.reportGenerator.generateReport(results, totalTime);
    report.results = results; 

    return results;
  }

  getReport(results?: ProcessingResult[]) {
    const targetResults = results || this.resultManager.getAllResults();
    const totalTime = targetResults.reduce((sum, r) => sum + r.processingDurationMs, 0);
    return this.reportGenerator.generateReport(targetResults, totalTime);
  }

  formatReport(report: any, format: 'text' | 'table' = 'text'): string {
    if (format === 'table') {
      return this.reportGenerator.formatReportAsTable(report);
    }
    return this.reportGenerator.formatReportAsText(report);
  }

  exportReport(report: any, filePath: string, format: 'text' | 'json' = 'text'): void {
    this.reportGenerator.exportReportToFile(report, filePath, format);
  }

  exportResults(filePath: string): void {
    this.resultManager.exportResults(filePath);
  }

  importResults(filePath: string): void {
    this.resultManager.importResults(filePath);
  }

  getResult(batchId: string): ProcessingResult | undefined {
    return this.resultManager.getResult(batchId);
  }

  getAllResults(): ProcessingResult[] {
    return this.resultManager.getAllResults();
  }

  addReview(review: any): void {
    this.resultManager.addReview(review);
  }

  getReviews(batchId: string): any[] {
    return this.resultManager.getReviewsForBatch(batchId);
  }
}
