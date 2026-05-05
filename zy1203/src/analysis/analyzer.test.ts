import { Analyzer } from './analyzer';
import { Recommender } from './recommender';
import { SimulationResult } from '../types';

describe('Analyzer', () => {
  const createTestResult = (): SimulationResult => ({
    runId: 'test-run-123',
    startTime: Date.now() - 60000,
    endTime: Date.now(),
    config: {
      plan: {
        global: {
          simulation: {
            duration: 60,
            stepInterval: 1,
          },
        },
        topics: [
          { name: 'test-topic', partitions: 2, retention: 86400 },
        ],
      },
      producers: [
        {
          topic: 'test-topic',
          rate: 10,
          burstRate: 20,
          startTime: 0,
          duration: 60,
          sequentialKeyField: 'key',
          idempotentKeyField: 'id',
          duplicateProbability: 0.05,
        },
      ],
      consumers: [
        {
          name: 'test-group',
          topics: ['test-topic'],
          consumers: 2,
          consumeRate: 15,
          maxConsumeRate: 30,
          retry: { maxAttempts: 3, delay: 1000, backoffMultiplier: 2 },
          deadLetter: { topic: 'dlq', maxRetry: 3 },
          ack: { mode: 'manual', timeout: 30000 },
          scaling: {
            enableAutoScaling: false,
            targetLag: 100,
            maxConsumers: 4,
            scaleUpDelay: 30,
            scaleDownDelay: 60,
          },
          throttling: { enableThrottling: false, minRate: 5 },
          failure: { crashProbability: 0.01, recoveryTime: 30 },
        },
      ],
    },
    summary: {
      totalMessagesProduced: 1000,
      totalMessagesConsumed: 950,
      totalDeadLetterMessages: 10,
      totalDuplicateMessages: 25,
      totalOutOfOrderMessages: 5,
      maxLag: 200,
      avgLag: 100,
      maxLatency: 15,
      avgLatency: 5,
    },
    timeSeries: Array.from({ length: 61 }, (_, i) => ({
      time: i,
      totalLag: Math.max(0, Math.sin(i * 0.1) * 100 + 100),
      topicLags: { 'test-topic': Math.max(0, Math.sin(i * 0.1) * 100 + 100) },
      consumerCount: 2,
      aliveConsumerCount: 2,
      producedCount: Math.floor(i * 16.67),
      consumedCount: Math.floor(i * 15.83),
      deadLetterCount: Math.floor(i / 6),
    })),
    outOfOrderEvents: [
      {
        messageId: 'msg-1',
        key: 'key-1',
        expectedOffset: 5,
        actualOffset: 7,
        time: 30,
        topic: 'test-topic',
        partition: 0,
      },
    ],
    duplicateEvents: [
      {
        messageId: 'dup-1',
        idempotentKey: 'id-1',
        originalMessageId: 'orig-1',
        time: 20,
        topic: 'test-topic',
      },
    ],
    consumptionLatencies: Array.from({ length: 950 }, (_, i) => ({
      messageId: `msg-${i}`,
      produceTime: Math.floor(i / 15),
      consumeTime: Math.floor(i / 15) + 5,
      latency: 5,
      topic: 'test-topic',
    })),
    deadLetterMessages: [
      {
        id: 'dlq-1',
        topic: 'test-topic',
        partition: 0,
        offset: 100,
        key: 'key-1',
        idempotentKey: 'id-1',
        payload: {},
        timestamp: Date.now() - 30000,
        produceTime: Date.now() - 60000,
        attempts: 3,
        isDuplicate: false,
      },
    ],
  });

  describe('analyze()', () => {
    it('should analyze backlog correctly', () => {
      const result = createTestResult();
      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();

      expect(analysis.backlogAnalysis).toBeDefined();
      expect(analysis.backlogAnalysis.peakBacklog).toBeGreaterThan(0);
      expect(analysis.backlogAnalysis.backlogDuration).toBeGreaterThan(0);
    });

    it('should analyze ordering correctly', () => {
      const result = createTestResult();
      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();

      expect(analysis.orderAnalysis).toBeDefined();
      expect(analysis.orderAnalysis.outOfOrderCount).toBeGreaterThan(0);
      expect(analysis.orderAnalysis.affectedKeys.length).toBeGreaterThan(0);
    });

    it('should analyze duplication correctly', () => {
      const result = createTestResult();
      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();

      expect(analysis.duplicationAnalysis).toBeDefined();
      expect(analysis.duplicationAnalysis.duplicateCount).toBeGreaterThan(0);
    });

    it('should analyze latency correctly', () => {
      const result = createTestResult();
      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();

      expect(analysis.latencyAnalysis).toBeDefined();
      expect(analysis.latencyAnalysis.avgLatency).toBeGreaterThan(0);
      expect(analysis.latencyAnalysis.p50).toBeDefined();
      expect(analysis.latencyAnalysis.p95).toBeDefined();
      expect(analysis.latencyAnalysis.p99).toBeDefined();
    });

    it('should analyze failures correctly', () => {
      const result = createTestResult();
      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();

      expect(analysis.failureAnalysis).toBeDefined();
    });
  });
});

