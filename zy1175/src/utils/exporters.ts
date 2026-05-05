import fs from 'fs';
import path from 'path';
import {
  Report,
  CheckResult,
  FunnelAnalysis,
  DiffResult,
  ReportSummary,
} from '../types';

export function generateReport(
  checkResults: CheckResult[],
  funnelAnalyses: FunnelAnalysis[],
  diffResults: any,
  context: any
): Report {
  const errorCount = checkResults.filter(r => r.type === 'error').length;
  const warningCount = checkResults.filter(r => r.type === 'warning').length;
  const infoCount = checkResults.filter(r => r.type === 'info').length;
  
  const criticalIssues: string[] = [];
  
  // Identify critical issues
  if (errorCount > 0) {
    criticalIssues.push(`Found ${errorCount} errors in tracking data`);
  }
  
  // Check for funnel breakpoints
  funnelAnalyses.forEach((analysis) => {
    analysis.breakpoints.forEach((bp) => {
      if (bp.drop_off_rate > 50) {
        criticalIssues.push(
          `Critical drop-off (${bp.drop_off_rate.toFixed(1)}%) in funnel "${analysis.funnel_name}" between "${bp.step_name}" and "${bp.next_step_name}"`
        );
      }
    });
  });
  
  // Check for warehouse discrepancies
  if (diffResults && diffResults.countComparison) {
    const diff = diffResults.countComparison.difference;
    const diffPercent = diffResults.countComparison.differencePercent;
    if (Math.abs(diffPercent) > 10) {
      criticalIssues.push(
        `Significant discrepancy between client and warehouse: ${diff > 0 ? '+' : ''}${diff} events (${diffPercent.toFixed(1)}%)`
      );
    }
  }
  
  const summary: ReportSummary = {
    total_events: context.events?.length || 0,
    total_errors: errorCount,
    total_warnings: warningCount,
    critical_issues: criticalIssues,
  };
  
  return {
    generated_at: new Date().toISOString(),
    check_results: checkResults,
    funnel_analyses: funnelAnalyses,
    diff_results: [diffResults?.eventComparison || {} as DiffResult],
    summary,
  };
}

