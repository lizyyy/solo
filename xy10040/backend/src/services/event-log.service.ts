import { db, DatabaseClient } from '../database/client';
import { EventLogEntry, EventType, RequestContext } from '../types';
import { logger } from '../utils/logger';

export class EventLogService {
  async append(
    aggregateType: 'event' | 'registration',
    aggregateId: string,
    eventType: EventType,
    payload: Record<string, unknown>,
    context: RequestContext,
    client?: DatabaseClient
  ): Promise<EventLogEntry> {
    const metadata = {
      userAgent: context.userAgent,
    };

    const query = `
      INSERT INTO event_log (
        aggregate_type, aggregate_id, event_type, event_version,
        payload, metadata, user_id, request_id, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const params = [
      aggregateType,
      aggregateId,
      eventType,
      1,
      JSON.stringify(payload),
      JSON.stringify(metadata),
      context.userId,
      context.requestId,
      context.ipAddress,
    ];

    const result = client
      ? await client.query(query, params)
      : await db.query(query, params);

    const row = result.rows[0];
    return this.mapRowToEntry(row);
  }

  async getByAggregate(
    aggregateType: 'event' | 'registration',
    aggregateId: string,
    fromTime?: Date
  ): Promise<EventLogEntry[]> {
    let query = `
      SELECT * FROM event_log
      WHERE aggregate_type = $1 AND aggregate_id = $2
    `;
    const params: unknown[] = [aggregateType, aggregateId];

    if (fromTime) {
      query += ' AND timestamp >= $3';
      params.push(fromTime);
    }

    query += ' ORDER BY timestamp ASC';

    const result = await db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntry(row));
  }

  async getByRequestId(requestId: string): Promise<EventLogEntry[]> {
    const result = await db.query(
      `SELECT * FROM event_log WHERE request_id = $1 ORDER BY timestamp ASC`,
      [requestId]
    );
    return result.rows.map((row) => this.mapRowToEntry(row));
  }

  async getByUser(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<EventLogEntry[]> {
    const result = await db.query(
      `SELECT * FROM event_log 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows.map((row) => this.mapRowToEntry(row));
  }

  async query(
    options: {
      aggregateType?: 'event' | 'registration';
      eventType?: EventType;
      userId?: string;
      fromTime?: Date;
      toTime?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: EventLogEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.aggregateType) {
      conditions.push(`aggregate_type = $${paramIndex++}`);
      params.push(options.aggregateType);
    }

    if (options.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(options.eventType);
    }

    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }

    if (options.fromTime) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(options.fromTime);
    }

    if (options.toTime) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(options.toTime);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM event_log ${whereClause}`,
      params
    );

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM event_log ${whereClause} ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      entries: result.rows.map((row) => this.mapRowToEntry(row)),
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  async replay(
    aggregateType: 'event' | 'registration',
    aggregateId: string,
    toTime?: Date
  ): Promise<EventLogEntry[]> {
    let query = `
      SELECT * FROM event_log
      WHERE aggregate_type = $1 AND aggregate_id = $2
    `;
    const params: unknown[] = [aggregateType, aggregateId];

    if (toTime) {
      query += ' AND timestamp <= $3';
      params.push(toTime);
    }

    query += ' ORDER BY timestamp ASC';

    logger.info('Replaying events', { aggregateType, aggregateId, toTime });

    const result = await db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntry(row));
  }

  private mapRowToEntry(row: Record<string, unknown>): EventLogEntry {
    return {
      id: BigInt(row.id as string),
      aggregateType: row.aggregate_type as 'event' | 'registration',
      aggregateId: row.aggregate_id as string,
      eventType: row.event_type as EventType,
      eventVersion: row.event_version as number,
      payload: row.payload as Record<string, unknown>,
      metadata: row.metadata as Record<string, unknown>,
      timestamp: row.timestamp as Date,
      userId: row.user_id as string | undefined,
      requestId: row.request_id as string | undefined,
      ipAddress: row.ip_address as string | undefined,
    };
  }
}

export const eventLogService = new EventLogService();
