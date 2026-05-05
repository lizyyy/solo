import { Consumer, ConsumerGroup, ConsumerGroupConfig, Message } from '../types';
import { TopicManager } from './topic';

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

export interface ConsumeResult {
  consumed: Message[];
  failed: Message[];
  deadLetter: Message[];
  requeued: Message[];
}

export class ConsumerManager {
  private consumerGroups: ConsumerGroup[];
  private topicManager: TopicManager;
  private rng: SeededRandom;
  private deadLetterMessages: Message[];
  
  constructor(seed: number, topicManager: TopicManager) {
    this.consumerGroups = [];
    this.topicManager = topicManager;
    this.rng = new SeededRandom(seed);
    this.deadLetterMessages = [];
  }
  
  addConsumerGroup(config: ConsumerGroupConfig): void {
    const consumers: Consumer[] = [];
    
    for (const topicName of config.topics) {
      const topic = this.topicManager.getTopic(topicName);
      if (!topic) continue;
      
      const consumerPerTopic = Math.min(config.consumers, topic.partitions.length);
      
      for (let i = 0; i < consumerPerTopic; i++) {
        for (let j = i; j < topic.partitions.length; j += consumerPerTopic) {
          consumers.push({
            id: `consumer-${config.name}-${consumers.length}`,
            groupId: config.name,
            topic: topicName,
            partition: j,
            consumeRate: config.consumeRate,
            maxConsumeRate: config.maxConsumeRate,
            currentOffset: 0,
            isAlive: true,
            lastProcessedTime: 0,
          });
        }
      }
    }
    
    const consumerGroup: ConsumerGroup = {
      name: config.name,
      topics: config.topics,
      consumers,
      retry: config.retry,
      deadLetter: config.deadLetter,
      ack: config.ack,
      scaling: config.scaling,
      throttling: config.throttling,
      failure: config.failure,
      baseConsumeRate: config.consumeRate,
      currentConsumeRate: config.consumeRate,
      lastScaleActionTime: 0,
    };
    
    this.consumerGroups.push(consumerGroup);
  }
  
  getConsumerGroups(): ConsumerGroup[] {
    return [...this.consumerGroups];
  }
  
  getDeadLetterMessages(): Message[] {
    return [...this.deadLetterMessages];
  }
  
  consume(currentTime: number): ConsumeResult {
    const result: ConsumeResult = {
      consumed: [],
      failed: [],
      deadLetter: [],
      requeued: [],
    };
    
    for (const group of this.consumerGroups) {
      this.handleConsumerFailures(group, currentTime);
      this.handleAutoScaling(group, currentTime);
      
      for (const consumer of group.consumers) {
        if (!consumer.isAlive) {
          continue;
        }
        
        const consumerResult = this.consumeFromConsumer(consumer, group, currentTime);
        result.consumed.push(...consumerResult.consumed);
        result.failed.push(...consumerResult.failed);
        result.deadLetter.push(...consumerResult.deadLetter);
        result.requeued.push(...consumerResult.requeued);
      }
    }
    
    this.deadLetterMessages.push(...result.deadLetter);
    
    return result;
  }
  
  private handleConsumerFailures(group: ConsumerGroup, currentTime: number): void {
    for (const consumer of group.consumers) {
      if (consumer.isAlive) {
        if (this.rng.next() < group.failure.crashProbability) {
          consumer.isAlive = false;
          consumer.crashedAt = currentTime;
        }
      } else {
        if (consumer.crashedAt !== undefined && 
            currentTime - consumer.crashedAt >= group.failure.recoveryTime) {
          consumer.isAlive = true;
          consumer.crashedAt = undefined;
        }
      }
    }
  }
  