describe('Recommender', () => {
  const createTestResult = (): SimulationResult => ({
    runId: 'test-run-123',
    startTime: Date.now() - 60000,
    endTime: Date.now(),
    config: {
      plan: {
        global: {
          simulation: {
            duration: 60,
            stepInterval: 1,
          },
        },
        topics: [
          { name: 'test-topic', partitions: 2, retention: 86400 },
        ],
      },
      producers: [
        {
          topic: 'test-topic',
          rate: 10,
          burstRate: 20,
          startTime: 0,
          duration: 60,
          sequentialKeyField: 'key',
          idempotentKeyField: 'id',
          duplicateProbability: 0.05,
        },
      ],
      consumers: [
        {
          name: 'test-group',
          topics: ['test-topic'],
          consumers: 2,
          consumeRate: 15,
          maxConsumeRate: 30,
          retry: { maxAttempts: 3, delay: 1000, backoffMultiplier: 2 },
          deadLetter: { topic: 'dlq', maxRetry: 3 },
          ack: { mode: 'manual', timeout: 30000 },
          scaling: {
            enableAutoScaling: false,
            targetLag: 100,
            maxConsumers: 4,
            scaleUpDelay: 30,
            scaleDownDelay: 60,
          },
          throttling: { enableThrottling: false, minRate: 5 },
          failure: { crashProbability: 0.01, recoveryTime: 30 },
        },
      ],
    },
    summary: {
      totalMessagesProduced: 1000,
      totalMessagesConsumed: 950,
      totalDeadLetterMessages: 10,
      totalDuplicateMessages: 25,
      totalOutOfOrderMessages: 5,
      maxLag: 200,
      avgLag: 100,
      maxLatency: 15,
      avgLatency: 5,
    },
    timeSeries: Array.from({ length: 61 }, (_, i) => ({
      time: i,
      totalLag: Math.max(0, Math.sin(i * 0.1) * 100 + 100),
      topicLags: { 'test-topic': Math.max(0, Math.sin(i * 0.1) * 100 + 100) },
      consumerCount: 2,
      aliveConsumerCount: 2,
      producedCount: Math.floor(i * 16.67),
      consumedCount: Math.floor(i * 15.83),
      deadLetterCount: Math.floor(i / 6),
    })),
    outOfOrderEvents: [
      {
        messageId: 'msg-1',
        key: 'key-1',
        expectedOffset: 5,
        actualOffset: 7,
        time: 30,
        topic: 'test-topic',
        partition: 0,
      },
    ],
    duplicateEvents: [
      {
        messageId: 'dup-1',
        idempotentKey: 'id-1',
        originalMessageId: 'orig-1',
        time: 20,
        topic: 'test-topic',
      },
    ],
    consumptionLatencies: Array.from({ length: 950 }, (_, i) => ({
      messageId: `msg-${i}`,
      produceTime: Math.floor(i / 15),
      consumeTime: Math.floor(i / 15) + 5,
      latency: 5,
      topic: 'test-topic',
    })),
    deadLetterMessages: [
      {
        id: 'dlq-1',
        topic: 'test-topic',
        partition: 0,
        offset: 100,
        key: 'key-1',
        idempotentKey: 'id-1',
        payload: {},
        timestamp: Date.now() - 30000,
        produceTime: Date.now() - 60000,
        attempts: 3,
        isDuplicate: false,
      },
    ],
  });

  describe('generate()', () => {
    it('should generate recommendations for high backlog', () => {
      const result = createTestResult();
      result.summary.maxLag = 6000;
      result.timeSeries = Array.from({ length: 61 }, (_, i) => ({
        time: i,
        totalLag: 5000 + i * 10,
        topicLags: { 'test-topic': 5000 + i * 10 },
        consumerCount: 2,
        aliveConsumerCount: 2,
        producedCount: Math.floor(i * 16.67),
        consumedCount: Math.floor(i * 10),
        deadLetterCount: Math.floor(i / 6),
      }));

      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();
      const recommender = new Recommender(result, analysis);
      const recommendations = recommender.generate();

      const scalingRecs = recommendations.filter(r => r.type === 'scaling');
      expect(scalingRecs.length).toBeGreaterThan(0);
    });

    it('should generate idempotency recommendations for duplicates', () => {
      const result = createTestResult();
      result.duplicateEvents = Array.from({ length: 100 }, (_, i) => ({
        messageId: `dup-${i}`,
        idempotentKey: `id-${i % 10}`,
        originalMessageId: `orig-${i}`,
        time: 20,
        topic: 'test-topic',
      }));

      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();
      const recommender = new Recommender(result, analysis);
      const recommendations = recommender.generate();

      const idempotencyRecs = recommendations.filter(r => r.type === 'idempotency');
      expect(idempotencyRecs.length).toBeGreaterThan(0);
    });

    it('should generate ordering recommendations for out of order', () => {
      const result = createTestResult();
      result.outOfOrderEvents = Array.from({ length: 50 }, (_, i) => ({
        messageId: `msg-${i}`,
        key: `key-${i % 10}`,
        expectedOffset: i * 2,
        actualOffset: i * 2 + 2,
        time: 30,
        topic: 'test-topic',
        partition: 0,
      }));

      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();
      const recommender = new Recommender(result, analysis);
      const recommendations = recommender.generate();

      const orderingRecs = recommendations.filter(r => r.type === 'ordering');
      expect(orderingRecs.length).toBeGreaterThan(0);
    });

    it('should generate dead letter recommendations', () => {
      const result = createTestResult();
      result.summary.totalDeadLetterMessages = 100;

      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();
      const recommender = new Recommender(result, analysis);
      const recommendations = recommender.generate();

      const dlqRecs = recommendations.filter(r => r.type === 'deadLetter');
      expect(dlqRecs.length).toBeGreaterThan(0);
    });

    it('should sort recommendations by severity', () => {
      const result = createTestResult();
      result.summary.maxLag = 10000;
      result.summary.totalDeadLetterMessages = 500;

      const analyzer = new Analyzer(result);
      const analysis = analyzer.analyze();
      const recommender = new Recommender(result, analysis);
      const recommendations = recommender.generate();

      expect(recommendations.length).toBeGreaterThan(0);

      const severityOrder: Record<string, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };

      for (let i = 1; i < recommendations.length; i++) {
        const prevSeverity = severityOrder[recommendations[i - 1].severity] || 0;
        const currSeverity = severityOrder[recommendations[i].severity] || 0;
        expect(prevSeverity).toBeGreaterThanOrEqual(currSeverity);
      }
    });
  });
});
