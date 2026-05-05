import { Topic, Partition, Message } from '../types';

export class TopicManager {
  private topics: Map<string, Topic>;
  
  constructor() {
    this.topics = new Map();
  }
  
  createTopic(name: string, partitionCount: number, retention: number): Topic {
    if (this.topics.has(name)) {
      throw new Error(`Topic ${name} 已存在`);
    }
    
    const partitions: Partition[] = [];
    for (let i = 0; i < partitionCount; i++) {
      partitions.push({
        id: i,
        messages: [],
        latestOffset: 0,
      });
    }
    
    const topic: Topic = {
      name,
      partitions,
      retention,
    };
    
    this.topics.set(name, topic);
    return topic;
  }
  
  getTopic(name: string): Topic | undefined {
    return this.topics.get(name);
  }
  
  getAllTopics(): Topic[] {
    return Array.from(this.topics.values());
  }
  
  appendMessage(topicName: string, partitionId: number, message: Message): void {
    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic ${topicName} 不存在`);
    }
    
    const partition = topic.partitions.find(p => p.id === partitionId);
    if (!partition) {
      throw new Error(`Partition ${partitionId} 不存在于 Topic ${topicName}`);
    }
    
    message.offset = partition.latestOffset;
    partition.latestOffset++;
    partition.messages.push(message);
  }
  
  getMessages(topicName: string, partitionId: number, startOffset: number, count: number): Message[] {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return [];
    }
    
    const partition = topic.partitions.find(p => p.id === partitionId);
    if (!partition) {
      return [];
    }
    
    return partition.messages.slice(startOffset, startOffset + count);
  }
  
  getLatestOffset(topicName: string, partitionId: number): number {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return -1;
    }
    
    const partition = topic.partitions.find(p => p.id === partitionId);
    if (!partition) {
      return -1;
    }
    
    return partition.latestOffset;
  }
  
  getTotalLag(topicName: string, partitionId: number, currentOffset: number): number {
    const latestOffset = this.getLatestOffset(topicName, partitionId);
    if (latestOffset < 0) {
      return 0;
    }
    return Math.max(0, latestOffset - currentOffset);
  }
  
  getAllMessagesCount(): number {
    let count = 0;
    for (const topic of this.topics.values()) {
      for (const partition of topic.partitions) {
        count += partition.messages.length;
      }
    }
    return count;
  }
}
