import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parsePlan, parseProducers, parseConsumers, validateConfig } from './parser';
import { generateSeedData, generateBadConfigExamples } from '../seed/generator';

describe('Config Parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mq-stress-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('parsePlan', () => {
    it('should parse valid plan config', async () => {
      const seedData = generateSeedData(12345);
      const planPath = path.join(tempDir, 'queue-plan.yaml');
      fs.writeFileSync(planPath, seedData.planYaml);

      const config = await parsePlan(planPath);

      expect(config.global).toBeDefined();
      expect(config.global.simulation).toBeDefined();
      expect(config.global.simulation.duration).toBeGreaterThan(0);
      expect(config.topics).toBeDefined();
      expect(config.topics.length).toBeGreaterThan(0);
    });

    it('should throw error for missing file', async () => {
      const invalidPath = path.join(tempDir, 'nonexistent.yaml');
      await expect(parsePlan(invalidPath)).rejects.toThrow();
    });
  });

  describe('parseProducers', () => {
    it('should parse valid producers config', async () => {
      const seedData = generateSeedData(12345);
      const producersPath = path.join(tempDir, 'producers.jsonl');
      fs.writeFileSync(producersPath, seedData.producersJsonl);

      const producers = await parseProducers(producersPath);

      expect(producers).toBeDefined();
      expect(producers.length).toBeGreaterThan(0);
      
      for (const producer of producers) {
        expect(producer.topic).toBeDefined();
        expect(producer.rate).toBeGreaterThanOrEqual(0);
        expect(producer.burstRate).toBeGreaterThanOrEqual(producer.rate);
      }
    });

    it('should throw error for invalid JSON', async () => {
      const badExamples = generateBadConfigExamples();
      const producersPath = path.join(tempDir, 'producers.jsonl');
      fs.writeFileSync(producersPath, badExamples['bad-producers-invalid-json.jsonl']);

      await expect(parseProducers(producersPath)).rejects.toThrow();
    });
  });

  describe('parseConsumers', () => {
    it('should parse valid consumers config', async () => {
      const seedData = generateSeedData(12345);
      const consumersPath = path.join(tempDir, 'consumers.yaml');
      fs.writeFileSync(consumersPath, seedData.consumersYaml);

      const consumers = await parseConsumers(consumersPath);

      expect(consumers).toBeDefined();
      expect(consumers.length).toBeGreaterThan(0);
      
      for (const cg of consumers) {
        expect(cg.name).toBeDefined();
        expect(cg.topics).toBeDefined();
        expect(cg.consumers).toBeGreaterThan(0);
        expect(cg.consumeRate).toBeGreaterThan(0);
      }
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', async () => {
      const seedData = generateSeedData(12345);
      
      const planPath = path.join(tempDir, 'queue-plan.yaml');
      const producersPath = path.join(tempDir, 'producers.jsonl');
      const consumersPath = path.join(tempDir, 'consumers.yaml');
      
      fs.writeFileSync(planPath, seedData.planYaml);
      fs.writeFileSync(producersPath, seedData.producersJsonl);
      fs.writeFileSync(consumersPath, seedData.consumersYaml);

      const plan = await parsePlan(planPath);
      const producers = await parseProducers(producersPath);
      const consumers = await parseConsumers(consumersPath);

      const errors = validateConfig(plan, producers, consumers);

      expect(errors.length).toBe(0);
    });

    it('should detect topic mismatch', async () => {
      const badPlan = `global:
  simulation:
    duration: 60
    stepInterval: 1

topics:
  - name: valid-topic
    partitions: 2
    retention: 86400
`;

      const badProducers = `{"topic": "nonexistent-topic", "rate": 10, "burstRate": 20, "startTime": 0, "duration": 30, "sequentialKeyField": "key", "idempotentKeyField": "id"}
`;

      const badConsumers = `consumerGroups:
  - name: test-consumer
    topics: ["valid-topic"]
    consumers: 1
    consumeRate: 10
    maxConsumeRate: 20
    
    retry:
      maxAttempts: 3
      delay: 1000
      backoffMultiplier: 2
    
    deadLetter:
      topic: dlq
      maxRetry: 3
    
    ack:
      mode: manual
      timeout: 30000
    
    scaling:
      enableAutoScaling: false
      targetLag: 100
      maxConsumers: 1
      scaleUpDelay: 30
      scaleDownDelay: 60
    
    throttling:
      enableThrottling: false
      minRate: 10
    
    failure:
      crashProbability: 0.01
      recoveryTime: 30
`;

      const planPath = path.join(tempDir, 'queue-plan.yaml');
      const producersPath = path.join(tempDir, 'producers.jsonl');
      const consumersPath = path.join(tempDir, 'consumers.yaml');
      
      fs.writeFileSync(planPath, badPlan);
      fs.writeFileSync(producersPath, badProducers);
      fs.writeFileSync(consumersPath, badConsumers);

      const plan = await parsePlan(planPath);
      const producers = await parseProducers(producersPath);
      const consumers = await parseConsumers(consumersPath);

      const errors = validateConfig(plan, producers, consumers);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('nonexistent-topic');
    });

    it('should detect consumer count greater than partitions', async () => {
      const badPlan = `global:
  simulation:
    duration: 60
    stepInterval: 1

topics:
  - name: test-topic
    partitions: 2
    retention: 86400
`;

      const producers = `{"topic": "test-topic", "rate": 10, "burstRate": 20, "startTime": 0, "duration": 30, "sequentialKeyField": "key", "idempotentKeyField": "id"}
`;

      const badConsumers = `consumerGroups:
  - name: test-consumer
    topics: ["test-topic"]
    consumers: 5
    consumeRate: 10
    maxConsumeRate: 20
    
    retry:
      maxAttempts: 3
      delay: 1000
      backoffMultiplier: 2
    
    deadLetter:
      topic: dlq
      maxRetry: 3
    
    ack:
      mode: manual
      timeout: 30000
    
    scaling:
      enableAutoScaling: false
      targetLag: 100
      maxConsumers: 5
      scaleUpDelay: 30
      scaleDownDelay: 60
    
    throttling:
      enableThrottling: false
      minRate: 10
    
    failure:
      crashProbability: 0.01
      recoveryTime: 30
`;

      const planPath = path.join(tempDir, 'queue-plan.yaml');
      const producersPath = path.join(tempDir, 'producers.jsonl');
      const consumersPath = path.join(tempDir, 'consumers.yaml');
      
      fs.writeFileSync(planPath, badPlan);
      fs.writeFileSync(producersPath, producers);
      fs.writeFileSync(consumersPath, badConsumers);

      const plan = await parsePlan(planPath);
      const producerConfigs = await parseProducers(producersPath);
      const consumerConfigs = await parseConsumers(consumersPath);

      const errors = validateConfig(plan, producerConfigs, consumerConfigs);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('消费者数量');
    });
  });
});
