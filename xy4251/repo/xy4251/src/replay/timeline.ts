import { MqttMessage, ReplayEvent } from '../types';

export class Timeline {
  private messages: MqttMessage[] = [];
  private events: ReplayEvent[] = [];
  private currentTime: number = 0;
  private isReplaying: boolean = false;
  private eventListeners: Map<string, Array<(event: ReplayEvent) => void>> = new Map();

  constructor(messages?: MqttMessage[]) {
    if (messages) {
      this.messages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  addMessage(message: MqttMessage): void {
    this.messages.push(message);
    this.messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  addMessages(messages: MqttMessage[]): void {
    this.messages = [...this.messages, ...messages].sort((a, b) => a.timestamp - b.timestamp);
  }

  addEvent(event: ReplayEvent): void {
    this.events.push(event);
    this.notifyListeners(event);
  }

  on(eventType: string, callback: (event: ReplayEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)?.push(callback);
  }

  private notifyListeners(event: ReplayEvent): void {
    const typeListeners = this.eventListeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(callback => callback(event));
    }

    const allListeners = this.eventListeners.get('*');
    if (allListeners) {
      allListeners.forEach(callback => callback(event));
    }
  }

  getStartTime(): number | undefined {
    if (this.messages.length === 0) {
      return undefined;
    }
    return this.messages[0].timestamp;
  }

  getEndTime(): number | undefined {
    if (this.messages.length === 0) {
      return undefined;
    }
    return this.messages[this.messages.length - 1].timestamp;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getMessages(): MqttMessage[] {
    return [...this.messages];
  }

  getEvents(): ReplayEvent[] {
    return [...this.events];
  }

  getMessagesInRange(start: number, end: number): MqttMessage[] {
    return this.messages.filter(m => m.timestamp >= start && m.timestamp <= end);
  }

  getEventsInRange(start: number, end: number): ReplayEvent[] {
    return this.events.filter(e => e.timestamp >= start && e.timestamp <= end);
  }

  reset(): void {
    this.events = [];
    this.currentTime = this.getStartTime() || 0;
    this.isReplaying = false;
  }

  isRunning(): boolean {
    return this.isReplaying;
  }

  getDuration(): number {
    const start = this.getStartTime();
    const end = this.getEndTime();
    
    if (!start || !end) {
      return 0;
    }
    
    return end - start;
  }

  getDeviceIds(): Set<string> {
    const deviceIds = new Set<string>();
    for (const message of this.messages) {
      deviceIds.add(message.clientId);
    }
    return deviceIds;
  }

  getTopics(): Set<string> {
    const topics = new Set<string>();
    for (const message of this.messages) {
      topics.add(message.topic);
    }
    return topics;
  }

  getStatistics(): {
    totalMessages: number;
    totalEvents: number;
    startTime: number | undefined;
    endTime: number | undefined;
    duration: number;
    deviceCount: number;
    topicCount: number;
  } {
    return {
      totalMessages: this.messages.length,
      totalEvents: this.events.length,
      startTime: this.getStartTime(),
      endTime: this.getEndTime(),
      duration: this.getDuration(),
      deviceCount: this.getDeviceIds().size,
      topicCount: this.getTopics().size
    };
  }
}
