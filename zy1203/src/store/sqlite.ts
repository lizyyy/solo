import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';
import {
  SimulationResult,
  TimeSeriesData,
  OutOfOrderEvent,
  DuplicateEvent,
  ConsumptionLatency,
  Message,
} from '../types';

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS time_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  time_sec INTEGER NOT NULL,
  total_lag INTEGER NOT NULL,
  topic_lags_json TEXT NOT NULL,
  consumer_count INTEGER NOT NULL,
  alive_consumer_count INTEGER NOT NULL,
  produced_count INTEGER NOT NULL,
  consumed_count INTEGER NOT NULL,
  dead_letter_count INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE TABLE IF NOT EXISTS out_of_order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  key TEXT NOT NULL,
  expected_offset INTEGER NOT NULL,
  actual_offset INTEGER NOT NULL,
  time_sec INTEGER NOT NULL,
  topic TEXT NOT NULL,
  partition INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE TABLE IF NOT EXISTS duplicate_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  idempotent_key TEXT NOT NULL,
  original_message_id TEXT NOT NULL,
  time_sec INTEGER NOT NULL,
  topic TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE TABLE IF NOT EXISTS consumption_latencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  produce_time INTEGER NOT NULL,
  consume_time INTEGER NOT NULL,
  latency INTEGER NOT NULL,
  topic TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE TABLE IF NOT EXISTS dead_letter_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  partition INTEGER NOT NULL,
  offset INTEGER NOT NULL,
  key TEXT NOT NULL,
  idempotent_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_time_series_run_id ON time_series(run_id);
