import { v4 as uuidv4 } from 'uuid';
import {
  SimulationConfig,
  ProducerConfig,
  ConsumerGroupConfig,
  SimulationResult,
  TimeSeriesData,
  OutOfOrderEvent,
  DuplicateEvent,
  ConsumptionLatency,
  Message,
} from '../types';
import { MessageFactory, hashKeyToPartition } from './message';
import { TopicManager } from './topic';
import { ProducerManager } from './producer';
import { ConsumerManager, ConsumeResult } from './consumer';

export interface EngineOptions {
  plan: SimulationConfig;
  producers: ProducerConfig[];
  consumers: ConsumerGroupConfig[];
  seed: number;
}

export class SimulationEngine {
  private options: EngineOptions;
  private runId: string;
  private startTime: number;
  private messageFactory: MessageFactory;
  private topicManager: TopicManager;
  private producerManager: ProducerManager;
  private consumerManager: ConsumerManager;
  
  private timeSeries: TimeSeriesData[];
  private outOfOrderEvents: OutOfOrderEvent[];
  private duplicateEvents: DuplicateEvent[];
  private consumptionLatencies: ConsumptionLatency[];
  
  private totalProduced: number;
  private totalConsumed: number;
  private totalDeadLetter: number;
  private totalDuplicates: number;
  
  private keyOrderTracker: Map<string, number>;
  private processedIdempotentKeys: Set<string>;

  constructor(options: EngineOptions) {
    this.options = options;
    this.runId = uuidv4();
    this.startTime = Date.now();
    
    const seed = options.seed;
    this.messageFactory = new MessageFactory(seed);
    this.topicManager = new TopicManager();
    this.producerManager = new ProducerManager(seed + 1, this.messageFactory, this.topicManager);
    this.consumerManager = new ConsumerManager(seed + 2, this.topicManager);
    
    this.timeSeries = [];
    this.outOfOrderEvents = [];
    this.duplicateEvents = [];
    this.consumptionLatencies = [];
    
    this.totalProduced = 0;
    this.totalConsumed = 0;
    this.totalDeadLetter = 0;
    this.totalDuplicates = 0;
    
    this.keyOrderTracker = new Map();
    this.processedIdempotentKeys = new Set();
    
    this.initializeTopics();
    this.initializeProducers();
    this.initializeConsumers();
  }

  private initializeTopics(): void {
    for (const topicConfig of this.options.plan.topics) {
      this.topicManager.createTopic(
        topicConfig.name,
        topicConfig.partitions,
        topicConfig.retention
      );
    }
  }

  private initializeProducers(): void {
    for (const producerConfig of this.options.producers) {
      this.producerManager.addProducer(producerConfig);
    }
  }

  private initializeConsumers(): void {
    for (const consumerConfig of this.options.consumers) {
      this.consumerManager.addConsumerGroup(consumerConfig);
    }
  }

  async run(): Promise<SimulationResult> {
    const duration = this.options.plan.global.simulation.duration;
    const stepInterval = this.options.plan.global.simulation.stepInterval;
    
    console.log(`开始模拟，运行ID: ${this.runId}`);
    console.log(`模拟时长: ${duration} 秒，步长: ${stepInterval} 秒`);
    
    for (let currentTime = 0; currentTime <= duration; currentTime += stepInterval) {
      if (currentTime % 60 === 0 && currentTime > 0) {
        console.log(`  模拟进度: ${currentTime}/${duration} 秒`);
      }
      
      const produceResult = this.producerManager.produce(currentTime);
      this.totalProduced += produceResult.messages.length;
      this.totalDuplicates += produceResult.duplicates.length;
      
      for (const msg of produceResult.duplicates) {
        if (msg.originalMessageId) {
          this.duplicateEvents.push({
            messageId: msg.id,
            idempotentKey: msg.idempotentKey,
            originalMessageId: msg.originalMessageId,
            time: currentTime,
            topic: msg.topic,
          });
        }
      }
      
      const consumeResult = this.consumerManager.consume(currentTime);
      this.totalConsumed += consumeResult.consumed.length;
      this.totalDeadLetter += consumeResult.deadLetter.length;
      
      this.processConsumedMessages(consumeResult.consumed, currentTime);
      
      this.checkOrdering(currentTime);
      this.checkDuplication(currentTime);
      
      const timePoint = this.createTimeSeriesData(currentTime);
      this.timeSeries.push(timePoint);
    }
    
    console.log('模拟完成，正在生成结果...');
    
    return this.buildResult();
  }

