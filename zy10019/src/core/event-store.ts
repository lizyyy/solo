import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { EventRecord, ReplayConfig } from '../types';
import { DEFAULT_REPLAY_CONFIG } from '../config';
import { logger } from '../utils/logger';

interface EventStoreEvents {
  'event:recorded': (event: EventRecord) => void;
  'replay:start': (count: number) => void;
  'replay:progress': (current: number, total: number) => void;
  'replay:complete': () => void;
  'store:persisted': (path: string, count: number) => void;
  'store:loaded': (path: string, count: number) => void;
}

export interface ReplayOptions {
  startTime?: number;
  endTime?: number;
  eventTypes?: string[];
  levels?: EventRecord['level'][];
  limit?: number;
  speed?: number;
}

export interface ReplayResult {
  total: number;
  replayed: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export class EventStore extends EventEmitter<EventStoreEvents> {
  private events: EventRecord[];
  private config: ReplayConfig;
  private isPersisting: boolean = false;
  private persistTimer?: NodeJS.Timeout;
  private persistInterval: number = 5000;

  constructor(config?: Partial<ReplayConfig>) {
    super();
    this.config = { ...DEFAULT_REPLAY_CONFIG, ...config };
    this.events = [];
    this.ensureStoragePath();
    
    if (this.config.autoPersist) {
      this.startAutoPersist();
    }
  }

  private ensureStoragePath(): void {
    if (!fs.existsSync(this.config.storagePath)) {
      fs.mkdirSync(this.config.storagePath, { recursive: true });
      logger.info('Created event storage directory', { path: this.config.storagePath });
    }
  }

  private startAutoPersist(): void {
    this.persistTimer = setInterval(() => {
      this.persist().catch(error => {
        logger.error('Error persisting events', error as Error);
      });
    }, this.persistInterval);
  }

  record(event: Omit<EventRecord, 'id' | 'timestamp'>): EventRecord {
    const record: EventRecord = {
      ...event,
      id: uuidv4(),
      timestamp: Date.now()
    };

    this.events.push(record);

    if (this.events.length > this.config.maxRecords) {
      const removed = this.events.splice(0, this.events.length - this.config.maxRecords);
      logger.debug('Trimmed event store', { removed: removed.length });
    }

    this.cleanupExpired();
    this.emit('event:recorded', record);

    return record;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const cutoff = now - this.config.retentionPeriod;
    
    const initialLength = this.events.length;
    this.events = this.events.filter(e => e.timestamp >= cutoff);
    const removed = initialLength - this.events.length;
    
    if (removed > 0) {
      logger.debug('Cleaned up expired events', { removed, retentionPeriod: this.config.retentionPeriod });
    }
  }

  getEvents(options?: ReplayOptions): EventRecord[] {
    let events = [...this.events];

    if (options?.startTime) {
      events = events.filter(e => e.timestamp >= options.startTime!);
    }

    if (options?.endTime) {
      events = events.filter(e => e.timestamp <= options.endTime!);
    }

    if (options?.eventTypes && options.eventTypes.length > 0) {
      const types = new Set(options.eventTypes);
      events = events.filter(e => types.has(e.type));
    }

    if (options?.levels && options.levels.length > 0) {
      const levels = new Set(options.levels);
      events = events.filter(e => levels.has(e.level));
    }

    if (options?.limit && options.limit > 0) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  getEventById(id: string): EventRecord | undefined {
    return this.events.find(e => e.id === id);
  }

  async replay(
    handler: (event: EventRecord, index: number, total: number) => Promise<void> | void,
    options?: ReplayOptions
  ): Promise<ReplayResult> {
    const events = this.getEvents(options);
    const total = events.length;
    const speed = options?.speed ?? 1;

    logger.info('Starting event replay', {
      total,
      options
    });

    this.emit('replay:start', total);

    const startTime = Date.now();
    let replayed = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      try {
        await handler(event, i, total);
        replayed++;
      } catch (error) {
        logger.error('Error during event replay', error as Error, {
          eventId: event.id,
          eventType: event.type
        });
      }

      if (speed < 1) {
        const delay = Math.floor((1 / speed) - 1) * 100;
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (i % 100 === 0 || i === total - 1) {
        this.emit('replay:progress', i + 1, total);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    this.emit('replay:complete');

    logger.info('Event replay completed', {
      total,
      replayed,
      duration
    });

    return {
      total,
      replayed,
      startTime,
      endTime,
      duration
    };
  }

  async persist(): Promise<void> {
    if (this.isPersisting || this.events.length === 0) {
      return;
    }

    this.isPersisting = true;
    
    try {
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      const filename = `events-${today}-${now}.json`;
      const filePath = path.join(this.config.storagePath, filename);

      const data = JSON.stringify(this.events, null, 2);
      await fs.promises.writeFile(filePath, data);

      logger.debug('Persisted events to disk', {
        path: filePath,
        count: this.events.length
      });

      this.emit('store:persisted', filePath, this.events.length);
    } catch (error) {
      logger.error('Failed to persist events', error as Error);
    } finally {
      this.isPersisting = false;
    }
  }

  async loadFromFile(filePath: string): Promise<EventRecord[]> {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const events = JSON.parse(data) as EventRecord[];
      
      const validEvents = events.filter(e => 
        e.id && e.timestamp && e.type && e.message
      );

      this.events.push(...validEvents);

      if (this.events.length > this.config.maxRecords) {
        this.events.splice(0, this.events.length - this.config.maxRecords);
      }

      logger.info('Loaded events from file', {
        path: filePath,
        count: validEvents.length
      });

      this.emit('store:loaded', filePath, validEvents.length);
      return validEvents;
    } catch (error) {
      logger.error('Failed to load events from file', error as Error, { path: filePath });
      return [];
    }
  }

  async loadFromDirectory(directory?: string): Promise<EventRecord[]> {
    const dir = directory ?? this.config.storagePath;
    
    try {
      const files = await fs.promises.readdir(dir);
      const eventFiles = files
        .filter(f => f.startsWith('events-') && f.endsWith('.json'))
        .sort()
        .reverse();

      let totalLoaded = 0;

      for (const file of eventFiles) {
        const filePath = path.join(dir, file);
        const loaded = await this.loadFromFile(filePath);
        totalLoaded += loaded.length;

        if (this.events.length >= this.config.maxRecords) {
          break;
        }
      }

      logger.info('Loaded all events from directory', {
        directory: dir,
        totalLoaded,
        fileCount: eventFiles.length
      });

      return this.events;
    } catch (error) {
      logger.error('Failed to load events from directory', error as Error, { directory: dir });
      return [];
    }
  }

  getStats(): {
    total: number;
    byType: Record<string, number>;
    byLevel: Record<string, number>;
    oldest: number | null;
    newest: number | null;
  } {
    const stats: {
      total: number;
      byType: Record<string, number>;
      byLevel: Record<string, number>;
      oldest: number | null;
      newest: number | null;
    } = {
      total: this.events.length,
      byType: {},
      byLevel: {},
      oldest: null,
      newest: null
    };

    for (const event of this.events) {
      stats.byType[event.type] = (stats.byType[event.type] ?? 0) + 1;
      stats.byLevel[event.level] = (stats.byLevel[event.level] ?? 0) + 1;
      
      if (stats.oldest === null || event.timestamp < stats.oldest) {
        stats.oldest = event.timestamp;
      }
      
      if (stats.newest === null || event.timestamp > stats.newest) {
        stats.newest = event.timestamp;
      }
    }

    return stats;
  }

  clear(): void {
    const count = this.events.length;
    this.events = [];
    logger.info('Event store cleared', { removed: count });
  }

  async destroy(): Promise<void> {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = undefined;
    }
    
    await this.persist();
  }
}
