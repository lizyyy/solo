export interface SimulationConfig {
  global: GlobalConfig;
  topics: TopicConfig[];
}

export interface GlobalConfig {
  simulation: {
    duration: number;
    stepInterval: number;
    seed?: number;
  };
}

export interface TopicConfig {
  name: string;
  partitions: number;
  retention: number;
}

export interface ProducerConfig {
  topic: string;
  rate: number;
  burstRate: number;
  startTime: number;
  duration: number;
  sequentialKeyField: string;
  idempotentKeyField: string;
  duplicateProbability?: number;
}

export interface ConsumerGroupConfig {
  name: string;
  topics: string[];
  consumers: number;
  consumeRate: number;
  maxConsumeRate: number;
  
  retry: RetryConfig;
  deadLetter: DeadLetterConfig;
  ack: AckConfig;
  scaling: ScalingConfig;
  throttling: ThrottlingConfig;
  failure: FailureConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

export interface DeadLetterConfig {
  topic: string;
  maxRetry: number;
}

export interface AckConfig {
  mode: 'auto' | 'manual';
  timeout: number;
}

export interface ScalingConfig {
  enableAutoScaling: boolean;
  targetLag: number;
  maxConsumers: number;
  scaleUpDelay: number;
  scaleDownDelay: number;
}

export interface ThrottlingConfig {
  enableThrottling: boolean;
  minRate: number;
}

export interface FailureConfig {
  crashProbability: number;
  recoveryTime: number;
}

export interface Message {
  id: string;
  topic: string;
  partition: number;
  offset: number;
  key: string;
  idempotentKey: string;
  payload: Record<string, unknown>;
  timestamp: number;
  produceTime: number;
  attempts: number;
  isDuplicate: boolean;
  originalMessageId?: string;
}

export interface Topic {
  name: string;
  partitions: Partition[];
  retention: number;
}

export interface Partition {
  id: number;
  messages: Message[];
  latestOffset: number;
}

export interface Producer {
  id: string;
  topic: string;
  rate: number;
  burstRate: number;
  startTime: number;
  duration: number;
  sequentialKeyField: string;
  idempotentKeyField: string;
  duplicateProbability: number;
  active: boolean;
}

export interface Consumer {
  id: string;
  groupId: string;
  topic: string;
  partition: number;
  consumeRate: number;
  maxConsumeRate: number;
  currentOffset: number;
  isAlive: boolean;
  crashedAt?: number;
  lastProcessedTime: number;
  processingMessage?: Message;
}

export interface ConsumerGroup {
  name: string;
  topics: string[];
  consumers: Consumer[];
  retry: RetryConfig;
  deadLetter: DeadLetterConfig;
  ack: AckConfig;
  scaling: ScalingConfig;
  throttling: ThrottlingConfig;
  failure: FailureConfig;
  baseConsumeRate: number;
  currentConsumeRate: number;
  lastScaleActionTime: number;
}

export interface SimulationState {
  runId: string;
  timestamp: number;
  currentTime: number;
  topics: Map<string, Topic>;
  producers: Producer[];
  consumerGroups: ConsumerGroup[];
  deadLetterMessages: Message[];
}

export interface TimeSeriesData {
  time: number;
  totalLag: number;
  topicLags: Record<string, number>;
  consumerCount: number;
  aliveConsumerCount: number;
  producedCount: number;
  consumedCount: number;
  deadLetterCount: number;
}

export interface OutOfOrderEvent {
  messageId: string;
  key: string;
  expectedOffset: number;
  actualOffset: number;
  time: number;
  topic: string;
  partition: number;
}

export interface DuplicateEvent {
  messageId: string;
  idempotentKey: string;
  originalMessageId: string;
  time: number;
  topic: string;
}

export interface ConsumptionLatency {
  messageId: string;
  produceTime: number;
  consumeTime: number;
  latency: number;
  topic: string;
}

export interface SimulationResult {
  runId: string;
  startTime: number;
  endTime: number;
  config: {
    plan: SimulationConfig;
    producers: ProducerConfig[];
    consumers: ConsumerGroupConfig[];
  };
  
  summary: {
    totalMessagesProduced: number;
    totalMessagesConsumed: number;
    totalDeadLetterMessages: number;
    totalDuplicateMessages: number;
    totalOutOfOrderMessages: number;
    maxLag: number;
    avgLag: number;
    maxLatency: number;
    avgLatency: number;
  };
  
  timeSeries: TimeSeriesData[];
  outOfOrderEvents: OutOfOrderEvent[];
  duplicateEvents: DuplicateEvent[];
  consumptionLatencies: ConsumptionLatency[];
  deadLetterMessages: Message[];
}

export interface AnalysisResult {
  runId: string;
  summary: SimulationResult['summary'];
  
  backlogAnalysis: {
    peakBacklog: number;
    peakTime: number;
    backlogDuration: number;
    recoveryTime: number;
  };
  
  orderAnalysis: {
    outOfOrderCount: number;
    outOfOrderRate: number;
    affectedKeys: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  
  duplicationAnalysis: {
    duplicateCount: number;
    duplicateRate: number;
    affectedIdempotentKeys: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  
  latencyAnalysis: {
    avgLatency: number;
    maxLatency: number;
    p50: number;
    p95: number;
    p99: number;
  };
  
  failureAnalysis: {
    consumerCrashes: number;
    avgRecoveryTime: number;
    maxRecoveryTime: number;
  };
}

export interface Recommendation {
  type: 'idempotency' | 'scaling' | 'throttling' | 'ordering' | 'retry' | 'deadLetter';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
}

export interface ExportReport {
  runId: string;
  generatedAt: number;
  summary: AnalysisResult['summary'];
  analysis: Omit<AnalysisResult, 'runId' | 'summary'>;
  recommendations: Recommendation[];
  keyMetrics: {
    name: string;
    value: string;
    description: string;
  }[];
}
