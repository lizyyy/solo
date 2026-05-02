import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  WebhookTemplate,
  WebhookDelivery,
  WebhookSimulation,
  DeadLetterQueueItem,
  IdempotencyLedgerEntry,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateSimulationInput,
  SimulationStatus,
} from '../types';

const DB_PATH = path.join(process.cwd(), 'webhook-simulator.db');

export class Storage {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        secret TEXT NOT NULL,
        default_retry_count INTEGER DEFAULT 3,
        default_delay_ms INTEGER DEFAULT 1000,
        idempotency_key_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS simulations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        template_ids TEXT NOT NULL,
        target_url TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        simulation_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        target_url TEXT NOT NULL,
        payload TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        signature TEXT NOT NULL,
        request_body_digest TEXT NOT NULL,
        status_code INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        is_success INTEGER NOT NULL DEFAULT 0,
        is_first_attempt INTEGER NOT NULL DEFAULT 0,
        strategy TEXT NOT NULL,
        delivered_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (simulation_id) REFERENCES simulations(id),
        FOREIGN KEY (template_id) REFERENCES templates(id)
      );

      CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id TEXT PRIMARY KEY,
        delivery_id TEXT NOT NULL,
        simulation_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        target_url TEXT NOT NULL,
        payload TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        signature TEXT NOT NULL,
        error_message TEXT NOT NULL,
        last_attempt_at INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        is_replayed INTEGER NOT NULL DEFAULT 0,
        replayed_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
        FOREIGN KEY (simulation_id) REFERENCES simulations(id),
        FOREIGN KEY (template_id) REFERENCES templates(id)
      );

      CREATE TABLE IF NOT EXISTS idempotency_ledger (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        first_delivery_id TEXT NOT NULL,
        first_simulation_id TEXT NOT NULL,
        first_delivered_at INTEGER NOT NULL,
        total_deliveries INTEGER NOT NULL DEFAULT 1,
        last_delivery_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (first_delivery_id) REFERENCES deliveries(id),
        FOREIGN KEY (last_delivery_id) REFERENCES deliveries(id)
      );

      CREATE INDEX IF NOT EXISTS idx_deliveries_simulation_id ON deliveries(simulation_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_idempotency_key ON deliveries(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_dead_letter_simulation_id ON dead_letter_queue(simulation_id);
      CREATE INDEX IF NOT EXISTS idx_dead_letter_is_replayed ON dead_letter_queue(is_replayed);
      CREATE INDEX IF NOT EXISTS idx_idempotency_ledger_key ON idempotency_ledger(idempotency_key);
    `);
  }

  close(): void {
    this.db.close();
  }

  createTemplate(input: CreateTemplateInput): WebhookTemplate {
    const id = uuidv4();
    const now = Date.now();
    const template: WebhookTemplate = {
      id,
      name: input.name,
      eventType: input.eventType,
      payload: input.payload,
      secret: input.secret,
      defaultRetryCount: input.defaultRetryCount ?? 3,
      defaultDelayMs: input.defaultDelayMs ?? 1000,
      idempotencyKeyPath: input.idempotencyKeyPath,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(`
        INSERT INTO templates (
          id, name, event_type, payload, secret, default_retry_count, 
          default_delay_ms, idempotency_key_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        template.id,
        template.name,
        template.eventType,
        JSON.stringify(template.payload),
        template.secret,
        template.defaultRetryCount,
        template.defaultDelayMs,
        template.idempotencyKeyPath,
        template.createdAt,
        template.updatedAt
      );

    return template;
  }

  getTemplate(id: string): WebhookTemplate | null {
    const row = this.db
      .prepare('SELECT * FROM templates WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToTemplate(row);
  }

  getAllTemplates(): WebhookTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM templates ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map(this.rowToTemplate);
  }

  updateTemplate(id: string, input: UpdateTemplateInput): WebhookTemplate | null {
    const existing = this.getTemplate(id);
    if (!existing) return null;

    const now = Date.now();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.eventType !== undefined) {
      updates.push('event_type = ?');
      values.push(input.eventType);
    }
    if (input.payload !== undefined) {
      updates.push('payload = ?');
      values.push(JSON.stringify(input.payload));
    }
    if (input.secret !== undefined) {
      updates.push('secret = ?');
      values.push(input.secret);
    }
    if (input.defaultRetryCount !== undefined) {
      updates.push('default_retry_count = ?');
      values.push(input.defaultRetryCount);
    }
    if (input.defaultDelayMs !== undefined) {
      updates.push('default_delay_ms = ?');
      values.push(input.defaultDelayMs);
    }
    if (input.idempotencyKeyPath !== undefined) {
      updates.push('idempotency_key_path = ?');
      values.push(input.idempotencyKeyPath);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);

    return this.getTemplate(id);
  }

  deleteTemplate(id: string): boolean {
    const result = this.db
      .prepare('DELETE FROM templates WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }

  createSimulation(input: CreateSimulationInput): WebhookSimulation {
    const id = uuidv4();
    const now = Date.now();
    const simulation: WebhookSimulation = {
      id,
      name: input.name,
      strategy: input.strategy,
      templateIds: input.templateIds,
      targetUrl: input.targetUrl,
      status: 'pending',
      createdAt: now,
      completedAt: null,
    };

    this.db
      .prepare(`
        INSERT INTO simulations (
          id, name, strategy, template_ids, target_url, status, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        simulation.id,
        simulation.name,
        simulation.strategy,
        JSON.stringify(simulation.templateIds),
        simulation.targetUrl,
        simulation.status,
        simulation.createdAt,
        simulation.completedAt
      );

    return simulation;
  }

  getSimulation(id: string): WebhookSimulation | null {
    const row = this.db
      .prepare('SELECT * FROM simulations WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToSimulation(row);
  }

  getAllSimulations(): WebhookSimulation[] {
    const rows = this.db
      .prepare('SELECT * FROM simulations ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map(this.rowToSimulation);
  }

  updateSimulationStatus(id: string, status: SimulationStatus, completedAt?: number): WebhookSimulation | null {
    const existing = this.getSimulation(id);
    if (!existing) return null;

    const finalCompletedAt = completedAt ?? (status === 'completed' || status === 'failed' ? Date.now() : null);
    
    this.db
      .prepare('UPDATE simulations SET status = ?, completed_at = ? WHERE id = ?')
      .run(status, finalCompletedAt, id);

    return this.getSimulation(id);
  }

  createDelivery(
    simulationId: string,
    templateId: string,
    eventType: string,
    targetUrl: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    signature: string,
    requestBodyDigest: string,
    strategy: string,
    maxRetries: number
  ): WebhookDelivery {
    const id = uuidv4();
    const now = Date.now();
    
    const isFirstAttempt = !this.hasIdempotencyKey(idempotencyKey);

    const delivery: WebhookDelivery = {
      id,
      simulationId,
      templateId,
      eventType,
      targetUrl,
      payload,
      idempotencyKey,
      signature,
      requestBodyDigest,
      statusCode: null,
      durationMs: 0,
      errorMessage: null,
      retryCount: 0,
      maxRetries,
      isSuccess: false,
      isFirstAttempt,
      strategy,
      deliveredAt: null,
      createdAt: now,
    };

    this.db
      .prepare(`
        INSERT INTO deliveries (
          id, simulation_id, template_id, event_type, target_url, payload,
          idempotency_key, signature, request_body_digest, status_code,
          duration_ms, error_message, retry_count, max_retries, is_success,
          is_first_attempt, strategy, delivered_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        delivery.id,
        delivery.simulationId,
        delivery.templateId,
        delivery.eventType,
        delivery.targetUrl,
        JSON.stringify(delivery.payload),
        delivery.idempotencyKey,
        delivery.signature,
        delivery.requestBodyDigest,
        delivery.statusCode,
        delivery.durationMs,
        delivery.errorMessage,
        delivery.retryCount,
        delivery.maxRetries,
        delivery.isSuccess ? 1 : 0,
        delivery.isFirstAttempt ? 1 : 0,
        delivery.strategy,
        delivery.deliveredAt,
        delivery.createdAt
      );

    return delivery;
  }

  updateDeliveryResult(
    id: string,
    statusCode: number | null,
    durationMs: number,
    errorMessage: string | null,
    retryCount: number,
    isSuccess: boolean
  ): WebhookDelivery | null {
    const deliveredAt = Date.now();
    
    this.db
      .prepare(`
        UPDATE deliveries SET
          status_code = ?, duration_ms = ?, error_message = ?,
          retry_count = ?, is_success = ?, delivered_at = ?
        WHERE id = ?
      `)
      .run(
        statusCode,
        durationMs,
        errorMessage,
        retryCount,
        isSuccess ? 1 : 0,
        deliveredAt,
        id
      );

    return this.getDelivery(id);
  }

  getDelivery(id: string): WebhookDelivery | null {
    const row = this.db
      .prepare('SELECT * FROM deliveries WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToDelivery(row);
  }

  getDeliveriesBySimulation(simulationId: string): WebhookDelivery[] {
    const rows = this.db
      .prepare('SELECT * FROM deliveries WHERE simulation_id = ? ORDER BY created_at ASC')
      .all(simulationId) as Record<string, unknown>[];
    return rows.map(this.rowToDelivery);
  }

  hasIdempotencyKey(idempotencyKey: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM idempotency_ledger WHERE idempotency_key = ?')
      .get(idempotencyKey);
    return !!row;
  }

  recordIdempotencyEntry(
    idempotencyKey: string,
    eventType: string,
    deliveryId: string,
    simulationId: string
  ): IdempotencyLedgerEntry {
    const existing = this.db
      .prepare('SELECT * FROM idempotency_ledger WHERE idempotency_key = ?')
      .get(idempotencyKey) as Record<string, unknown> | undefined;

    const now = Date.now();

    if (existing) {
      this.db
        .prepare(`
          UPDATE idempotency_ledger SET
            total_deliveries = total_deliveries + 1,
            last_delivery_id = ?
          WHERE idempotency_key = ?
        `)
        .run(deliveryId, idempotencyKey);

      return this.getIdempotencyEntry(idempotencyKey)!;
    }

    const id = uuidv4();
    const entry: IdempotencyLedgerEntry = {
      id,
      idempotencyKey,
      eventType,
      firstDeliveryId: deliveryId,
      firstSimulationId: simulationId,
      firstDeliveredAt: now,
      totalDeliveries: 1,
      lastDeliveryId: deliveryId,
      createdAt: now,
    };

    this.db
      .prepare(`
        INSERT INTO idempotency_ledger (
          id, idempotency_key, event_type, first_delivery_id,
          first_simulation_id, first_delivered_at, total_deliveries,
          last_delivery_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.idempotencyKey,
        entry.eventType,
        entry.firstDeliveryId,
        entry.firstSimulationId,
        entry.firstDeliveredAt,
        entry.totalDeliveries,
        entry.lastDeliveryId,
        entry.createdAt
      );

    return entry;
  }

  getIdempotencyEntry(idempotencyKey: string): IdempotencyLedgerEntry | null {
    const row = this.db
      .prepare('SELECT * FROM idempotency_ledger WHERE idempotency_key = ?')
      .get(idempotencyKey) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToIdempotencyEntry(row);
  }

  getAllIdempotencyLedger(): IdempotencyLedgerEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM idempotency_ledger ORDER BY first_delivered_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map(this.rowToIdempotencyEntry);
  }

  addToDeadLetterQueue(delivery: WebhookDelivery, errorMessage: string): DeadLetterQueueItem {
    const id = uuidv4();
    const now = Date.now();

    const item: DeadLetterQueueItem = {
      id,
      deliveryId: delivery.id,
      simulationId: delivery.simulationId,
      templateId: delivery.templateId,
      eventType: delivery.eventType,
      targetUrl: delivery.targetUrl,
      payload: delivery.payload,
      idempotencyKey: delivery.idempotencyKey,
      signature: delivery.signature,
      errorMessage,
      lastAttemptAt: now,
      retryCount: delivery.retryCount,
      isReplayed: false,
      replayedAt: null,
      createdAt: now,
    };

    this.db
      .prepare(`
        INSERT INTO dead_letter_queue (
          id, delivery_id, simulation_id, template_id, event_type, target_url,
          payload, idempotency_key, signature, error_message, last_attempt_at,
          retry_count, is_replayed, replayed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        item.id,
        item.deliveryId,
        item.simulationId,
        item.templateId,
        item.eventType,
        item.targetUrl,
        JSON.stringify(item.payload),
        item.idempotencyKey,
        item.signature,
        item.errorMessage,
        item.lastAttemptAt,
        item.retryCount,
        item.isReplayed ? 1 : 0,
        item.replayedAt,
        item.createdAt
      );

    return item;
  }

  getDeadLetterQueueItem(id: string): DeadLetterQueueItem | null {
    const row = this.db
      .prepare('SELECT * FROM dead_letter_queue WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToDeadLetterQueueItem(row);
  }

  getPendingDeadLetterItems(): DeadLetterQueueItem[] {
    const rows = this.db
      .prepare('SELECT * FROM dead_letter_queue WHERE is_replayed = 0 ORDER BY created_at ASC')
      .all() as Record<string, unknown>[];
    return rows.map(this.rowToDeadLetterQueueItem);
  }

  markDeadLetterAsReplayed(id: string): boolean {
    const result = this.db
      .prepare(`
        UPDATE dead_letter_queue 
        SET is_replayed = 1, replayed_at = ? 
        WHERE id = ?
      `)
      .run(Date.now(), id);
    return result.changes > 0;
  }

  getDeadLetterItemsBySimulation(simulationId: string): DeadLetterQueueItem[] {
    const rows = this.db
      .prepare('SELECT * FROM dead_letter_queue WHERE simulation_id = ? ORDER BY created_at ASC')
      .all(simulationId) as Record<string, unknown>[];
    return rows.map(this.rowToDeadLetterQueueItem);
  }

  private rowToTemplate(row: Record<string, unknown>): WebhookTemplate {
    return {
      id: row.id as string,
      name: row.name as string,
      eventType: row.event_type as string,
      payload: JSON.parse(row.payload as string),
      secret: row.secret as string,
      defaultRetryCount: row.default_retry_count as number,
      defaultDelayMs: row.default_delay_ms as number,
      idempotencyKeyPath: row.idempotency_key_path as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  private rowToSimulation(row: Record<string, unknown>): WebhookSimulation {
    return {
      id: row.id as string,
      name: row.name as string,
      strategy: row.strategy as WebhookSimulation['strategy'],
      templateIds: JSON.parse(row.template_ids as string),
      targetUrl: row.target_url as string,
      status: row.status as WebhookSimulation['status'],
      createdAt: row.created_at as number,
      completedAt: row.completed_at as number | null,
    };
  }

  private rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
    return {
      id: row.id as string,
      simulationId: row.simulation_id as string,
      templateId: row.template_id as string,
      eventType: row.event_type as string,
      targetUrl: row.target_url as string,
      payload: JSON.parse(row.payload as string),
      idempotencyKey: row.idempotency_key as string,
      signature: row.signature as string,
      requestBodyDigest: row.request_body_digest as string,
      statusCode: row.status_code as number | null,
      durationMs: row.duration_ms as number,
      errorMessage: row.error_message as string | null,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      isSuccess: (row.is_success as number) === 1,
      isFirstAttempt: (row.is_first_attempt as number) === 1,
      strategy: row.strategy as string,
      deliveredAt: row.delivered_at as number | null,
      createdAt: row.created_at as number,
    };
  }

  private rowToIdempotencyEntry(row: Record<string, unknown>): IdempotencyLedgerEntry {
    return {
      id: row.id as string,
      idempotencyKey: row.idempotency_key as string,
      eventType: row.event_type as string,
      firstDeliveryId: row.first_delivery_id as string,
      firstSimulationId: row.first_simulation_id as string,
      firstDeliveredAt: row.first_delivered_at as number,
      totalDeliveries: row.total_deliveries as number,
      lastDeliveryId: row.last_delivery_id as string | null,
      createdAt: row.created_at as number,
    };
  }

  private rowToDeadLetterQueueItem(row: Record<string, unknown>): DeadLetterQueueItem {
    return {
      id: row.id as string,
      deliveryId: row.delivery_id as string,
      simulationId: row.simulation_id as string,
      templateId: row.template_id as string,
      eventType: row.event_type as string,
      targetUrl: row.target_url as string,
      payload: JSON.parse(row.payload as string),
      idempotencyKey: row.idempotency_key as string,
      signature: row.signature as string,
      errorMessage: row.error_message as string,
      lastAttemptAt: row.last_attempt_at as number,
      retryCount: row.retry_count as number,
      isReplayed: (row.is_replayed as number) === 1,
      replayedAt: row.replayed_at as number | null,
      createdAt: row.created_at as number,
    };
  }
}

export const storage = new Storage();
