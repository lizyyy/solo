import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Parser } from 'json2csv';
import { runQuery, getOne, getAll } from './database';
import {
  EventStatus,
  CallbackMethod,
  Ticket,
  SLARule,
  CallbackTarget,
  TimeoutEvent,
  RetryBatch,
  ResponseSummary,
  CreateEventRequest,
  ManualRetryRequest,
  QueryParams
} from './types';

export async function createTicket(ticketData: Partial<Ticket>): Promise<Ticket> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id,
    ticketId: ticketData.ticketId || `TICKET-${Date.now()}`,
    title: ticketData.title || '未命名工单',
    content: ticketData.content || '',
    status: ticketData.status || 'open',
    priority: ticketData.priority || 'normal',
    assignee: ticketData.assignee,
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };

  await runQuery(`
    INSERT INTO tickets (id, ticketId, title, content, status, priority, assignee, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [ticket.id, ticket.ticketId, ticket.title, ticket.content, ticket.status, ticket.priority, ticket.assignee, now, now]);

  return ticket;
}

export async function getTicket(id: string): Promise<Ticket | undefined> {
  const row = await getOne('SELECT * FROM tickets WHERE id = ?', [id]);
  if (row) {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
  return undefined;
}

export async function getTicketByTicketId(ticketId: string): Promise<Ticket | undefined> {
  const row = await getOne('SELECT * FROM tickets WHERE ticketId = ?', [ticketId]);
  if (row) {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
  return undefined;
}

export async function getSLARules(): Promise<SLARule[]> {
  const rows = await getAll('SELECT * FROM sla_rules ORDER BY createdAt DESC');
  return rows.map(row => ({
    ...row,
    isActive: !!row.isActive,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  }));
}

export async function getCallbackTargets(): Promise<CallbackTarget[]> {
  const rows = await getAll('SELECT * FROM callback_targets ORDER BY createdAt DESC');
  return rows.map(row => ({
    ...row,
    isActive: !!row.isActive,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
    method: row.method as CallbackMethod,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  }));
}

export async function createTimeoutEvent(request: CreateEventRequest): Promise<TimeoutEvent> {
  const existingEvent = await getOne('SELECT id, status FROM timeout_events WHERE eventKey = ?', [request.eventKey]);
  if (existingEvent) {
    throw new Error(`Event with key ${request.eventKey} already exists, status: ${existingEvent.status}`);
  }

  let ticket = await getTicketByTicketId(request.ticketId);
  if (!ticket && request.ticketData) {
    ticket = await createTicket({
      ...request.ticketData,
      ticketId: request.ticketId
    });
  }

  const slaRule = await getOne('SELECT maxRetries FROM sla_rules WHERE id = ?', [request.slaRuleId]);
  const maxRetries = slaRule?.maxRetries ?? 3;

  const id = uuidv4();
  const now = new Date().toISOString();
  const event: TimeoutEvent = {
    id,
    eventKey: request.eventKey,
    ticketId: request.ticketId,
    slaRuleId: request.slaRuleId,
    status: EventStatus.PENDING,
    triggeredAt: new Date(now),
    retryCount: 0,
    maxRetries,
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };

  await runQuery(`
    INSERT INTO timeout_events (id, eventKey, ticketId, slaRuleId, status, triggeredAt, retryCount, maxRetries, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [event.id, event.eventKey, event.ticketId, event.slaRuleId, event.status, now, event.retryCount, event.maxRetries, now, now]);

  processEvent(event.id);

  return event;
}

export async function getTimeoutEvents(params: QueryParams = {}): Promise<{ events: TimeoutEvent[], total: number }> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;

  let whereClauses: string[] = [];
  let queryParams: any[] = [];

  if (params.status) {
    whereClauses.push('status = ?');
    queryParams.push(params.status);
  }
  if (params.ticketId) {
    whereClauses.push('ticketId = ?');
    queryParams.push(params.ticketId);
  }
  if (params.startTime) {
    whereClauses.push('triggeredAt >= ?');
    queryParams.push(params.startTime);
  }
  if (params.endTime) {
    whereClauses.push('triggeredAt <= ?');
    queryParams.push(params.endTime);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countResult = await getOne<{ count: number }>(`SELECT COUNT(*) as count FROM timeout_events ${whereSql}`, queryParams);
  const total = countResult?.count || 0;

  const rows = await getAll(`SELECT * FROM timeout_events ${whereSql} ORDER BY triggeredAt DESC LIMIT ? OFFSET ?`, [...queryParams, pageSize, offset]);

  const events = rows.map(row => ({
    ...row,
    nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt) : undefined,
    triggeredAt: new Date(row.triggeredAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  }));

  return { events, total };
}