CREATE INDEX IF NOT EXISTS idx_out_of_order_run_id ON out_of_order_events(run_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_run_id ON duplicate_events(run_id);
CREATE INDEX IF NOT EXISTS idx_latency_run_id ON consumption_latencies(run_id);
CREATE INDEX IF NOT EXISTS idx_dlq_run_id ON dead_letter_messages(run_id);
`;

export class SQLiteStore {
  private dbPath: string;
  private db: Database | null;

  constructor(dbPath: string) {
    this.dbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    this.db = null;
  }

  private async init(): Promise<Database> {
    if (this.db) {
      return this.db;
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(SQLITE_SCHEMA);
    this.save();

    return this.db;
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  async saveSimulationResult(result: SimulationResult): Promise<void> {
    const db = await this.init();

    db.run(`
      INSERT INTO runs (run_id, start_time, end_time, config_json, summary_json)
      VALUES (?, ?, ?, ?, ?)
    `, [
      result.runId,
      result.startTime,
      result.endTime,
      JSON.stringify(result.config),
      JSON.stringify(result.summary),
    ]);

    for (const ts of result.timeSeries) {
      db.run(`
        INSERT INTO time_series (
          run_id, time_sec, total_lag, topic_lags_json,
          consumer_count, alive_consumer_count,
          produced_count, consumed_count, dead_letter_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.runId,
        ts.time,
        ts.totalLag,
        JSON.stringify(ts.topicLags),
        ts.consumerCount,
        ts.aliveConsumerCount,
        ts.producedCount,
        ts.consumedCount,
        ts.deadLetterCount,
      ]);
    }

    for (const event of result.outOfOrderEvents) {
      db.run(`
        INSERT INTO out_of_order_events (
          run_id, message_id, key, expected_offset,
          actual_offset, time_sec, topic, partition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.runId,
        event.messageId,
        event.key,
        event.expectedOffset,
        event.actualOffset,
        event.time,
        event.topic,
        event.partition,
      ]);
    }

    for (const event of result.duplicateEvents) {
      db.run(`
        INSERT INTO duplicate_events (
          run_id, message_id, idempotent_key,
          original_message_id, time_sec, topic
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        result.runId,
        event.messageId,
        event.idempotentKey,
        event.originalMessageId,
        event.time,
        event.topic,
      ]);
    }

    for (const latency of result.consumptionLatencies) {
      db.run(`
        INSERT INTO consumption_latencies (
          run_id, message_id, produce_time,
          consume_time, latency, topic
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        result.runId,
        latency.messageId,
        latency.produceTime,
        latency.consumeTime,
        latency.latency,
        latency.topic,
      ]);
    }

    for (const msg of result.deadLetterMessages) {
      db.run(`
        INSERT INTO dead_letter_messages (
          run_id, message_id, topic, partition, offset,
          key, idempotent_key, payload_json, timestamp, attempts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.runId,
        msg.id,
        msg.topic,
        msg.partition,
        msg.offset,
        msg.key,
        msg.idempotentKey,
        JSON.stringify(msg.payload),
        msg.timestamp,
        msg.attempts,
      ]);
    }

    this.save();
  }

  async getSimulationResult(runId: string): Promise<SimulationResult | null> {
    const db = await this.init();

    const runRows = db.exec(`
      SELECT run_id, start_time, end_time, config_json, summary_json
      FROM runs WHERE run_id = ?
    `, [runId]);

    if (runRows.length === 0 || runRows[0].values.length === 0) {
      return null;
    }

    const row = runRows[0].values[0];
    const config = JSON.parse(row[3] as string);
    const summary = JSON.parse(row[4] as string);

    const timeSeries = await this.loadTimeSeries(db, runId);
    const outOfOrderEvents = await this.loadOutOfOrderEvents(db, runId);
    const duplicateEvents = await this.loadDuplicateEvents(db, runId);
    const consumptionLatencies = await this.loadConsumptionLatencies(db, runId);
    const deadLetterMessages = await this.loadDeadLetterMessages(db, runId);

    return {
      runId: row[0] as string,
      startTime: row[1] as number,
      endTime: row[2] as number,
      config,
      summary,
      timeSeries,
      outOfOrderEvents,
      duplicateEvents,
      consumptionLatencies,
      deadLetterMessages,
    };
  }

  async getLatestSimulationResult(): Promise<SimulationResult | null> {
    const db = await this.init();

    const runRows = db.exec(`
      SELECT run_id FROM runs
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (runRows.length === 0 || runRows[0].values.length === 0) {
      return null;
    }

    const runId = runRows[0].values[0][0] as string;
    return this.getSimulationResult(runId);
  }

  async getAllRunIds(): Promise<string[]> {
    const db = await this.init();

    const result = db.exec(`
      SELECT run_id FROM runs
      ORDER BY created_at DESC
    `);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => row[0] as string);
  }

  private async loadTimeSeries(db: Database, runId: string): Promise<TimeSeriesData[]> {
    const result = db.exec(`
      SELECT time_sec, total_lag, topic_lags_json,
             consumer_count, alive_consumer_count,
             produced_count, consumed_count, dead_letter_count
      FROM time_series
      WHERE run_id = ?
      ORDER BY time_sec
    `, [runId]);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      time: row[0] as number,
      totalLag: row[1] as number,
      topicLags: JSON.parse(row[2] as string),
      consumerCount: row[3] as number,
      aliveConsumerCount: row[4] as number,
      producedCount: row[5] as number,
      consumedCount: row[6] as number,
      deadLetterCount: row[7] as number,
    }));
  }

  private async loadOutOfOrderEvents(db: Database, runId: string): Promise<OutOfOrderEvent[]> {
    const result = db.exec(`
      SELECT message_id, key, expected_offset, actual_offset,
             time_sec, topic, partition
      FROM out_of_order_events
      WHERE run_id = ?
    `, [runId]);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      messageId: row[0] as string,
      key: row[1] as string,
      expectedOffset: row[2] as number,
      actualOffset: row[3] as number,
      time: row[4] as number,
      topic: row[5] as string,
      partition: row[6] as number,
    }));
  }

  private async loadDuplicateEvents(db: Database, runId: string): Promise<DuplicateEvent[]> {
    const result = db.exec(`
      SELECT message_id, idempotent_key, original_message_id,
             time_sec, topic
      FROM duplicate_events
      WHERE run_id = ?
    `, [runId]);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      messageId: row[0] as string,
      idempotentKey: row[1] as string,
      originalMessageId: row[2] as string,
      time: row[3] as number,
      topic: row[4] as string,
    }));
  }

  private async loadConsumptionLatencies(db: Database, runId: string): Promise<ConsumptionLatency[]> {
    const result = db.exec(`
      SELECT message_id, produce_time, consume_time, latency, topic
      FROM consumption_latencies
      WHERE run_id = ?
    `, [runId]);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      messageId: row[0] as string,
      produceTime: row[1] as number,
      consumeTime: row[2] as number,
      latency: row[3] as number,
      topic: row[4] as string,
    }));
  }

  private async loadDeadLetterMessages(db: Database, runId: string): Promise<Message[]> {
    const result = db.exec(`
      SELECT message_id, topic, partition, offset,
             key, idempotent_key, payload_json, timestamp, attempts
      FROM dead_letter_messages
      WHERE run_id = ?
    `, [runId]);

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => ({
      id: row[0] as string,
      topic: row[1] as string,
      partition: row[2] as number,
      offset: row[3] as number,
      key: row[4] as string,
      idempotentKey: row[5] as string,
      payload: JSON.parse(row[6] as string),
      timestamp: row[7] as number,
      produceTime: row[7] as number,
      attempts: row[8] as number,
      isDuplicate: false,
    }));
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
