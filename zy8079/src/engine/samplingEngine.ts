import {
  SamplingRule,
  SamplingCondition,
  Span,
  SamplingResult,
  BlindPath,
} from '../model/types';
import { TraceTree } from '../model/traceBuilder';

export class SamplingEngine {
  private headRules: SamplingRule[] = [];
  private tailRules: SamplingRule[] = [];

  constructor(rules: SamplingRule[]) {
    for (const rule of rules) {
      if (rule.type === 'head') {
        this.headRules.push(rule);
      } else {
        this.tailRules.push(rule);
      }
    }
  }

  evaluateHeadSampling(trace: TraceTree): { keep: boolean; reason: string; matchedRule?: string } {
    for (const rule of this.headRules) {
      if (this.matchesRule(trace, rule, 'head')) {
        return {
          keep: rule.action === 'keep',
          reason: `Head sampling rule "${rule.name}" matched`,
          matchedRule: rule.name,
        };
      }
    }
    return { keep: true, reason: 'No head sampling rule matched, default keep' };
  }

  evaluateTailSampling(
    trace: TraceTree,
    keptSpanIds: Set<string>
  ): { keep: boolean; reason: string; matchedRule?: string } {
    for (const rule of this.tailRules) {
      if (this.matchesRule(trace, rule, 'tail')) {
        return {
          keep: rule.action === 'keep',
          reason: `Tail sampling rule "${rule.name}" matched`,
          matchedRule: rule.name,
        };
      }
    }
    return { keep: true, reason: 'No tail sampling rule matched, default keep' };
  }

  simulateFullSampling(trace: TraceTree): SamplingResult {
    const headResult = this.evaluateHeadSampling(trace);
    const droppedSpanIds = new Set<string>();

    if (!headResult.keep) {
      const allSpans = trace.getAllSpans();
      return {
        traceId: trace.traceId,
        action: 'drop',
        reason: `Head: ${headResult.reason}`,
        matchedRule: headResult.matchedRule,
        affectedSpans: allSpans.map((s: Span) => s.spanId),
        droppedSpans: allSpans.map((s: Span) => s.spanId),
        blindPaths: [],
      };
    }

    const tailResult = this.evaluateTailSampling(trace, droppedSpanIds);

    if (!tailResult.keep) {
      const allSpans = trace.getAllSpans();
      for (const span of allSpans) {
        droppedSpanIds.add(span.spanId);
      }
      return {
        traceId: trace.traceId,
        action: 'drop',
        reason: `Tail: ${tailResult.reason}`,
        matchedRule: tailResult.matchedRule,
        affectedSpans: allSpans.map((s: Span) => s.spanId),
        droppedSpans: allSpans.map((s: Span) => s.spanId),
        blindPaths: [],
      };
    }

    const blindPaths = this.findBlindPaths(trace, droppedSpanIds);

    return {
      traceId: trace.traceId,
      action: 'keep',
      reason: `Kept: ${headResult.reason}; ${tailResult.reason}`,
      affectedSpans: trace.getAllSpans().filter((s: Span) => !droppedSpanIds.has(s.spanId)).map((s: Span) => s.spanId),
      droppedSpans: Array.from(droppedSpanIds),
      blindPaths,
    };
  }

  private matchesRule(trace: TraceTree, rule: SamplingRule, phase: 'head' | 'tail'): boolean {
    if (phase === 'head') {
      return this.evaluateHeadConditions(trace, rule.conditions);
    } else {
      return this.evaluateTailConditions(trace, rule);
    }
  }

  private evaluateHeadConditions(trace: TraceTree, conditions: SamplingCondition[]): boolean {
    if (conditions.length === 0) return false;

    for (const condition of conditions) {
      if (!this.evaluateCondition(trace.getAllSpans()[0], condition)) {
        return false;
      }
    }
    return true;
  }

  private evaluateTailConditions(trace: TraceTree, rule: SamplingRule): boolean {
    if (rule.errorsOnly) {
      return trace.hasError();
    }

    if (rule.latencyThreshold !== undefined) {
      const duration = trace.getDuration();
      return duration >= rule.latencyThreshold * 1000000;
    }

    if (rule.probability !== undefined) {
      return Math.random() < rule.probability;
    }

    return false;
  }

  private evaluateCondition(span: Span | undefined, condition: SamplingCondition): boolean {
    if (!span) return false;

    const value = this.getNestedValue(span, condition.attribute);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number);
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value as string);
      case 'exists':
        return value !== undefined;
      default:
        return false;
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (typeof obj !== 'object' || obj === null) return undefined;

    const span = obj as Record<string, unknown>;
    if (path.includes('.')) {
      if (path in span) {
        return span[path];
      }
      if ('attributes' in span && typeof span.attributes === 'object' && span.attributes !== null) {
        const attrs = span.attributes as Record<string, unknown>;
        if (path in attrs) {
          return attrs[path];
        }
      }
    }

    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private findBlindPaths(trace: TraceTree, droppedSpanIds: Set<string>): BlindPath[] {
    const blindPaths: BlindPath[] = [];

    for (const [spanId, node] of trace.spanMap.entries()) {
      if (droppedSpanIds.has(spanId)) continue;

      if (node.parent && droppedSpanIds.has(node.parent.span.spanId)) {
        const errorSpan = trace.getErrorSpans().find((e: Span) => e.spanId === spanId);
        blindPaths.push({
          path: node.getPath(),
          errorType: errorSpan ? this.extractErrorType(errorSpan) : undefined,
          lastSpan: spanId,
        });
      }
    }

    return blindPaths;
  }

  private extractErrorType(span: Span): string {
    if (span.status.message) return span.status.message;
    if (span.attributes['error.type']) return String(span.attributes['error.type']);
    return 'UnknownError';
  }
}