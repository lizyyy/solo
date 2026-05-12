import { v4 as uuidv4 } from 'uuid';
import { db, DatabaseClient } from '../database/client';
import {
  Registration,
  CreateRegistrationDto,
  UpdateRegistrationDto,
  RequestContext,
  EventType,
  PaginatedResult,
} from '../types';
import { eventService } from './event.service';
import { eventLogService } from './event-log.service';
import { lockService } from './lock.service';
import { asyncTaskService } from './async-task.service';
import { cacheService } from './cache.service';
import { compensationService } from './compensation.service';
import {
  ConcurrencyError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import { logger } from '../utils/logger';

export class RegistrationService {
  async create(
    dto: CreateRegistrationDto,
    context: RequestContext
  ): Promise<Registration> {
    const event = await eventService.findById(dto.eventId);
    if (!event) {
      throw new NotFoundError(`Event not found: ${dto.eventId}`);
    }

    if (event.status !== 'active') {
      throw new ValidationError('Event is not active for registration');
    }

    if (event.currentParticipants >= event.maxParticipants) {
      throw new ConflictError('Event is full');
    }

    const lockKey = `registration:${dto.eventId}:${dto.userId}`;
    let createdRegistrationId: string | null = null;

    return lockService.executeWithLock(
      lockKey,
      async () => {
        const result = await db.transaction(
          async (client) => {
            const existing = await client.query(
              `SELECT * FROM registrations WHERE event_id = $1 AND user_id = $2`,
              [dto.eventId, dto.userId]
            );

            if (existing.rows.length > 0) {
              const currentStatus = existing.rows[0].status;
              if (currentStatus === 'cancelled') {
                return this.reactivateRegistration(
                  existing.rows[0],
                  context,
                  client
                );
              }
              throw new ConflictError('User already registered for this event');
            }

            await eventService.incrementCurrentParticipants(dto.eventId, client);

            const registrationId = uuidv4();
            createdRegistrationId = registrationId;

            const insertResult = await client.query(
              `INSERT INTO registrations (
                id, event_id, user_id, user_name, user_email,
                user_phone, status, notes, version
              ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, 1)
              RETURNING *`,
              [
                registrationId,
                dto.eventId,
                dto.userId,
                dto.userName,
                dto.userEmail,
                dto.userPhone || null,
                dto.notes || null,
              ]
            );

            await eventLogService.append(
              'registration',
              registrationId,
              EventType.REGISTRATION_CREATED,
              {
                eventId: dto.eventId,
                userId: dto.userId,
                userName: dto.userName,
                userEmail: dto.userEmail,
              },
              context,
              client
            );

            return insertResult.rows[0];
          },
          'SERIALIZABLE'
        );

        const registration = this.mapRowToRegistration(result);

        logger.info('Registration created', {
          eventId: dto.eventId,
          userId: dto.userId,
          registrationId: registration.id,
        });

        cacheService.invalidateRegistrations(dto.eventId);
        cacheService.invalidateEvent(dto.eventId);
        logger.debug('Cache invalidated for event', { eventId: dto.eventId });

        await asyncTaskService.enqueue('SEND_NOTIFICATION', {
          to: dto.userEmail,
          type: 'REGISTRATION_CONFIRMATION',
          eventId: dto.eventId,
          registrationId: registration.id,
        });

        await asyncTaskService.enqueue('SYNC_CACHE', {
          eventId: dto.eventId,
          registrationId: registration.id,
        });

        logger.info('Async tasks enqueued for registration', {
          registrationId: registration.id,
        });

        return registration;
      },
      30000
    ).catch(async (error) => {
      if (createdRegistrationId) {
        logger.warn('Registration creation failed, attempting compensation', {
          registrationId: createdRegistrationId,
          error: error.message,
        });
        try {
          await compensationService.compensateRegistration(
            createdRegistrationId,
            dto.eventId,
            context
          );
        } catch (compensationError) {
          logger.error('Compensation failed', {
            registrationId: createdRegistrationId,
            error: (compensationError as Error).message,
          });
        }
      }
      throw error;
    });
  }

  private async reactivateRegistration(
    existing: Record<string, unknown>,
    context: RequestContext,
    client: DatabaseClient
  ): Promise<Record<string, unknown>> {
    const updateResult = await client.query(
      `UPDATE registrations 
       SET status = 'confirmed',
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [existing.id]
    );

    await eventLogService.append(
      'registration',
      existing.id as string,
      EventType.REGISTRATION_CONFIRMED,
      { action: 'reactivated' },
      context,
      client
    );

    return updateResult.rows[0];
  }

  async update(
    registrationId: string,
    dto: UpdateRegistrationDto,
    expectedVersion: number,
    context: RequestContext
  ): Promise<Registration> {
    const existing = await this.findById(registrationId);
    if (!existing) {
      throw new NotFoundError(`Registration not found: ${registrationId}`);
    }

    if (existing.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Registration has been modified. Expected version ${expectedVersion}, got ${existing.version}`
      );
    }

    const result = await db.transaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE registrations SET
          status = COALESCE($1, status),
          notes = COALESCE($2, notes),
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND version = $4
        RETURNING *`,
        [
          dto.status || null,
          dto.notes || null,
          registrationId,
          expectedVersion,
        ]
      );

      if (updateResult.rows.length === 0) {
        throw new ConcurrencyError('Concurrent update detected');
      }

      let eventType: EventType;
      if (dto.status === 'cancelled') {
        eventType = EventType.REGISTRATION_CANCELLED;
        await eventService.decrementCurrentParticipants(existing.eventId, client);
      } else if (dto.status === 'confirmed') {
        eventType = EventType.REGISTRATION_CONFIRMED;
      } else {
        eventType = EventType.REGISTRATION_UPDATED;
      }

      await eventLogService.append(
        'registration',
        registrationId,
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

    logger.info('Registration updated', {
      registrationId,
      userId: context.userId,
    });

    return this.mapRowToRegistration(result);
  }

  async cancel(
    registrationId: string,
    expectedVersion: number,
    context: RequestContext
  ): Promise<Registration> {
    return this.update(
      registrationId,
      { status: 'cancelled' },
      expectedVersion,
      context
    );
  }

  async findById(registrationId: string): Promise<Registration | null> {
    const result = await db.query(
      `SELECT * FROM registrations WHERE id = $1`,
      [registrationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRegistration(result.rows[0] as Record<string, unknown>);
  }

  async findByEvent(
    eventId: string,
    options: {
      status?: string;
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedResult<Registration>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['event_id = $1'];
    const params: unknown[] = [eventId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options.search) {
      conditions.push(
        `(user_name ILIKE $${paramIndex++} OR user_email ILIKE $${paramIndex++})`
      );
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM registrations WHERE ${whereClause}`,
      params
    );

    const result = await db.query(
      `SELECT * FROM registrations 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    const totalRow = countResult.rows[0] as Record<string, unknown>;
    const total = parseInt(totalRow.total as string, 10);

    return {
      items: result.rows.map((row) => this.mapRowToRegistration(row as Record<string, unknown>)),
      total,
      page,
      pageSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findByUser(
    userId: string,
    options: {
      status?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<PaginatedResult<Registration>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM registrations WHERE ${whereClause}`,
      params
    );

    const result = await db.query(
      `SELECT r.*, e.title as event_title, e.start_time as event_start_time
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    const totalRow2 = countResult.rows[0] as Record<string, unknown>;
    const total2 = parseInt(totalRow2.total as string, 10);

    return {
      items: result.rows.map((row) => this.mapRowToRegistration(row as Record<string, unknown>)),
      total: total2,
      page,
      pageSize,
      hasMore: offset + result.rows.length < total2,
    };
  }

  async checkRegistration(
    eventId: string,
    userId: string
  ): Promise<{ registered: boolean; status?: string; version?: number }> {
    const result = await db.query(
      `SELECT status, version FROM registrations 
       WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      return { registered: false };
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      registered: true,
      status: row.status as string,
      version: row.version as number,
    };
  }

  private mapRowToRegistration(row: Record<string, unknown>): Registration {
    return {
      id: row.id as string,
      eventId: row.event_id as string,
      userId: row.user_id as string,
      userName: row.user_name as string,
      userEmail: row.user_email as string,
      userPhone: (row.user_phone as string) || undefined,
      status: row.status as Registration['status'],
      notes: (row.notes as string) || undefined,
      version: row.version as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

export const registrationService = new RegistrationService();
