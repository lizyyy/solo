export interface SeedData {
  planYaml: string;
  producersJsonl: string;
  consumersYaml: string;
  scenario: string;
}

class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280.0;
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function generateSeedData(seed: number): SeedData {
  const rng = new SeededRandom(seed);
  
  const scenarioType = rng.nextInt(0, 2);
  let scenario: string;
  let planYaml: string;
  let producersJsonl: string;
  let consumersYaml: string;
  
  switch (scenarioType) {
    case 0:
      scenario = '削峰填谷场景 - 高突发流量 + 稳定消费';
      [planYaml, producersJsonl, consumersYaml] = generateBurstScenario(rng);
      break;
    case 1:
      scenario = '顺序消费场景 - 同 Key 严格顺序 + 消费者故障';
      [planYaml, producersJsonl, consumersYaml] = generateOrderingScenario(rng);
      break;
    case 2:
    default:
      scenario = '综合场景 - 重复消息 + 死信队列 + 自动扩容';
      [planYaml, producersJsonl, consumersYaml] = generateComplexScenario(rng);
      break;
  }
  
  return {
    planYaml,
    producersJsonl,
    consumersYaml,
    scenario,
  };
}

function generateBurstScenario(rng: SeededRandom): [string, string, string] {
  const planYaml = `global:
  simulation:
    duration: 600
    stepInterval: 1
    seed: ${rng.nextInt(10000, 99999)}

topics:
  - name: order-events
    partitions: 4
    retention: 86400

  - name: payment-events
    partitions: 2
    retention: 86400
`;

  const producers: object[] = [
    {
      topic: 'order-events',
      rate: 50,
      burstRate: 300,
      startTime: 0,
      duration: 120,
      sequentialKeyField: 'orderId',
      idempotentKeyField: 'eventId',
      duplicateProbability: 0.02,
    },
    {
      topic: 'payment-events',
      rate: 30,
      burstRate: 150,
      startTime: 30,
      duration: 90,
      sequentialKeyField: 'paymentId',
      idempotentKeyField: 'txnId',
      duplicateProbability: 0.01,
    },
  ];
  
  const producersJsonl = producers.map(p => JSON.stringify(p)).join('\n');

  const consumersYaml = `consumerGroups:
  - name: order-service
    topics: ["order-events"]
    consumers: 2
    consumeRate: 80
    maxConsumeRate: 120
    
    retry:
      maxAttempts: 3
      delay: 1000
      backoffMultiplier: 2
    
    deadLetter:
      topic: order-dlq
      maxRetry: 3
    
    ack:
      mode: manual
      timeout: 30000
    
    scaling:
      enableAutoScaling: true
      targetLag: 100
      maxConsumers: 6
      scaleUpDelay: 30
      scaleDownDelay: 60
    
    throttling:
      enableThrottling: true
      minRate: 10
    
    failure:
      crashProbability: 0.001
      recoveryTime: 20

  - name: payment-service
    topics: ["payment-events"]
    consumers: 1
    consumeRate: 50
    maxConsumeRate: 80
    
    retry:
      maxAttempts: 5
      delay: 500
      backoffMultiplier: 1.5
    
    deadLetter:
      topic: payment-dlq
      maxRetry: 5
    
    ack:
      mode: auto
      timeout: 15000
    
    scaling:
      enableAutoScaling: false
      targetLag: 50
      maxConsumers: 2
      scaleUpDelay: 60
      scaleDownDelay: 120
    
    throttling:
      enableThrottling: false
      minRate: 5
    
    failure:
      crashProbability: 0.005
      recoveryTime: 30
`;

  return [planYaml, producersJsonl, consumersYaml];
}

function generateOrderingScenario(rng: SeededRandom): [string, string, string] {
  const planYaml = `global:
  simulation:
    duration: 300
    stepInterval: 1
    seed: ${rng.nextInt(10000, 99999)}

topics:
  - name: user-events
    partitions: 3
    retention: 86400
`;

  const producers: object[] = [
    {
      topic: 'user-events',
      rate: 100,
      burstRate: 100,
      startTime: 0,
      duration: 300,
      sequentialKeyField: 'userId',
      idempotentKeyField: 'eventId',
      duplicateProbability: 0.005,
    },
  ];
  
  const producersJsonl = producers.map(p => JSON.stringify(p)).join('\n');

  const consumersYaml = `consumerGroups:
  - name: user-service
    topics: ["user-events"]
    consumers: 3
    consumeRate: 60
    maxConsumeRate: 100
    
    retry:
      maxAttempts: 3
      delay: 2000
      backoffMultiplier: 2
    
    deadLetter:
      topic: user-dlq
      maxRetry: 3
    
    ack:
      mode: manual
      timeout: 60000
    
    scaling:
      enableAutoScaling: false
      targetLag: 200
      maxConsumers: 3
      scaleUpDelay: 30
      scaleDownDelay: 60
    
    throttling:
      enableThrottling: false
      minRate: 10
    
    failure:
      crashProbability: 0.01
      recoveryTime: 15
`;

  return [planYaml, producersJsonl, consumersYaml];
}