  private handleAutoScaling(group: ConsumerGroup, currentTime: number): void {
    if (!group.scaling.enableAutoScaling) {
      return;
    }
    
    const totalLag = this.getGroupTotalLag(group);
    const timeSinceLastScale = currentTime - group.lastScaleActionTime;
    
    if (totalLag > group.scaling.targetLag * 2) {
      if (timeSinceLastScale >= group.scaling.scaleUpDelay) {
        if (group.consumers.length < group.scaling.maxConsumers) {
          this.scaleUp(group, currentTime);
        }
      }
    } else if (totalLag < group.scaling.targetLag / 2) {
      if (timeSinceLastScale >= group.scaling.scaleDownDelay) {
        if (group.consumers.length > 1) {
          this.scaleDown(group, currentTime);
        }
      }
    }
  }
  
  private getGroupTotalLag(group: ConsumerGroup): number {
    let totalLag = 0;
    for (const consumer of group.consumers) {
      totalLag += this.topicManager.getTotalLag(
        consumer.topic,
        consumer.partition,
        consumer.currentOffset
      );
    }
    return totalLag;
  }
  
  private scaleUp(group: ConsumerGroup, currentTime: number): void {
    group.lastScaleActionTime = currentTime;
    
    const consumerPerTopic = Math.ceil((group.consumers.length + 1) / group.topics.length);
    
    for (const topicName of group.topics) {
      const topic = this.topicManager.getTopic(topicName);
      if (!topic) continue;
      
      if (group.consumers.length < topic.partitions.length) {
        const usedPartitions = new Set(
          group.consumers
            .filter(c => c.topic === topicName)
            .map(c => c.partition)
        );
        
        for (let i = 0; i < topic.partitions.length; i++) {
          if (!usedPartitions.has(i)) {
            group.consumers.push({
              id: `consumer-${group.name}-${group.consumers.length}`,
              groupId: group.name,
              topic: topicName,
              partition: i,
              consumeRate: group.baseConsumeRate,
              maxConsumeRate: group.currentConsumeRate,
              currentOffset: 0,
              isAlive: true,
              lastProcessedTime: currentTime,
            });
            break;
          }
        }
      }
    }
  }
  
  private scaleDown(group: ConsumerGroup, currentTime: number): void {
    group.lastScaleActionTime = currentTime;
    
    if (group.consumers.length > 1) {
      group.consumers.pop();
    }
  }
  
  private consumeFromConsumer(
    consumer: Consumer,
    group: ConsumerGroup,
    currentTime: number
  ): ConsumeResult {
    const result: ConsumeResult = {
      consumed: [],
      failed: [],
      deadLetter: [],
      requeued: [],
    };
    
    const lag = this.topicManager.getTotalLag(
      consumer.topic,
      consumer.partition,
      consumer.currentOffset
    );
    
    if (lag === 0) {
      return result;
    }
    
    let consumeRate = consumer.consumeRate;
    if (group.throttling.enableThrottling) {
      if (lag < 10) {
        consumeRate = Math.max(group.throttling.minRate, Math.floor(consumeRate * 0.5));
      }
    }
    
    const count = Math.min(consumeRate, lag);
    
    const messages = this.topicManager.getMessages(
      consumer.topic,
      consumer.partition,
      consumer.currentOffset,
      count
    );
    
    for (const message of messages) {
      const success = this.processMessage(message, group, currentTime);
      
      if (success) {
        result.consumed.push(message);
        consumer.currentOffset++;
      } else {
        message.attempts++;
        result.failed.push(message);
        
        if (message.attempts >= group.retry.maxAttempts) {
          result.deadLetter.push(message);
          consumer.currentOffset++;
        } else {
          result.requeued.push(message);
        }
      }
    }
    
    return result;
  }
  
  private processMessage(
    message: Message,
    group: ConsumerGroup,
    currentTime: number
  ): boolean {
    const baseFailureRate = 0.05;
    const retryFailureRate = baseFailureRate * Math.pow(0.8, message.attempts);
    
    if (this.rng.next() < retryFailureRate) {
      return false;
    }
    
    if (group.ack.mode === 'manual') {
      if (this.rng.next() < 0.01) {
        return false;
      }
    }
    
    return true;
  }
}