export async function getTimeoutEvent(id: string): Promise<TimeoutEvent | undefined> {
  const row = await getOne('SELECT * FROM timeout_events WHERE id = ?', [id]);
  if (row) {
    return {
      ...row,
      nextRetryAt: row.nextRetryAt ? new Date(row.nextRetryAt) : undefined,
      triggeredAt: new Date(row.triggeredAt),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
  return undefined;
}

export async function processEvent(eventId: string): Promise<boolean> {
  const event = await getTimeoutEvent(eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  if (event.status === EventStatus.SUCCESS) {
    return true;
  }

  await updateEventStatus(eventId, EventStatus.PROCESSING);

  const targets = await getCallbackTargets();
  const activeTargets = targets.filter(t => t.isActive);

  if (activeTargets.length === 0) {
    await updateEventStatus(eventId, EventStatus.FAILED);
    return false;
  }

  let allSuccess = true;
  let hasSuccess = false;

  for (const target of activeTargets) {
    const success = await deliverToTarget(event, target);
    if (success) {
      hasSuccess = true;
    } else {
      allSuccess = false;
    }
  }

  if (hasSuccess) {
    await updateEventStatus(eventId, EventStatus.SUCCESS);
    return true;
  } else {
    await handleDeliveryFailure(event, activeTargets[0]);
    return false;
  }
}

async function deliverToTarget(event: TimeoutEvent, target: CallbackTarget): Promise<boolean> {
  const startTime = Date.now();
  const requestedAt = new Date().toISOString();

  try {
    const payload = {
      eventId: event.id,
      eventKey: event.eventKey,
      ticketId: event.ticketId,
      slaRuleId: event.slaRuleId,
      triggeredAt: event.triggeredAt.toISOString()
    };

    const response = await axios({
      method: target.method.toLowerCase(),
      url: target.url,
      headers: target.headers || {},
      data: payload,
      timeout: target.timeoutMs,
      validateStatus: () => true
    });

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const isSuccess = response.status >= 200 && response.status < 300;

    await createResponseSummary({
      eventId: event.id,
      targetId: target.id,
      status: isSuccess ? EventStatus.SUCCESS : EventStatus.FAILED,
      statusCode: response.status,
      responseBody: JSON.stringify(response.data),
      durationMs,
      requestedAt: new Date(requestedAt),
      respondedAt: new Date()
    });

    return isSuccess;
  } catch (error: any) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    await createResponseSummary({
      eventId: event.id,
      targetId: target.id,
      status: EventStatus.FAILED,
      errorMessage: error.message,
      durationMs,
      requestedAt: new Date(requestedAt),
      respondedAt: new Date()
    });

    return false;
  }
}

async function handleDeliveryFailure(event: TimeoutEvent, target: CallbackTarget): Promise<void> {
  const newRetryCount = event.retryCount + 1;

  if (newRetryCount < event.maxRetries) {
    const nextRetryAt = new Date(Date.now() + target.retryIntervalMs);
    await runQuery(`
      UPDATE timeout_events 
      SET status = ?, retryCount = ?, nextRetryAt = ?, updatedAt = ?
      WHERE id = ?
    `, [EventStatus.RETRYING, newRetryCount, nextRetryAt.toISOString(), new Date().toISOString(), event.id]);
  } else {
    await updateEventStatus(event.id, EventStatus.FAILED);
  }
}

async function updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await runQuery('UPDATE timeout_events SET status = ?, updatedAt = ? WHERE id = ?', [status, new Date().toISOString(), eventId]);
}

async function createResponseSummary(summary: Omit<ResponseSummary, 'id'>): Promise<ResponseSummary> {
  const id = uuidv4();
  const summaryWithId: ResponseSummary = {
    ...summary,
    id
  };

  await runQuery(`
    INSERT INTO response_summaries (id, eventId, targetId, status, statusCode, responseBody, errorMessage, durationMs, requestedAt, respondedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    summaryWithId.id,
    summaryWithId.eventId,
    summaryWithId.targetId,
    summaryWithId.status,
    summaryWithId.statusCode,
    summaryWithId.responseBody,
    summaryWithId.errorMessage,
    summaryWithId.durationMs,
    summaryWithId.requestedAt.toISOString(),
    summaryWithId.respondedAt.toISOString()
  ]);

  return summaryWithId;
}

export async function getResponseSummaries(eventId: string): Promise<ResponseSummary[]> {
  const rows = await getAll('SELECT * FROM response_summaries WHERE eventId = ? ORDER BY requestedAt DESC', [eventId]);
  return rows.map(row => ({
    ...row,
    requestedAt: new Date(row.requestedAt),
    respondedAt: new Date(row.respondedAt)
  }));
}

export async function createManualRetry(request: ManualRetryRequest): Promise<RetryBatch> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const batch: RetryBatch = {
    id,
    eventIds: request.eventIds,
    triggeredBy: request.triggeredBy,
    reason: request.reason,
    status: EventStatus.PENDING,
    successCount: 0,
    failedCount: 0,
    createdAt: new Date(now)
  };

  await runQuery(`
    INSERT INTO retry_batches (id, eventIds, triggeredBy, reason, status, successCount, failedCount, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [batch.id, JSON.stringify(batch.eventIds), batch.triggeredBy, batch.reason, batch.status, 0, 0, now]);

  processRetryBatch(batch.id);

  return batch;
}

async function processRetryBatch(batchId: string): Promise<void> {
  const batchRow = await getOne('SELECT * FROM retry_batches WHERE id = ?', [batchId]);
  if (!batchRow) return;

  const eventIds: string[] = JSON.parse(batchRow.eventIds);

  await runQuery('UPDATE retry_batches SET status = ?, startedAt = ? WHERE id = ?', 
    [EventStatus.PROCESSING, new Date().toISOString(), batchId]);

  let successCount = 0;
  let failedCount = 0;

  for (const eventId of eventIds) {
    try {
      const success = await processEvent(eventId);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  const finalStatus = failedCount > 0 ? EventStatus.FAILED : EventStatus.SUCCESS;
  await runQuery('UPDATE retry_batches SET status = ?, completedAt = ?, successCount = ?, failedCount = ? WHERE id = ?', 
    [finalStatus, new Date().toISOString(), successCount, failedCount, batchId]);
}

let retryScannerInterval: NodeJS.Timeout | null = null;
const SCAN_INTERVAL_MS = 10000;

export async function scanAndRetryEvents(): Promise<void> {
  const now = new Date().toISOString();
  const events = await getAll<any>(`
    SELECT * FROM timeout_events 
    WHERE status IN (?, ?) 
    AND nextRetryAt IS NOT NULL 
    AND nextRetryAt <= ?
  `, [EventStatus.RETRYING, EventStatus.PENDING, now]);

  for (const event of events) {
    try {
      await processEvent(event.id);
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
    }
  }
}

export function startRetryScanner(): void {
  if (retryScannerInterval) {
    return;
  }
  console.log(`Starting retry scanner (interval: ${SCAN_INTERVAL_MS}ms)`);
  retryScannerInterval = setInterval(() => {
    scanAndRetryEvents().catch(error => {
      console.error('Retry scanner error:', error);
    });
  }, SCAN_INTERVAL_MS);
}

export function stopRetryScanner(): void {
  if (retryScannerInterval) {
    clearInterval(retryScannerInterval);
    retryScannerInterval = null;
    console.log('Retry scanner stopped');
  }
}

export async function getRetryBatches(): Promise<RetryBatch[]> {
  const rows = await getAll('SELECT * FROM retry_batches ORDER BY createdAt DESC');
  return rows.map(row => ({
    ...row,
    eventIds: JSON.parse(row.eventIds),
    startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
    completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
    createdAt: new Date(row.createdAt)
  }));
}

export async function getStatistics(): Promise<any> {
  const totalEvents = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM timeout_events');
  const successEvents = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM timeout_events WHERE status = ?', [EventStatus.SUCCESS]);
  const failedEvents = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM timeout_events WHERE status = ?', [EventStatus.FAILED]);
  const pendingEvents = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM timeout_events WHERE status IN (?, ?)', [EventStatus.PENDING, EventStatus.RETRYING]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEvents = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM timeout_events WHERE triggeredAt >= ?', [today.toISOString()]);

  return {
    total: totalEvents?.count || 0,
    success: successEvents?.count || 0,
    failed: failedEvents?.count || 0,
    pending: pendingEvents?.count || 0,
    today: todayEvents?.count || 0
  };
}

export async function exportEvents(params: QueryParams = {}): Promise<string> {
  const { events } = await getTimeoutEvents({ ...params, pageSize: 10000 });

  const fields = ['id', 'eventKey', 'ticketId', 'slaRuleId', 'status', 'triggeredAt', 'retryCount', 'maxRetries', 'createdAt'];
  const parser = new Parser({ fields });
  const csv = parser.parse(events.map(e => ({
    ...e,
    triggeredAt: e.triggeredAt.toISOString(),
    createdAt: e.createdAt.toISOString()
  })));

  return csv;
}
