import { v4 as uuidv4 } from 'uuid';
import { db, DatabaseClient } from '../database/client';
import {
  Event,
  CreateEventDto,
  UpdateEventDto,
  RequestContext,
  EventType,
  PaginatedResult,
} from '../types';
import { eventLogService } from './event-log.service';
import { ConcurrencyError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export class EventService {
  async create(
    dto: CreateEventDto,
    context: RequestContext
  ): Promise<Event> {
    if (dto.startTime >= dto.endTime) {
      throw new ValidationError('Start time must be before end time');
    }

    if (dto.maxParticipants < 0) {
      throw new ValidationError('Max participants cannot be negative');
    }

    const eventId = uuidv4();
    const userId = context.userId || 'system';

    const result = await db.transaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO events (
          id, title, description, start_time, end_time,
          max_participants, current_participants, status, version, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 0, 'draft', 1, $7)
        RETURNING *`,
        [
          eventId,
          dto.title,
          dto.description || null,
          dto.startTime,
          dto.endTime,
          dto.maxParticipants,
          userId,
        ]
      );

      await eventLogService.append(
        'event',
        eventId,
        EventType.EVENT_CREATED,
        {
          title: dto.title,
          description: dto.description,
          startTime: dto.startTime,
          endTime: dto.endTime,
          maxParticipants: dto.maxParticipants,
        },
        context,
        client
      );

      return insertResult.rows[0];
    });

    logger.info('Event created', { eventId, title: dto.title, userId });
    return this.mapRowToEvent(result);
  }

  async update(
    eventId: string,
    dto: UpdateEventDto,
    expectedVersion: number,
    context: RequestContext
  ): Promise<Event> {
    const existingEvent = await this.findById(eventId);
    if (!existingEvent) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    if (existingEvent.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Event has been modified by another user. Expected version ${expectedVersion}, got ${existingEvent.version}`
      );
    }

    const timeChanged =
      (dto.startTime && dto.startTime.getTime() !== existingEvent.startTime.getTime()) ||
      (dto.endTime && dto.endTime.getTime() !== existingEvent.endTime.getTime());

    if (timeChanged) {
      const newStartTime = dto.startTime || existingEvent.startTime;
      const newEndTime = dto.endTime || existingEvent.endTime;
      if (newStartTime >= newEndTime) {
        throw new ValidationError('Start time must be before end time');
      }
    }

    if (
      dto.maxParticipants !== undefined &&
      dto.maxParticipants < existingEvent.currentParticipants
    ) {
      throw new ValidationError(
        `Cannot reduce max participants below current count (${existingEvent.currentParticipants})`
      );
    }

    const result = await db.transaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE events SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          start_time = COALESCE($3, start_time),
          end_time = COALESCE($4, end_time),
          max_participants = COALESCE($5, max_participants),
          status = COALESCE($6, status),
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7 AND version = $8
        RETURNING *`,
        [
          dto.title || null,
          dto.description || null,
          dto.startTime || null,
          dto.endTime || null,
          dto.maxParticipants ?? null,
          dto.status || null,
          eventId,
          expectedVersion,
        ]
      );

      if (updateResult.rows.length === 0) {
        throw new ConcurrencyError('Concurrent update detected');
      }

      const eventType = timeChanged
        ? EventType.EVENT_TIME_CHANGED
        : EventType.EVENT_UPDATED;

      await eventLogService.append(
        'event',
        eventId,
        eventType,
        {
          ...dto,
          previousVersion: expectedVersion,
        },
        context,
        client
      );

      return updateResult.rows[0];
    });

    logger.info('Event updated', { eventId, userId: context.userId });
    return this.mapRowToEvent(result);
  }

  async cancel(
    eventId: string,
    expectedVersion: number,
    context: RequestContext
  ): Promise<Event> {
    return this.update(
      eventId,
      { status: 'cancelled' },
      expectedVersion,
      context
    );
  }

  async findById(eventId: string): Promise<Event | null> {
    const result = await db.query(
      `SELECT * FROM events WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEvent(result.rows[0]);
  }

  async findAll(
    options: {
      status?: string;
      createdBy?: string;
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedResult<Event>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options.createdBy) {
      conditions.push(`created_by = $${paramIndex++}`);
      params.push(options.createdBy);
    }

    if (options.search) {
      conditions.push(`(title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`);
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM events WHERE ${whereClause}`,
      params
    );

    const result = await db.query(
      `SELECT * FROM events 
       WHERE ${whereClause}
       ORDER BY start_time DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      items: result.rows.map((row) => this.mapRowToEvent(row)),
      total,
      page,
      pageSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async getVersion(eventId: string): Promise<number> {
    const result = await db.query(
      `SELECT version FROM events WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    return result.rows[0].version;
  }

  async incrementCurrentParticipants(
    eventId: string,
    client: DatabaseClient
  ): Promise<void> {
    const result = await client.query(
      `UPDATE events 
       SET current_participants = current_participants + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       AND current_participants < max_participants
       RETURNING current_participants, max_participants`,
      [eventId]
    );

    if (result.rows.length === 0) {
      throw new ValidationError('Event is full or not found');
    }
  }

  async decrementCurrentParticipants(
    eventId: string,
    client: DatabaseClient
  ): Promise<void> {
    await client.query(
      `UPDATE events 
       SET current_participants = GREATEST(current_participants - 1, 0),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [eventId]
    );
  }

  private mapRowToEvent(row: Record<string, unknown>): Event {
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) || undefined,
      startTime: row.start_time as Date,
      endTime: row.end_time as Date,
      maxParticipants: row.max_participants as number,
      currentParticipants: row.current_participants as number,
      status: row.status as Event['status'],
      version: row.version as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      createdBy: row.created_by as string,
    };
  }
}

export const eventService = new EventService();