function generateComplexScenario(rng: SeededRandom): [string, string, string] {
  const planYaml = `global:
  simulation:
    duration: 900
    stepInterval: 1
    seed: ${rng.nextInt(10000, 99999)}

topics:
  - name: order-events
    partitions: 6
    retention: 86400

  - name: inventory-events
    partitions: 4
    retention: 86400

  - name: notification-events
    partitions: 2
    retention: 86400
`;

  const producers: object[] = [
    {
      topic: 'order-events',
      rate: 80,
      burstRate: 400,
      startTime: 0,
      duration: 600,
      sequentialKeyField: 'orderId',
      idempotentKeyField: 'eventId',
      duplicateProbability: 0.03,
    },
    {
      topic: 'inventory-events',
      rate: 60,
      burstRate: 250,
      startTime: 60,
      duration: 540,
      sequentialKeyField: 'skuId',
      idempotentKeyField: 'txnId',
      duplicateProbability: 0.02,
    },
    {
      topic: 'notification-events',
      rate: 40,
      burstRate: 120,
      startTime: 120,
      duration: 480,
      sequentialKeyField: 'userId',
      idempotentKeyField: 'notificationId',
      duplicateProbability: 0.01,
    },
  ];
  
  const producersJsonl = producers.map(p => JSON.stringify(p)).join('\n');

  const consumersYaml = `consumerGroups:
  - name: order-processor
    topics: ["order-events"]
    consumers: 3
    consumeRate: 100
    maxConsumeRate: 150
    
    retry:
      maxAttempts: 3
      delay: 1000
      backoffMultiplier: 2
    
    deadLetter:
      topic: order-dlq
      maxRetry: 3
    
    ack:
      mode: manual
      timeout: 30000
    
    scaling:
      enableAutoScaling: true
      targetLag: 150
      maxConsumers: 6
      scaleUpDelay: 20
      scaleDownDelay: 45
    
    throttling:
      enableThrottling: true
      minRate: 20
    
    failure:
      crashProbability: 0.005
      recoveryTime: 25

  - name: inventory-service
    topics: ["inventory-events"]
    consumers: 2
    consumeRate: 70
    maxConsumeRate: 100
    
    retry:
      maxAttempts: 5
      delay: 500
      backoffMultiplier: 1.5
    
    deadLetter:
      topic: inventory-dlq
      maxRetry: 5
    
    ack:
      mode: manual
      timeout: 45000
    
    scaling:
      enableAutoScaling: true
      targetLag: 80
      maxConsumers: 4
      scaleUpDelay: 30
      scaleDownDelay: 60
    
    throttling:
      enableThrottling: false
      minRate: 15
    
    failure:
      crashProbability: 0.008
      recoveryTime: 20

  - name: notification-service
    topics: ["notification-events"]
    consumers: 1
    consumeRate: 30
    maxConsumeRate: 60
    
    retry:
      maxAttempts: 10
      delay: 300
      backoffMultiplier: 1.2
    
    deadLetter:
      topic: notification-dlq
      maxRetry: 10
    
    ack:
      mode: auto
      timeout: 10000
    
    scaling:
      enableAutoScaling: false
      targetLag: 100
      maxConsumers: 2
      scaleUpDelay: 60
      scaleDownDelay: 120
    
    throttling:
      enableThrottling: true
      minRate: 5
    
    failure:
      crashProbability: 0.002
      recoveryTime: 10
`;

  return [planYaml, producersJsonl, consumersYaml];
}

export function generateBadConfigExamples(): Record<string, string> {
  return {
    'bad-plan-invalid-partitions.yaml': `global:
  simulation:
    duration: -100
    stepInterval: 0

topics:
  - name: test
    partitions: 0
    retention: -1
`,
    'bad-producers-invalid-json.jsonl': `{topic: "test", rate: -5}
{"topic": "nonexistent", "rate": 10}
`,
    'bad-consumers-mismatch.yaml': `consumerGroups:
  - name: bad-service
    topics: ["nonexistent-topic"]
    consumers: 10
    consumeRate: 50
    maxConsumeRate: 40
    
    retry:
      maxAttempts: -1
`,
  };
}
