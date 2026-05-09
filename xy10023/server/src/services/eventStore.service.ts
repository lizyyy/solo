import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Event, EventType, AggregateType, OperatorType } from '../models/Event';
import { sequelize } from '../database';
import logger from '../utils/logger';
import redisService from './redis.service';
import { config } from '../config';

export interface EventData {
  aggregateId: string;
  aggregateType: AggregateType;
  eventType: EventType;
  eventData: Record<string, unknown>;
  operatorId: string;
  operatorType: OperatorType;
  requestId?: string;
}

export interface ReplayResult {
  state: Record<string, unknown>;
  events: Event[];
  finalVersion: number;
}

interface StateReducer<T> {
  (state: T, event: Event): T;
}

class EventStoreService {
  private readonly CACHE_PREFIX = 'event:last_version:';
  private readonly CACHE_TTL = config.cache.ttl;

  async appendEvent(
    eventData: EventData,
    transaction?: Transaction
  ): Promise<Event> {
    const tx = transaction || (await sequelize.transaction());

    try {
      const lastVersion = await this.getLastVersion(
        eventData.aggregateId,
        tx
      );
      const nextVersion = lastVersion + 1;

      const event = await Event.create(
        {
          id: uuidv4(),
          aggregateId: eventData.aggregateId,
          aggregateType: eventData.aggregateType,
          eventType: eventData.eventType,
          eventData: eventData.eventData,
          version: nextVersion,
          requestId: eventData.requestId,
          operatorId: eventData.operatorId,
          operatorType: eventData.operatorType,
        },
        { transaction: tx }
      );

      if (!transaction) {
        await tx.commit();
      }

      await this.updateCachedVersion(eventData.aggregateId, nextVersion);
      await this.publishEvent(event);

      logger.info(
        `Event appended: ${eventData.eventType} for ${eventData.aggregateType}:${eventData.aggregateId} v${nextVersion}`
      );

      return event;
    } catch (error) {
      if (!transaction) {
        await tx.rollback();
      }
      logger.error('Failed to append event:', error);
      throw error;
    }
  }

  async appendEvents(
    eventsData: EventData[],
    transaction?: Transaction
  ): Promise<Event[]> {
    if (eventsData.length === 0) return [];

    const tx = transaction || (await sequelize.transaction());

    try {
      const aggregateId = eventsData[0].aggregateId;
      let currentVersion = await this.getLastVersion(aggregateId, tx);

      const events: Event[] = [];
      for (const eventData of eventsData) {
        currentVersion += 1;
        const event = await Event.create(
          {
            id: uuidv4(),
            aggregateId: eventData.aggregateId,
            aggregateType: eventData.aggregateType,
            eventType: eventData.eventType,
            eventData: eventData.eventData,
            version: currentVersion,
            requestId: eventData.requestId,
            operatorId: eventData.operatorId,
            operatorType: eventData.operatorType,
          },
          { transaction: tx }
        );
        events.push(event);
      }

      if (!transaction) {
        await tx.commit();
      }

      await this.updateCachedVersion(aggregateId, currentVersion);

      for (const event of events) {
        await this.publishEvent(event);
      }

      logger.info(
        `Batch appended ${events.length} events for aggregate: ${aggregateId}`
      );

      return events;
    } catch (error) {
      if (!transaction) {
        await tx.rollback();
      }
      logger.error('Failed to append events batch:', error);
      throw error;
    }
  }

  async getEvents(
    aggregateId: string,
    options?: {
      fromVersion?: number;
      toVersion?: number;
      limit?: number;
    }
  ): Promise<Event[]> {
    const where: Record<string, unknown> = { aggregateId };

    if (options?.fromVersion !== undefined) {
      where['version'] = { [Symbol.for('gte')]: options.fromVersion } as any;
    }

    if (options?.toVersion !== undefined) {
      where['version'] = {
        ...(where['version'] as object),
        [Symbol.for('lte')]: options.toVersion,
      } as any;
    }

    const events = await Event.findAll({
      where,
      order: [['version', 'ASC']],
      limit: options?.limit,
    });

    return events;
  }

