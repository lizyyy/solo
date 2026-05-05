import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types';

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

export class MessageFactory {
  private rng: SeededRandom;
  private sequentialKeyCounter: Map<string, number>;
  private idempotentKeySet: Set<string>;
  
  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
    this.sequentialKeyCounter = new Map();
    this.idempotentKeySet = new Set();
  }
  
  createMessage(
    topic: string,
    partition: number,
    offset: number,
    sequentialKeyField: string,
    idempotentKeyField: string,
    timestamp: number
  ): Message {
    const sequentialKey = this.generateSequentialKey(topic, sequentialKeyField);
    const idempotentKey = this.generateIdempotentKey(idempotentKeyField);
    
    return {
      id: uuidv4(),
      topic,
      partition,
      offset,
      key: sequentialKey,
      idempotentKey,
      payload: this.generatePayload(topic, sequentialKeyField, sequentialKey, idempotentKeyField, idempotentKey),
      timestamp,
      produceTime: timestamp,
      attempts: 0,
      isDuplicate: false,
    };
  }
  
  createDuplicateMessage(originalMessage: Message, timestamp: number): Message {
    return {
      ...originalMessage,
      id: uuidv4(),
      timestamp,
      produceTime: timestamp,
      isDuplicate: true,
      originalMessageId: originalMessage.id,
    };
  }
  
  createRetryMessage(message: Message, timestamp: number): Message {
    return {
      ...message,
      id: uuidv4(),
      timestamp,
      attempts: message.attempts + 1,
    };
  }
  
  private generateSequentialKey(topic: string, keyField: string): string {
    const key = `${topic}-${keyField}`;
    const current = this.sequentialKeyCounter.get(key) ?? 0;
    const newValue = current + 1;
    this.sequentialKeyCounter.set(key, newValue);
    
    if (this.rng.next() < 0.3) {
      const existingKeys = Array.from({ length: newValue }, (_, i) => i + 1);
      const randomKey = existingKeys[this.rng.nextInt(0, existingKeys.length - 1)];
      return `${keyField}-${randomKey}`;
    }
    
    return `${keyField}-${newValue}`;
  }
  
  private generateIdempotentKey(keyField: string): string {
    let key: string;
    do {
      key = `${keyField}-${uuidv4().substring(0, 8)}`;
    } while (this.idempotentKeySet.has(key));
    
    this.idempotentKeySet.add(key);
    return key;
  }
  
  private generatePayload(
    topic: string,
    sequentialKeyField: string,
    sequentialKey: string,
    idempotentKeyField: string,
    idempotentKey: string
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      [sequentialKeyField]: sequentialKey,
      [idempotentKeyField]: idempotentKey,
    };
    
    if (topic.includes('order')) {
      Object.assign(payload, {
        amount: this.rng.nextInt(100, 10000),
        currency: 'CNY',
        status: ['pending', 'paid', 'shipped'][this.rng.nextInt(0, 2)],
        items: [
          { sku: `SKU-${this.rng.nextInt(1000, 9999)}`, quantity: this.rng.nextInt(1, 10) },
        ],
      });
    } else if (topic.includes('payment')) {
      Object.assign(payload, {
        amount: this.rng.nextInt(100, 10000),
        method: ['alipay', 'wechat', 'card'][this.rng.nextInt(0, 2)],
        status: ['pending', 'success', 'failed'][this.rng.nextInt(0, 2)],
      });
    } else if (topic.includes('user')) {
      Object.assign(payload, {
        action: ['created', 'updated', 'deleted'][this.rng.nextInt(0, 2)],
        email: `user-${this.rng.nextInt(1000, 9999)}@example.com`,
      });
    } else if (topic.includes('inventory')) {
      Object.assign(payload, {
        sku: `SKU-${this.rng.nextInt(1000, 9999)}`,
        quantity: this.rng.nextInt(-100, 100),
        warehouse: `WH-${this.rng.nextInt(1, 5)}`,
      });
    } else if (topic.includes('notification')) {
      Object.assign(payload, {
        type: ['sms', 'email', 'push'][this.rng.nextInt(0, 2)],
        template: `template-${this.rng.nextInt(1, 10)}`,
        priority: this.rng.nextInt(1, 5),
      });
    }
    
    return payload;
  }
}

export function hashKeyToPartition(key: string, partitionCount: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % partitionCount;
}