export function exportToJSON(report: Report, filePath: string): void {
  const content = JSON.stringify(report, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function exportToCSV(report: Report, basePath: string): void {
  const dir = path.dirname(basePath);
  const baseName = path.basename(basePath, path.extname(basePath));
  
  // Export check results
  if (report.check_results.length > 0) {
    const checkCsvPath = path.join(dir, `${baseName}-check-results.csv`);
    const checkCsv = [
      'Severity,Category,Message,Event ID,Event Name,Timestamp',
      ...report.check_results.map((r) =>
        [
          r.type,
          r.category,
          `"${r.message.replace(/"/g, '""')}"`,
          r.event_id || '',
          r.event_name || '',
          r.timestamp || '',
        ].join(',')
      ),
    ].join('\n');
    
    fs.writeFileSync(checkCsvPath, checkCsv, 'utf-8');
    console.log(`  - Check results: ${checkCsvPath}`);
  }
  
  // Export funnel analyses
  if (report.funnel_analyses.length > 0) {
    const funnelCsvPath = path.join(dir, `${baseName}-funnel-analysis.csv`);
    const funnelLines: string[] = ['Funnel Name,Step,Count,Conversion Rate,Drop-off Rate'];
    
    report.funnel_analyses.forEach((analysis) => {
      analysis.steps.forEach((step, index) => {
        funnelLines.push(
          [
            `"${analysis.funnel_name}"`,
            `${index + 1}. ${step.event_name}`,
            step.count,
            `${step.conversion_rate?.toFixed(1) || ''}%`,
            `${step.drop_off_rate?.toFixed(1) || ''}%`,
          ].join(',')
        );
      });
    });
    
    fs.writeFileSync(funnelCsvPath, funnelLines.join('\n'), 'utf-8');
    console.log(`  - Funnel analysis: ${funnelCsvPath}`);
  }
  
  // Export breakpoints
  const breakpoints = report.funnel_analyses.flatMap((a) =>
    a.breakpoints.map((bp) => ({ ...bp, funnel_name: a.funnel_name }))
  );
  
  if (breakpoints.length > 0) {
    const bpCsvPath = path.join(dir, `${baseName}-breakpoints.csv`);
    const bpCsv = [
      'Funnel Name,From Step,To Step,Drop-off Count,Drop-off Rate',
      ...breakpoints.map((bp) =>
        [
          `"${bp.funnel_name}"`,
          bp.step_name,
          bp.next_step_name,
          bp.drop_off_count,
          `${bp.drop_off_rate.toFixed(1)}%`,
        ].join(',')
      ),
    ].join('\n');
    
    fs.writeFileSync(bpCsvPath, bpCsv, 'utf-8');
    console.log(`  - Breakpoints: ${bpCsvPath}`);
  }
}

export function exportToMarkdown(report: Report, filePath: string): void {
  const lines: string[] = [];
  
  // Title
  lines.push('# Tracking Analysis Report');
  lines.push('');
  lines.push(`**Generated at:** ${report.generated_at}`);
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Events | ${report.summary.total_events} |`);
  lines.push(`| Errors | ${report.summary.total_errors} |`);
  lines.push(`| Warnings | ${report.summary.total_warnings} |`);
  lines.push('');
  
  if (report.summary.critical_issues.length > 0) {
    lines.push('### Critical Issues');
    lines.push('');
    report.summary.critical_issues.forEach((issue) => {
      lines.push(`- ⚠️ ${issue}`);
    });
    lines.push('');
  }
  
  // Check Results
  if (report.check_results.length > 0) {
    lines.push('## Check Results');
    lines.push('');
    
    const errors = report.check_results.filter((r) => r.type === 'error');
    const warnings = report.check_results.filter((r) => r.type === 'warning');
    const infos = report.check_results.filter((r) => r.type === 'info');
    
    if (errors.length > 0) {
      lines.push('### Errors');
      lines.push('');
      lines.push('| Category | Message | Event ID |');
      lines.push('|----------|---------|----------|');
      errors.forEach((r) => {
        lines.push(`| ${r.category} | ${r.message} | ${r.event_id || '-'} |`);
      });
      lines.push('');
    }
    
    if (warnings.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      lines.push('| Category | Message | Event ID |');
      lines.push('|----------|---------|----------|');
      warnings.forEach((r) => {
        lines.push(`| ${r.category} | ${r.message} | ${r.event_id || '-'} |`);
      });
      lines.push('');
    }
    
    if (infos.length > 0) {
      lines.push('### Info');
      lines.push('');
      lines.push('| Category | Message | Event ID |');
      lines.push('|----------|---------|----------|');
      infos.forEach((r) => {
        lines.push(`| ${r.category} | ${r.message} | ${r.event_id || '-'} |`);
      });
      lines.push('');
    }
  }
  
  // Funnel Analysis
  if (report.funnel_analyses.length > 0) {
    lines.push('## Funnel Analysis');
    lines.push('');
    
    report.funnel_analyses.forEach((analysis) => {
      lines.push(`### ${analysis.funnel_name}`);
      lines.push('');
      lines.push(`**Total Conversion Rate:** ${analysis.total_conversion_rate.toFixed(1)}%`);
      lines.push('');
      
      lines.push('| Step | Count | Conversion Rate | Drop-off Rate |');
      lines.push('|------|-------|-----------------|---------------|');
      analysis.steps.forEach((step, index) => {
        lines.push(
          `| ${index + 1}. ${step.event_name} | ${step.count} | ${step.conversion_rate?.toFixed(1) || 'N/A'}% | ${step.drop_off_rate?.toFixed(1) || 'N/A'}% |`
        );
      });
      lines.push('');
      
      if (analysis.breakpoints.length > 0) {
        lines.push('#### Breakpoints');
        lines.push('');
        lines.push('| From Step | To Step | Drop-off Count | Drop-off Rate |');
        lines.push('|-----------|---------|----------------|---------------|');
        analysis.breakpoints.forEach((bp) => {
          lines.push(
            `| ${bp.step_name} | ${bp.next_step_name} | ${bp.drop_off_count} | ${bp.drop_off_rate.toFixed(1)}% |`
          );
        });
        lines.push('');
      }
    });
  }
  
  // Diff Results (if available)
  if (report.diff_results && report.diff_results.length > 0) {
    const eventComparison = report.diff_results.find((r) => r.category === 'event_comparison');
    if (eventComparison) {
      lines.push('## Warehouse Reconciliation');
      lines.push('');
      
      lines.push('| Metric | Count |');
      lines.push('|--------|-------|');
      lines.push(`| Events in both | ${eventComparison.both.length} |`);
      lines.push(`| Events in client only | ${eventComparison.in_client_only.length} |`);
      lines.push(`| Events in warehouse only | ${eventComparison.in_warehouse_only.length} |`);
      lines.push(`| Mismatched events | ${eventComparison.mismatched.length} |`);
      lines.push('');
      
      if (eventComparison.mismatched.length > 0) {
        lines.push('### Mismatched Events');
        lines.push('');
        eventComparison.mismatched.forEach((mismatch) => {
          lines.push(`**Event ID:** ${mismatch.event_id}`);
          lines.push('');
          lines.push('Differences:');
          lines.push('');
          mismatch.differences.forEach((diff) => {
            lines.push(`- ${diff}`);
          });
          lines.push('');
        });
      }
    }
  }
  
  const content = lines.join('\n');
  fs.writeFileSync(filePath, content, 'utf-8');
}
