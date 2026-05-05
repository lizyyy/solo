import { Producer, ProducerConfig, Message } from '../types';
import { MessageFactory, hashKeyToPartition } from './message';
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

export class ProducerManager {
  private producers: Producer[];
  private messageFactory: MessageFactory;
  private topicManager: TopicManager;
  private rng: SeededRandom;
  
  constructor(seed: number, messageFactory: MessageFactory, topicManager: TopicManager) {
    this.producers = [];
    this.messageFactory = messageFactory;
    this.topicManager = topicManager;
    this.rng = new SeededRandom(seed);
  }
  
  addProducer(config: ProducerConfig): void {
    const producer: Producer = {
      id: `producer-${this.producers.length}`,
      topic: config.topic,
      rate: config.rate,
      burstRate: config.burstRate,
      startTime: config.startTime,
      duration: config.duration,
      sequentialKeyField: config.sequentialKeyField,
      idempotentKeyField: config.idempotentKeyField,
      duplicateProbability: config.duplicateProbability ?? 0.01,
      active: true,
    };
    
    this.producers.push(producer);
  }
  
  getProducers(): Producer[] {
    return [...this.producers];
  }
  
  produce(currentTime: number): { messages: Message[]; duplicates: Message[] } {
    const producedMessages: Message[] = [];
    const duplicateMessages: Message[] = [];
    
    for (const producer of this.producers) {
      if (!this.isProducerActive(producer, currentTime)) {
        continue;
      }
      
      const messages = this.produceForProducer(producer, currentTime);
      producedMessages.push(...messages);
      
      for (const msg of messages) {
        if (this.rng.next() < producer.duplicateProbability) {
          const duplicate = this.messageFactory.createDuplicateMessage(msg, currentTime);
          duplicateMessages.push(duplicate);
        }
      }
    }
    
    for (const msg of [...producedMessages, ...duplicateMessages]) {
      const topic = this.topicManager.getTopic(msg.topic);
      if (topic) {
        const partitionId = hashKeyToPartition(msg.key, topic.partitions.length);
        this.topicManager.appendMessage(msg.topic, partitionId, msg);
      }
    }
    
    return {
      messages: producedMessages,
      duplicates: duplicateMessages,
    };
  }
  
  private isProducerActive(producer: Producer, currentTime: number): boolean {
    return currentTime >= producer.startTime && 
           currentTime < producer.startTime + producer.duration;
  }
  
  private produceForProducer(producer: Producer, currentTime: number): Message[] {
    const messages: Message[] = [];
    
    const baseRate = producer.rate;
    const burstRate = producer.burstRate;
    
    const burstFactor = Math.max(0.3, Math.sin(currentTime * 0.1) * 0.3 + 0.7);
    const actualRate = Math.floor(baseRate + (burstRate - baseRate) * burstFactor);
    
    const count = Math.max(1, actualRate);
    
    const topic = this.topicManager.getTopic(producer.topic);
    if (!topic) {
      return [];
    }
    
    for (let i = 0; i < count; i++) {
      const msg = this.messageFactory.createMessage(
        producer.topic,
        0,
        0,
        producer.sequentialKeyField,
        producer.idempotentKeyField,
        currentTime
      );
      
      messages.push(msg);
    }
    
    return messages;
  }
}
