import { v4 as uuidv4 } from 'uuid';
import {
  ProcessingReport,
  ProcessingResult,
  ApprovalStatus,
  BlockReason
} from '../types';

export class ReportGenerator {
  generateReport(results: ProcessingResult[], totalProcessingTimeMs: number): ProcessingReport {
    const successfulBatches = results.filter(r => r.finalStatus === ApprovalStatus.APPROVED).length;
    const blockedBatches = results.filter(r => r.finalStatus === ApprovalStatus.BLOCKED).length;
    const duplicateBatches = results.filter(r => r.isDuplicate).length;

    const comparisons = results.map(result => ({
      batchId: result.batchId,
      before: {
        status: result.originalStatus,
        eventCount: result.timeline.events.length
      },
      after: {
        status: result.finalStatus,
        eventCount: result.timeline.events.length,
        blockReasons: result.blockReasons
      }
    }));

    const overallNextSteps = this.generateOverallNextSteps(results);

    return {
      reportId: uuidv4(),
      generatedAt: new Date(),
      totalBatches: results.length,
      successfulBatches,
      blockedBatches,
      duplicateBatches,
      totalProcessingTimeMs,
      results,
      comparisons,
      overallNextSteps
    };
  }

  private generateOverallNextSteps(results: ProcessingResult[]): string[] {
    const steps: string[] = [];
    const blockedResults = results.filter(r => r.finalStatus === ApprovalStatus.BLOCKED);
    
    if (blockedResults.length > 0) {
      steps.push('Total ' + blockedResults.length + ' batches blocked, please prioritize missing approval comment issues');
      
      const missingCommentCount = blockedResults.filter(r => 
        r.blockReasons.includes(BlockReason.MISSING_APPROVAL_COMMENT)
      ).length;
      
      if (missingCommentCount > 0) {
        steps.push('Of which ' + missingCommentCount + ' batches blocked due to missing approval comments, please contact approvers to supplement');
      }
    }

    const duplicateResults = results.filter(r => r.isDuplicate);
    if (duplicateResults.length > 0) {
      steps.push('Detected ' + duplicateResults.length + ' duplicate submission batches, please verify if reprocessing is needed');
    }

    const conflictResults = results.filter(r => r.hasConflicts);
    if (conflictResults.length > 0) {
      steps.push(conflictResults.length + ' batches have conclusion conflicts, requiring manual review');
    }

    if (steps.length === 0) {
      steps.push('All batches processed successfully, no pending items');
    }

    return steps;
  }

  formatReportAsText(report: ProcessingReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('Approval Log Analysis Report');
    lines.push('Report ID: ' + report.reportId);
    lines.push('Generated At: ' + report.generatedAt.toLocaleString());
    lines.push('Total Processing Time: ' + (report.totalProcessingTimeMs / 1000).toFixed(2) + ' seconds');
    lines.push('='.repeat(80));
    lines.push('');

    lines.push('Processing Overview');
    lines.push('Total Batches: ' + report.totalBatches);
    lines.push('Approved Batches: ' + report.successfulBatches);
    lines.push('Blocked Batches: ' + report.blockedBatches);
    lines.push('Duplicate Batches: ' + report.duplicateBatches);
    lines.push('');

    lines.push('Batch Comparison Details');
    for (const comp of report.comparisons) {
      lines.push('');
      lines.push('Batch ' + comp.batchId + ':');
      lines.push('  Before: Status=' + comp.before.status + ', Event Count=' + comp.before.eventCount);
      lines.push('  After: Status=' + comp.after.status + ', Event Count=' + comp.after.eventCount);
      if (comp.after.blockReasons.length > 0) {
        lines.push('  Block Reasons: ' + comp.after.blockReasons.join(', '));
      }
    }
    lines.push('');

    lines.push('Detailed Processing Results');
    for (const result of report.results) {
      lines.push('');
      lines.push('Batch ' + result.batchId + ' (Ticket ' + result.ticketId + '):');
      lines.push('  Original Status: ' + result.originalStatus + ' -> Final Status: ' + result.finalStatus);
      
      if (result.isDuplicate) {
        lines.push('  [Warning] Duplicate Submission: Reused conclusion from batch ' + result.duplicateOfBatchId);
      }
      
      if (result.blockReasons.length > 0) {
        lines.push('  [Blocked] Block Reasons:');
        for (let i = 0; i < result.blockExplanations.length; i++) {
          lines.push('     ' + (i + 1) + '. ' + result.blockExplanations[i]);
        }
      }

      if (result.nextSteps.length > 0) {
        lines.push('  [Next Steps] Recommendations:');
        for (const step of result.nextSteps) {
          lines.push('     - ' + step);
        }
      }

      if (result.relatedTicketReferences && result.relatedTicketReferences.length > 0) {
        lines.push('  [Related] Customer Service Tickets: ' + result.relatedTicketReferences.join(', '));
      }

      lines.push('  Processed At: ' + result.processedAt.toLocaleString());
      lines.push('  Rule Version: ' + result.ruleSnapshotVersion);
    }
    lines.push('');

    lines.push('Overall Next Steps');
    for (let i = 0; i < report.overallNextSteps.length; i++) {
      lines.push((i + 1) + '. ' + report.overallNextSteps[i]);
    }

    return lines.join('\n');
  }

  formatReportAsTable(report: ProcessingReport): string {
    const { table } = require('table');
    
    const headers = [
      'Batch ID',
      'Ticket ID',
      'Original Status',
      'Final Status',
      'Is Duplicate',
      'Block Count',
      'Event Count',
      'Rule Version'
    ];

    const rows = report.results.map(r => [
      r.batchId,
      r.ticketId,
      r.originalStatus,
      r.finalStatus,
      r.isDuplicate ? 'Yes' : 'No',
      r.blockReasons.length.toString(),
      r.timeline.events.length.toString(),
      r.ruleSnapshotVersion
    ]);

    return table([headers, ...rows]);
  }

  exportReportToFile(report: ProcessingReport, filePath: string, format: 'text' | 'json' = 'text'): void {
    const fs = require('fs');
    let content: string;

    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
    } else {
      content = this.formatReportAsText(report);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
