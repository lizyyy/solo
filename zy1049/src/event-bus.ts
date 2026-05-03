import { EventEmitter } from 'events';
import { EventRecord } from './types';

export class PluginEventBus {
  private emitter: EventEmitter;
  private eventLog: EventRecord[];
  private pluginName: string;
  private maxEvents: number;

  constructor(pluginName: string, maxEvents: number = 10000) {
    this.emitter = new EventEmitter();
    this.eventLog = [];
    this.pluginName = pluginName;
    this.maxEvents = maxEvents;
  }

  subscribe(eventName: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(eventName, listener);
    this.logEvent({
      timestamp: Date.now(),
      type: 'subscribe',
      eventName,
    });
  }

  unsubscribe(eventName: string, listener: (...args: unknown[]) => void): void {
    this.emitter.off(eventName, listener);
  }

  publish(eventName: string, data?: unknown): void {
    this.logEvent({
      timestamp: Date.now(),
      type: 'publish',
      eventName,
      data,
    });
    this.emitter.emit(eventName, data);
  }

  emit(eventName: string, data?: unknown): void {
    this.logEvent({
      timestamp: Date.now(),
      type: 'emit',
      eventName,
      data,
    });
    this.emitter.emit(eventName, data);
  }

  once(eventName: string, listener: (...args: unknown[]) => void): void {
    this.emitter.once(eventName, listener);
  }

  private logEvent(event: EventRecord): void {
    if (this.eventLog.length >= this.maxEvents) {
      this.eventLog.shift();
    }
    this.eventLog.push(event);
  }

  getEvents(): EventRecord[] {
    return [...this.eventLog];
  }

  getEventsByType(type: 'subscribe' | 'publish' | 'emit'): EventRecord[] {
    return this.eventLog.filter(e => e.type === type);
  }

  getEventsByName(eventName: string): EventRecord[] {
    return this.eventLog.filter(e => e.eventName === eventName);
  }

  clearEvents(): void {
    this.eventLog = [];
  }

  replayEvents(startTime?: number, endTime?: number): EventRecord[] {
    let events = [...this.eventLog];
    
    if (startTime !== undefined) {
      events = events.filter(e => e.timestamp >= startTime);
    }
    if (endTime !== undefined) {
      events = events.filter(e => e.timestamp <= endTime);
    }
    
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  getStats(): {
    total: number;
    subscribe: number;
    publish: number;
    emit: number;
    uniqueEvents: string[];
  } {
    const uniqueEvents = new Set<string>();
    let subscribe = 0;
    let publish = 0;
    let emit = 0;

    for (const event of this.eventLog) {
      uniqueEvents.add(event.eventName);
      if (event.type === 'subscribe') subscribe++;
      if (event.type === 'publish') publish++;
      if (event.type === 'emit') emit++;
    }

    return {
      total: this.eventLog.length,
      subscribe,
      publish,
      emit,
      uniqueEvents: Array.from(uniqueEvents),
    };
  }

  destroy(): void {
    this.emitter.removeAllListeners();
    this.eventLog = [];
  }
}

export default PluginEventBus;
