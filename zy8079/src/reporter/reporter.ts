import * as fs from 'fs';
import {
  ReplayReport,
  ReportSummary,
  SamplingResult,
  BlindPathReport,
  MixedSamplingReport,
  OrphanSpanReport,
  ClockSkewWarning,
  Trace,
} from '../model/types';
import { TraceTree, SpanNode } from '../model/traceBuilder';

export class Reporter {
  generateReport(
    results: SamplingResult[],
    traceTrees: Map<string, TraceTree>,
    traces: Map<string, Trace>
  ): ReplayReport {
    const keptTraces: string[] = [];
    const droppedTraces: string[] = [];
    const blindPathsReports: BlindPathReport[] = [];
    const mixedSamplingReports: MixedSamplingReport[] = [];
    const orphanSpanReports: OrphanSpanReport[] = [];
    const clockSkewWarnings: ClockSkewWarning[] = [];

    let totalSpans = 0;
    let keptSpans = 0;
    let droppedSpans = 0;

    for (const result of results) {
      totalSpans += result.affectedSpans.length + result.droppedSpans.length;
      keptSpans += result.affectedSpans.length;
      droppedSpans += result.droppedSpans.length;

      if (result.action === 'keep') {
        keptTraces.push(result.traceId);
      } else {
        droppedTraces.push(result.traceId);
      }

      if (result.blindPaths.length > 0) {
        blindPathsReports.push({
          traceId: result.traceId,
          paths: result.blindPaths,
        });
      }

      const tree = traceTrees.get(result.traceId);
      if (tree) {
        clockSkewWarnings.push(...tree.clockSkewWarnings);

        if (tree.orphanNodes.length > 0) {
          orphanSpanReports.push({
            traceId: result.traceId,
            orphanSpans: tree.orphanNodes.map((n: SpanNode) => n.span.spanId),
            parentSpanIds: tree.orphanNodes
              .filter((n: SpanNode) => n.span.parentSpanId)
              .map((n: SpanNode) => n.span.parentSpanId!),
          });
        }
      }

      if (this.hasMixedSampling(result, tree)) {
        mixedSamplingReports.push({
          traceId: result.traceId,
          description: 'Trace has both kept and dropped spans due to different sampling decisions',
        });
      }
    }

    const summary: ReportSummary = {
      totalTraces: results.length,
      keptTraces: keptTraces.length,
      droppedTraces: droppedTraces.length,
      mixedSamplingTraces: mixedSamplingReports.length,
      orphanSpanTraces: orphanSpanReports.length,
      tracesWithBlindPaths: blindPathsReports.length,
      totalSpans,
      keptSpans,
      droppedSpans,
    };

    return {
      summary,
      keptTraces,
      droppedTraces,
      blindPaths: blindPathsReports,
      mixedSamplingTraces: mixedSamplingReports,
      orphanSpanTraces: orphanSpanReports,
      clockSkewWarnings,
    };
  }

  private hasMixedSampling(result: SamplingResult, tree: TraceTree | undefined): boolean {
    if (!tree) return false;
    const hasKeptSpans = result.affectedSpans.length > 0;
    const hasDroppedSpans = result.droppedSpans.length > 0;
    return hasKeptSpans && hasDroppedSpans;
  }

  writeMarkdownReport(report: ReplayReport, outputPath: string): void {
    const md = this.buildMarkdown(report);
    fs.writeFileSync(outputPath, md, 'utf-8');
  }

  writeKeptTraces(keptTraceIds: string[], traces: Map<string, Trace>, outputPath: string): void {
    const kept = keptTraceIds
      .map(id => traces.get(id))
      .filter((t): t is Trace => t !== undefined);
    fs.writeFileSync(outputPath, JSON.stringify(kept, null, 2), 'utf-8');
  }

  private buildMarkdown(report: ReplayReport): string {
    const lines: string[] = [
      '# OpenTelemetry Sampling Replay Report',
      '',
      '## Summary',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Traces | ${report.summary.totalTraces} |`,
      `| Kept Traces | ${report.summary.keptTraces} |`,
      `| Dropped Traces | ${report.summary.droppedTraces} |`,
      `| Mixed Sampling Traces | ${report.summary.mixedSamplingTraces} |`,
      `| Traces with Orphan Spans | ${report.summary.orphanSpanTraces} |`,
      `| Traces with Blind Paths | ${report.summary.tracesWithBlindPaths} |`,
      `| Total Spans | ${report.summary.totalSpans} |`,
      `| Kept Spans | ${report.summary.keptSpans} |`,
      `| Dropped Spans | ${report.summary.droppedSpans} |`,
      '',
    ];

    if (report.keptTraces.length > 0) {
      lines.push('## Kept Traces');
      lines.push('');
      for (const traceId of report.keptTraces) {
        lines.push(`- \`${traceId}\``);
      }
      lines.push('');
    }

    if (report.droppedTraces.length > 0) {
      lines.push('## Dropped Traces');
      lines.push('');
      for (const traceId of report.droppedTraces) {
        lines.push(`- \`${traceId}\``);
      }
      lines.push('');
    }

    if (report.blindPaths.length > 0) {
      lines.push('## Blind Paths (Potentially Lost Error Chains)');
      lines.push('');
      for (const bp of report.blindPaths) {
        lines.push(`### Trace: \`${bp.traceId}\``);
        for (const path of bp.paths) {
          const errorType = path.errorType ? ` [${path.errorType}]` : '';
          lines.push(`- \`${path.path.join(' → ')}\`${errorType}`);
        }
        lines.push('');
      }
    }

    if (report.mixedSamplingTraces.length > 0) {
      lines.push('## Mixed Sampling Traces');
      lines.push('');
      lines.push('These traces have both kept and dropped spans:');
      lines.push('');
      for (const m of report.mixedSamplingTraces) {
        lines.push(`- \`${m.traceId}\`: ${m.description}`);
      }
      lines.push('');
    }

    if (report.orphanSpanTraces.length > 0) {
      lines.push('## Orphan Span Traces');
      lines.push('');
      lines.push('These traces have spans with non-existent parents:');
      lines.push('');
      for (const o of report.orphanSpanTraces) {
        lines.push(`### Trace: \`${o.traceId}\``);
        lines.push(`- Orphan Spans: ${o.orphanSpans.map(s => `\`${s}\``).join(', ')}`);
        lines.push('');
      }
    }

    if (report.clockSkewWarnings.length > 0) {
      lines.push('## Clock Skew Warnings');
      lines.push('');
      for (const w of report.clockSkewWarnings) {
        lines.push(`- Trace \`${w.traceId}\`, Span \`${w.spanId}\`: ${w.issue} - ${w.details}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}