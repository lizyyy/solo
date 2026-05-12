import { Event, Registration } from '../types';
import { logger } from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  version: number;
}

export class CacheService {
  private eventCache: Map<string, CacheEntry<Event>> = new Map();
  private eventListCache: Map<string, CacheEntry<Event[]>> = new Map();
  private registrationsCache: Map<string, CacheEntry<Registration[]>> = new Map();
  private ttlMs: number = 60 * 1000;

  constructor(ttlMs: number = 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  getEvent(eventId: string): Event | null {
    const entry = this.eventCache.get(eventId);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.eventCache.delete(eventId);
      return null;
    }
    return entry.value;
  }

  setEvent(event: Event): void {
    this.eventCache.set(event.id, {
      value: event,
      timestamp: Date.now(),
      version: event.version,
    });
    logger.debug('Cache set', { type: 'event', id: event.id, version: event.version });
  }

  invalidateEvent(eventId: string): void {
    this.eventCache.delete(eventId);
    this.invalidateEventList();
    logger.debug('Cache invalidated', { type: 'event', id: eventId });
  }

  getEventList(key: string = 'all'): Event[] | null {
    const entry = this.eventListCache.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.eventListCache.delete(key);
      return null;
    }
    return entry.value;
  }

  setEventList(events: Event[], key: string = 'all'): void {
    this.eventListCache.set(key, {
      value: events,
      timestamp: Date.now(),
      version: Date.now(),
    });
    logger.debug('Cache set', { type: 'eventList', key, count: events.length });
  }

  invalidateEventList(): void {
    this.eventListCache.clear();
    logger.debug('Cache invalidated', { type: 'eventList' });
  }

  getRegistrations(eventId: string): Registration[] | null {
    const entry = this.registrationsCache.get(eventId);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.registrationsCache.delete(eventId);
      return null;
    }
    return entry.value;
  }

  setRegistrations(eventId: string, registrations: Registration[]): void {
    this.registrationsCache.set(eventId, {
      value: registrations,
      timestamp: Date.now(),
      version: Date.now(),
    });
    logger.debug('Cache set', { type: 'registrations', eventId, count: registrations.length });
  }

  invalidateRegistrations(eventId: string): void {
    this.registrationsCache.delete(eventId);
    this.invalidateEvent(eventId);
    logger.debug('Cache invalidated', { type: 'registrations', eventId });
  }

  invalidateAll(): void {
    this.eventCache.clear();
    this.eventListCache.clear();
    this.registrationsCache.clear();
    logger.info('All cache invalidated');
  }

  getStats(): {
    events: number;
    eventLists: number;
    registrations: number;
  } {
    return {
      events: this.eventCache.size,
      eventLists: this.eventListCache.size,
      registrations: this.registrationsCache.size,
    };
  }
}

export const cacheService = new CacheService();