  async getLastVersion(
    aggregateId: string,
    transaction?: Transaction
  ): Promise<number> {
    const cached = await redisService.get(`${this.CACHE_PREFIX}${aggregateId}`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    const lastEvent = await Event.findOne({
      where: { aggregateId },
      order: [['version', 'DESC']],
      transaction,
    });

    const version = lastEvent ? lastEvent.version : 0;
    await this.updateCachedVersion(aggregateId, version);

    return version;
  }

  async replayToVersion<T>(
    aggregateId: string,
    targetVersion: number,
    initialState: T,
    reducer: StateReducer<T>
  ): Promise<ReplayResult> {
    const events = await this.getEvents(aggregateId, {
      toVersion: targetVersion,
    });

    let state = { ...initialState } as T;
    for (const event of events) {
      state = reducer(state, event);
    }

    return {
      state: state as unknown as Record<string, unknown>,
      events,
      finalVersion: events.length > 0 ? events[events.length - 1].version : 0,
    };
  }

  async replayAll<T>(
    aggregateId: string,
    initialState: T,
    reducer: StateReducer<T>
  ): Promise<ReplayResult> {
    const lastVersion = await this.getLastVersion(aggregateId);
    return this.replayToVersion(aggregateId, lastVersion, initialState, reducer);
  }

  async getEventById(eventId: string): Promise<Event | null> {
    return Event.findByPk(eventId);
  }

  async getEventsByOperator(
    operatorId: string,
    options?: {
      startTime?: Date;
      endTime?: Date;
      eventType?: EventType;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ events: Event[]; total: number }> {
    const where: Record<string, unknown> = { operatorId };

    if (options?.startTime) {
      where['created_at'] = { [Symbol.for('gte')]: options.startTime } as any;
    }

    if (options?.endTime) {
      where['created_at'] = {
        ...(where['created_at'] as object),
        [Symbol.for('lte')]: options.endTime,
      } as any;
    }

    if (options?.eventType) {
      where['event_type'] = options.eventType;
    }

    const { count, rows } = await Event.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: options?.limit,
      offset: options?.offset,
    });

    return { events: rows, total: count };
  }

  async getEventsByType(
    eventType: EventType,
    options?: {
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<Event[]> {
    const where: Record<string, unknown> = { eventType };

    if (options?.startTime) {
      where['created_at'] = { [Symbol.for('gte')]: options.startTime } as any;
    }

    if (options?.endTime) {
      where['created_at'] = {
        ...(where['created_at'] as object),
        [Symbol.for('lte')]: options.endTime,
      } as any;
    }

    return Event.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: options?.limit,
    });
  }

  private async updateCachedVersion(
    aggregateId: string,
    version: number
  ): Promise<void> {
    await redisService.set(
      `${this.CACHE_PREFIX}${aggregateId}`,
      version.toString(),
      { EX: this.CACHE_TTL }
    );
  }

  private async publishEvent(event: Event): Promise<void> {
    const message = JSON.stringify({
      eventId: event.id,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      eventType: event.eventType,
      version: event.version,
      createdAt: event.createdAt,
    });

    await redisService.publish('events', message);
    await redisService.publish(
      `events:${event.aggregateType}:${event.aggregateId}`,
      message
    );
  }

  async createSnapshot(
    aggregateId: string,
    version: number,
    state: Record<string, unknown>
  ): Promise<void> {
    const snapshotKey = `snapshot:${aggregateId}`;
    await redisService.setJSON(
      snapshotKey,
      { version, state, createdAt: new Date().toISOString() },
      3600 * 24 * 7
    );
  }

  async getSnapshot(aggregateId: string): Promise<{
    version: number;
    state: Record<string, unknown>;
    createdAt: string;
  } | null> {
    return redisService.getJSON(`snapshot:${aggregateId}`);
  }
}

export const eventStoreService = new EventStoreService();
export default eventStoreService;
