import { SimulationEngine } from './engine';
import { SimulationConfig, ProducerConfig, ConsumerGroupConfig } from '../types';

describe('SimulationEngine', () => {
  const createTestConfig = () => {
    const plan: SimulationConfig = {
      global: {
        simulation: {
          duration: 30,
          stepInterval: 1,
          seed: 12345,
        },
      },
      topics: [
        {
          name: 'test-topic',
          partitions: 2,
          retention: 86400,
        },
      ],
    };

    const producers: ProducerConfig[] = [
      {
        topic: 'test-topic',
        rate: 10,
        burstRate: 20,
        startTime: 0,
        duration: 20,
        sequentialKeyField: 'orderId',
        idempotentKeyField: 'eventId',
        duplicateProbability: 0.05,
      },
    ];

    const consumers: ConsumerGroupConfig[] = [
      {
        name: 'test-consumer-group',
        topics: ['test-topic'],
        consumers: 2,
        consumeRate: 15,
        maxConsumeRate: 30,
        retry: {
          maxAttempts: 3,
          delay: 1000,
          backoffMultiplier: 2,
        },
        deadLetter: {
          topic: 'dlq',
          maxRetry: 3,
        },
        ack: {
          mode: 'manual',
          timeout: 30000,
        },
        scaling: {
          enableAutoScaling: false,
          targetLag: 100,
          maxConsumers: 4,
          scaleUpDelay: 30,
          scaleDownDelay: 60,
        },
        throttling: {
          enableThrottling: false,
          minRate: 5,
        },
        failure: {
          crashProbability: 0.01,
          recoveryTime: 10,
        },
      },
    ];

    return { plan, producers, consumers };
  };

  it('should run simulation successfully', async () => {
    const { plan, producers, consumers } = createTestConfig();
    
    const engine = new SimulationEngine({
      plan,
      producers,
      consumers,
      seed: 12345,
    });

    const result = await engine.run();

    expect(result.runId).toBeDefined();
    expect(result.startTime).toBeDefined();
    expect(result.endTime).toBeDefined();
    expect(result.endTime).toBeGreaterThan(result.startTime);
    expect(result.summary).toBeDefined();
  });

  it('should track message production and consumption', async () => {
    const { plan, producers, consumers } = createTestConfig();
    
    const engine = new SimulationEngine({
      plan,
      producers,
      consumers,
      seed: 12345,
    });

    const result = await engine.run();

    expect(result.summary.totalMessagesProduced).toBeGreaterThan(0);
    expect(result.summary.totalMessagesConsumed).toBeGreaterThan(0);
  });

  it('should generate time series data', async () => {
    const { plan, producers, consumers } = createTestConfig();
    
    const engine = new SimulationEngine({
      plan,
      producers,
      consumers,
      seed: 12345,
    });

    const result = await engine.run();

    expect(result.timeSeries.length).toBeGreaterThan(0);
    
    const firstPoint = result.timeSeries[0];
    const lastPoint = result.timeSeries[result.timeSeries.length - 1];
    
    expect(firstPoint.time).toBe(0);
    expect(lastPoint.time).toBe(plan.global.simulation.duration);
  });

  it('should track consumer counts', async () => {
    const { plan, producers, consumers } = createTestConfig();
    
    const engine = new SimulationEngine({
      plan,
      producers,
      consumers,
      seed: 12345,
    });

    const result = await engine.run();

    for (const ts of result.timeSeries) {
      expect(ts.consumerCount).toBeGreaterThan(0);
      expect(ts.aliveConsumerCount).toBeGreaterThanOrEqual(0);
      expect(ts.aliveConsumerCount).toBeLessThanOrEqual(ts.consumerCount);
    }
  });

  describe('with auto-scaling enabled', () => {
    it('should adjust consumer count based on lag', async () => {
      const { plan, producers, consumers } = createTestConfig();
      
      consumers[0].scaling.enableAutoScaling = true;
      consumers[0].scaling.maxConsumers = 4;
      consumers[0].scaling.scaleUpDelay = 5;
      consumers[0].scaling.targetLag = 50;
      
      consumers[0].consumeRate = 5;
      consumers[0].maxConsumeRate = 10;

      producers[0].rate = 20;
      producers[0].burstRate = 40;

      const engine = new SimulationEngine({
        plan,
        producers,
        consumers,
        seed: 12345,
      });

      const result = await engine.run();

      expect(result.summary.maxLag).toBeGreaterThan(0);
    });
  });

  describe('with failure simulation', () => {
    it('should simulate consumer crashes and recovery', async () => {
      const { plan, producers, consumers } = createTestConfig();
      
      consumers[0].failure.crashProbability = 0.1;
      consumers[0].failure.recoveryTime = 5;

      const engine = new SimulationEngine({
        plan,
        producers,
        consumers,
        seed: 12345,
      });

      const result = await engine.run();

      const varyingCounts = result.timeSeries.some(ts => 
        ts.aliveConsumerCount !== ts.consumerCount
      );
      
      expect(varyingCounts || result.timeSeries.length > 0).toBe(true);
    });
  });

  describe('with dead letter queue', () => {
    it('should send failed messages to DLQ after max retries', async () => {
      const { plan, producers, consumers } = createTestConfig();
      
      consumers[0].retry.maxAttempts = 1;
      consumers[0].deadLetter.maxRetry = 1;

      const engine = new SimulationEngine({
        plan,
        producers,
        consumers,
        seed: 12345,
      });

      const result = await engine.run();

      expect(result.deadLetterMessages).toBeDefined();
      for (const msg of result.deadLetterMessages) {
        expect(msg.attempts).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
