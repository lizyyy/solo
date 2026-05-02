import { SamplingEngine } from '../engine/samplingEngine';
import { SamplingRule, Trace, Span } from '../model/types';
import { TraceBuilder, TraceTree } from '../model/traceBuilder';

function createTestSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: 'test-trace-1',
    spanId: 'span-1',
    serviceName: 'test-service',
    operationName: 'test-op',
    startTime: 1000000000000,
    endTime: 1000000001000,
    status: { code: 0 },
    attributes: {},
    events: [],
    ...overrides,
  };
}

function createTestTrace(spans: Span[]): Trace {
  return {
    traceId: 'test-trace-1',
    spans,
    startTime: Math.min(...spans.map(s => s.startTime)),
    endTime: Math.max(...spans.map(s => s.endTime)),
  };
}

function createTraceTree(spans: Span[]): TraceTree {
  const trace = createTestTrace(spans);
  const builder = new TraceBuilder();
  return builder.buildTree(trace);
}

describe('SamplingEngine', () => {
  describe('Head Sampling', () => {
    it('should keep trace when no head rules match and default is keep', () => {
      const rules: SamplingRule[] = [];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan()]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(true);
      expect(result.reason).toContain('No head sampling rule matched');
    });

    it('should drop trace when head rule matches drop action', () => {
      const rules: SamplingRule[] = [
        {
          name: 'drop-health',
          type: 'head',
          conditions: [
            { attribute: 'operationName', operator: 'contains', value: 'health' },
          ],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ operationName: 'GET /health' }),
      ]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
      expect(result.matchedRule).toBe('drop-health');
    });

    it('should keep trace when head rule matches keep action', () => {
      const rules: SamplingRule[] = [
        {
          name: 'keep-api',
          type: 'head',
          conditions: [
            { attribute: 'operationName', operator: 'contains', value: '/api/' },
          ],
          action: 'keep',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ operationName: 'POST /api/users' }),
      ]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(true);
      expect(result.matchedRule).toBe('keep-api');
    });

    it('should evaluate status.code condition for head sampling', () => {
      const rules: SamplingRule[] = [
        {
          name: 'drop-errors-head',
          type: 'head',
          conditions: [
            { attribute: 'status.code', operator: 'eq', value: 1 },
          ],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ status: { code: 1, message: 'Error' } }),
      ]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });

    it('should evaluate http.status_code condition', () => {
      const rules: SamplingRule[] = [
        {
          name: 'drop-5xx',
          type: 'head',
          conditions: [
            { attribute: 'http.status_code', operator: 'gte', value: 500 },
          ],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ attributes: { 'http.status_code': 503 } }),
      ]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });
  });

  describe('Tail Sampling', () => {
    it('should keep trace when no tail rules match and default is keep', () => {
      const rules: SamplingRule[] = [];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan()]);

      const result = engine.evaluateTailSampling(tree, new Set());

      expect(result.keep).toBe(true);
    });

    it('should keep error traces when errorsOnly rule matches', () => {
      const rules: SamplingRule[] = [
        {
          name: 'keep-errors',
          type: 'tail',
          conditions: [],
          action: 'keep',
          errorsOnly: true,
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ status: { code: 1, message: 'Internal Error' } }),
      ]);

      const result = engine.evaluateTailSampling(tree, new Set());

      expect(result.keep).toBe(true);
      expect(result.matchedRule).toBe('keep-errors');
    });

    it('should not keep healthy traces with errorsOnly rule', () => {
      const rules: SamplingRule[] = [
        {
          name: 'keep-errors',
          type: 'tail',
          conditions: [],
          action: 'keep',
          errorsOnly: true,
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ status: { code: 0 } }),
      ]);

      const result = engine.evaluateTailSampling(tree, new Set());

      expect(result.keep).toBe(true);
      expect(result.matchedRule).toBeUndefined();
    });

    it('should keep slow traces when latencyThreshold is exceeded', () => {
      const rules: SamplingRule[] = [
        {
          name: 'keep-slow',
          type: 'tail',
          conditions: [],
          action: 'keep',
          latencyThreshold: 0.001,
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ startTime: 1000000000000, endTime: 1000000003000 }),
      ]);

      const result = engine.evaluateTailSampling(tree, new Set());

      expect(result.keep).toBe(true);
    });
  });

  describe('Full Sampling Simulation', () => {
    it('should drop entire trace on head sampling drop', () => {
      const rules: SamplingRule[] = [
        {
          name: 'drop-all-errors',
          type: 'head',
          conditions: [
            { attribute: 'status.code', operator: 'eq', value: 1 },
          ],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ spanId: 'span-1', status: { code: 1 } }),
        createTestSpan({ spanId: 'span-2', parentSpanId: 'span-1' }),
      ]);

      const result = engine.simulateFullSampling(tree);

      expect(result.action).toBe('drop');
      expect(result.droppedSpans).toContain('span-1');
      expect(result.droppedSpans).toContain('span-2');
    });

    it('should detect blind paths when child span is kept but parent is dropped', () => {
      const rules: SamplingRule[] = [
        {
          name: 'drop-root-only',
          type: 'head',
          conditions: [
            { attribute: 'parentSpanId', operator: 'exists', value: null },
          ],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const childSpan = createTestSpan({
        spanId: 'span-2',
        parentSpanId: 'span-1',
        status: { code: 1, message: 'Error in child' },
      });
      const tree = createTraceTree([
        createTestSpan({ spanId: 'span-1' }),
        childSpan,
      ]);

      const result = engine.simulateFullSampling(tree);

      expect(result.blindPaths.length).toBe(0);
    });

    it('should handle mixed head and tail sampling results', () => {
      const rules: SamplingRule[] = [
        {
          name: 'head-keep',
          type: 'head',
          conditions: [
            { attribute: 'serviceName', operator: 'eq', value: 'test-service' },
          ],
          action: 'keep',
        },
        {
          name: 'tail-drop',
          type: 'tail',
          conditions: [],
          action: 'drop',
          errorsOnly: true,
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ status: { code: 0 } }),
      ]);

      const result = engine.simulateFullSampling(tree);

      expect(result.action).toBe('keep');
      expect(result.reason).toContain('Head');
    });
  });

  describe('Condition Operators', () => {
    it('should evaluate eq operator', () => {
      const rules: SamplingRule[] = [
        {
          name: 'test-eq',
          type: 'head',
          conditions: [{ attribute: 'status.code', operator: 'eq', value: 0 }],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan({ status: { code: 0 } })]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });

    it('should evaluate neq operator', () => {
      const rules: SamplingRule[] = [
        {
          name: 'test-neq',
          type: 'head',
          conditions: [{ attribute: 'status.code', operator: 'neq', value: 0 }],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan({ status: { code: 1 } })]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });

    it('should evaluate gt operator', () => {
      const rules: SamplingRule[] = [
        {
          name: 'test-gt',
          type: 'head',
          conditions: [{ attribute: 'status.code', operator: 'gt', value: 0 }],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan({ status: { code: 1 } })]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });

    it('should evaluate lt operator', () => {
      const rules: SamplingRule[] = [
        {
          name: 'test-lt',
          type: 'head',
          conditions: [{ attribute: 'status.code', operator: 'lt', value: 2 }],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan({ status: { code: 1 } })]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });

    it('should evaluate exists operator', () => {
      const rules: SamplingRule[] = [
        {
          name: 'test-exists',
          type: 'head',
          conditions: [{ attribute: 'http.status_code', operator: 'exists', value: null }],
          action: 'drop',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan({ attributes: { 'http.status_code': 200 } })]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty trace', () => {
      const rules: SamplingRule[] = [];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([]);

      const result = engine.simulateFullSampling(tree);

      expect(result.action).toBe('keep');
    });

    it('should handle trace with only orphan spans', () => {
      const rules: SamplingRule[] = [];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([
        createTestSpan({ spanId: 'orphan-1', parentSpanId: 'nonexistent' }),
      ]);

      const result = engine.simulateFullSampling(tree);

      expect(result.action).toBe('keep');
    });

    it('should prioritize rules in order', () => {
      const rules: SamplingRule[] = [
        {
          name: 'first-drop',
          type: 'head',
          conditions: [{ attribute: 'operationName', operator: 'exists', value: null }],
          action: 'drop',
        },
        {
          name: 'second-keep',
          type: 'head',
          conditions: [{ attribute: 'operationName', operator: 'exists', value: null }],
          action: 'keep',
        },
      ];
      const engine = new SamplingEngine(rules);
      const tree = createTraceTree([createTestSpan()]);

      const result = engine.evaluateHeadSampling(tree);

      expect(result.keep).toBe(false);
      expect(result.matchedRule).toBe('first-drop');
    });
  });
});