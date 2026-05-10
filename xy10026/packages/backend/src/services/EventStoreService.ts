import EventModel, { EventDocument } from '../models/Event';
import { Event, EventType, LiveMessage, Operation, MessageStatus } from '@live-push/shared';
import { generateId } from '@live-push/shared';
import logger from '../utils/logger';
import cacheService from './CacheService';

class EventStoreService {
  private readonly CACHE_TTL = 86400;

  async createEvent(
    type: EventType,
    aggregateId: string,
    data: Partial<LiveMessage> | Operation | any,
    traceId: string,
    metadata?: Record<string, unknown>
  ): Promise<Event> {
    const version = await this.getNextVersion(aggregateId);

    const event: Event = {
      id: generateId(),
      type,
      aggregateId,
      data,
      version,
      timestamp: new Date(),
      traceId,
      metadata,
    };

    const eventDoc = new EventModel({
      _id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      data: event.data,
      version: event.version,
      traceId: event.traceId,
      metadata: event.metadata,
    });

    await eventDoc.save();

    await this.invalidateAggregateCache(aggregateId);

    logger.debug('Event created', {
      eventId: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      version: event.version,
      traceId,
    });

    return event;
  }

  async getNextVersion(aggregateId: string): Promise<number> {
    const latestEvent = await EventModel.findOne({ aggregateId } as any)
      .sort({ version: -1 })
      .limit(1);

    return latestEvent ? latestEvent.version + 1 : 1;
  }

  async getEventsByAggregateId(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<Event[]> {
    const cacheKey = `events:${aggregateId}:${fromVersion || 0}:${toVersion || 'latest'}`;
    
    const cached = await cacheService.get<Event[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const query: any = { aggregateId };

    if (fromVersion !== undefined) {
      query['version'] = { ...(query['version'] || {}), $gte: fromVersion };
    }

    if (toVersion !== undefined) {
      query['version'] = { ...(query['version'] || {}), $lte: toVersion };
    }

    const eventDocs = await EventModel.find(query).sort({ version: 1, timestamp: 1 });

    const events = eventDocs.map((doc) => this.toEvent(doc));

    await cacheService.set(cacheKey, events, this.CACHE_TTL);

    return events;
  }

  async getEventsByTraceId(traceId: string): Promise<Event[]> {
    const eventDocs = await EventModel.find({ traceId } as any).sort({ timestamp: 1 });
    return eventDocs.map((doc) => this.toEvent(doc));
  }

  async getEventsByType(
    type: EventType,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<Event[]> {
    const query: any = { type };

    if (startTime || endTime) {
      query['timestamp'] = {};
      if (startTime) query['timestamp'].$gte = startTime;
      if (endTime) query['timestamp'].$lte = endTime;
    }

    const eventDocs = await EventModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    return eventDocs.map((doc) => this.toEvent(doc));
  }

  async replayEvents(
    aggregateId: string,
    initialState: Partial<LiveMessage> = {},
    fromVersion?: number,
    toVersion?: number
  ): Promise<Partial<LiveMessage>> {
    const events = await this.getEventsByAggregateId(aggregateId, fromVersion, toVersion);
    
    let state = { ...initialState };

    for (const event of events) {
      state = this.applyEvent(state, event);
    }

    return state;
  }

  private applyEvent(
    state: Partial<LiveMessage>,
    event: Event
  ): Partial<LiveMessage> {
    const eventData = event.data as Partial<LiveMessage>;

    switch (event.type) {
      case EventType.MESSAGE_CREATED:
        return { ...state, ...eventData };
      
      case EventType.MESSAGE_UPDATED:
        return { ...state, ...eventData, version: event.version };
      
      case EventType.MESSAGE_DELETED:
        return { ...state, status: MessageStatus.FAILED };
      
      case EventType.MESSAGE_PUSHED:
        return { ...state, ...eventData };
      
      case EventType.MESSAGE_FAILED:
        return { ...state, ...eventData };
      
      case EventType.MESSAGE_ROLLBACKED:
        return { ...state, ...eventData };
      
      default:
        return state;
    }
  }

  async getAggregateVersion(aggregateId: string): Promise<number> {
    const latestEvent = await EventModel.findOne({ aggregateId } as any)
      .sort({ version: -1 })
      .limit(1);

    return latestEvent ? latestEvent.version : 0;
  }

  private async invalidateAggregateCache(aggregateId: string): Promise<void> {
    await cacheService.invalidatePattern(`events:${aggregateId}:*`);
  }

  private toEvent(doc: EventDocument): Event {
    return {
      id: doc._id,
      type: doc.type as EventType,
      aggregateId: doc.aggregateId,
      data: doc.data as Partial<LiveMessage> | Operation,
      version: doc.version,
      timestamp: doc.timestamp,
      traceId: doc.traceId,
      metadata: doc.metadata as Record<string, unknown> | undefined,
    };
  }
}

export default new EventStoreService();