  private processConsumedMessages(messages: Message[], currentTime: number): void {
    for (const msg of messages) {
      const latency = currentTime - msg.produceTime;
      this.consumptionLatencies.push({
        messageId: msg.id,
        produceTime: msg.produceTime,
        consumeTime: currentTime,
        latency,
        topic: msg.topic,
      });
      
      if (this.processedIdempotentKeys.has(msg.idempotentKey)) {
        this.duplicateEvents.push({
          messageId: msg.id,
          idempotentKey: msg.idempotentKey,
          originalMessageId: msg.id,
          time: currentTime,
          topic: msg.topic,
        });
      } else {
        this.processedIdempotentKeys.add(msg.idempotentKey);
      }
    }
  }

  private checkOrdering(currentTime: number): void {
    for (const topic of this.topicManager.getAllTopics()) {
      for (const partition of topic.partitions) {
        const messages = partition.messages;
        
        for (let i = 1; i < messages.length; i++) {
          const current = messages[i];
          const prev = messages[i - 1];
          
          if (current.key === prev.key) {
            const trackerKey = `${topic.name}-${current.key}`;
            const expectedOffset = this.keyOrderTracker.get(trackerKey);
            
            if (expectedOffset !== undefined && current.offset !== expectedOffset + 1) {
              this.outOfOrderEvents.push({
                messageId: current.id,
                key: current.key,
                expectedOffset: expectedOffset + 1,
                actualOffset: current.offset,
                time: currentTime,
                topic: topic.name,
                partition: partition.id,
              });
            }
            
            this.keyOrderTracker.set(trackerKey, current.offset);
          }
        }
      }
    }
  }

  private checkDuplication(currentTime: number): void {
    const idempotentKeyCounts = new Map<string, number>();
    
    for (const topic of this.topicManager.getAllTopics()) {
      for (const partition of topic.partitions) {
        for (const msg of partition.messages) {
          const count = idempotentKeyCounts.get(msg.idempotentKey) ?? 0;
          idempotentKeyCounts.set(msg.idempotentKey, count + 1);
          
          if (count > 0 && !msg.isDuplicate) {
            this.duplicateEvents.push({
              messageId: msg.id,
              idempotentKey: msg.idempotentKey,
              originalMessageId: msg.id,
              time: currentTime,
              topic: topic.name,
            });
          }
        }
      }
    }
  }

  private createTimeSeriesData(currentTime: number): TimeSeriesData {
    const topicLags: Record<string, number> = {};
    let totalLag = 0;
    let consumerCount = 0;
    let aliveConsumerCount = 0;
    
    for (const topic of this.topicManager.getAllTopics()) {
      let topicLag = 0;
      
      for (const partition of topic.partitions) {
        topicLag += partition.messages.length;
      }
      
      topicLags[topic.name] = topicLag;
      totalLag += topicLag;
    }
    
    for (const group of this.consumerManager.getConsumerGroups()) {
      for (const consumer of group.consumers) {
        consumerCount++;
        if (consumer.isAlive) {
          aliveConsumerCount++;
        }
      }
    }
    
    return {
      time: currentTime,
      totalLag,
      topicLags,
      consumerCount,
      aliveConsumerCount,
      producedCount: this.totalProduced,
      consumedCount: this.totalConsumed,
      deadLetterCount: this.totalDeadLetter,
    };
  }

  private buildResult(): SimulationResult {
    const lags = this.timeSeries.map(t => t.totalLag);
    const maxLag = Math.max(...lags, 0);
    const avgLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 0;
    
    const latencies = this.consumptionLatencies.map(l => l.latency);
    const maxLatency = latencies.length > 0 ? Math.max(...latencies, 0) : 0;
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;
    
    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: Date.now(),
      config: {
        plan: this.options.plan,
        producers: this.options.producers,
        consumers: this.options.consumers,
      },
      summary: {
        totalMessagesProduced: this.totalProduced,
        totalMessagesConsumed: this.totalConsumed,
        totalDeadLetterMessages: this.totalDeadLetter,
        totalDuplicateMessages: this.duplicateEvents.length,
        totalOutOfOrderMessages: this.outOfOrderEvents.length,
        maxLag,
        avgLag,
        maxLatency,
        avgLatency,
      },
      timeSeries: this.timeSeries,
      outOfOrderEvents: this.outOfOrderEvents,
      duplicateEvents: this.duplicateEvents,
      consumptionLatencies: this.consumptionLatencies,
      deadLetterMessages: this.consumerManager.getDeadLetterMessages(),
    };
  }
}
