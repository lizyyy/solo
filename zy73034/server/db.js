import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  EMPTY_PROFILE,
  buildExportRows,
  computeDiffsBetween,
  computeSnapshotDiffs,
  derivePets,
  normalizeProfile,
} from './tracker.js';
import { demoEvents } from './sampleData.js';

const DEFAULT_DB_PATH = resolve('data/pet-training-tracker.sqlite');
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'aliases',
  'species',
  'breed',
  'vaccineStatus',
  'trainingProgress',
  'trainingJudge',
  'latestNote',
  'photoUrls',
]);

function json(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToEvent(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type,
    timestamp: row.timestamp,
    operator: row.operator,
    source: row.source,
    note: row.note,
    snapshotBefore: normalizeProfile(parseJson(row.snapshot_before, EMPTY_PROFILE)),
    snapshotAfter: normalizeProfile(parseJson(row.snapshot_after, EMPTY_PROFILE)),
    oldJudge: row.old_judge || undefined,
    newJudge: row.new_judge || undefined,
    rejudgeReason: row.rejudge_reason || undefined,
  };
}

function normalizeEvent(event) {
  return {
    id: event.id || randomUUID(),
    petId: event.petId,
    type: event.type,
    timestamp: event.timestamp || Date.now(),
    operator: event.operator || 'system',
    source: event.source || 'manual',
    note: event.note || '',
    snapshotBefore: normalizeProfile(event.snapshotBefore),
    snapshotAfter: normalizeProfile(event.snapshotAfter),
    oldJudge: event.oldJudge || null,
    newJudge: event.newJudge || null,
    rejudgeReason: event.rejudgeReason || null,
  };
}

function checksum(value) {
  return createHash('sha256').update(json(value)).digest('hex').slice(0, 16);
}

export function createStore(dbPath = process.env.PET_TRACKER_DB || DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      operator TEXT NOT NULL,
      source TEXT,
      note TEXT,
      snapshot_before TEXT NOT NULL,
      snapshot_after TEXT NOT NULL,
      old_judge TEXT,
      new_judge TEXT,
      rejudge_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_pet_time ON events (pet_id, timestamp);

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      generated_at INTEGER NOT NULL,
      filters_json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      rows_json TEXT NOT NULL,
      diff_summary_json TEXT NOT NULL
    );
  `);

  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO events (
      id, pet_id, type, timestamp, operator, source, note,
      snapshot_before, snapshot_after, old_judge, new_judge, rejudge_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function allEvents() {
    return db.prepare('SELECT * FROM events ORDER BY timestamp, id').all().map(rowToEvent);
  }

  function eventsForPet(petId) {
    return db.prepare('SELECT * FROM events WHERE pet_id = ? ORDER BY timestamp, id').all(petId).map(rowToEvent);
  }

  function currentProfile(petId) {
    const row = db.prepare('SELECT * FROM events WHERE pet_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1').get(petId);
    return row ? rowToEvent(row).snapshotAfter : normalizeProfile(EMPTY_PROFILE);
  }

  function writeEvent(rawEvent) {
    const event = normalizeEvent(rawEvent);
    insertEvent.run(
      event.id,
      event.petId,
      event.type,
      event.timestamp,
      event.operator,
      event.source,
      event.note,
      json(event.snapshotBefore),
      json(event.snapshotAfter),
      event.oldJudge,
      event.newJudge,
      event.rejudgeReason,
    );
    return event;
  }

  function recordChange(rawEvent) {
    const beforePets = derivePets(allEvents());
    const event = writeEvent(rawEvent);
    const afterPets = derivePets(allEvents());
    return {
      event: { ...event, changedFields: computeSnapshotDiffs(event) },
      exportImpact: {
        changedFields: computeDiffsBetween(beforePets, afterPets, event),
      },
    };
  }

  function seed() {
    db.exec('DELETE FROM exports; DELETE FROM events;');
    for (const event of demoEvents()) writeEvent(event);
    return summary();
  }

  function resetIfEmpty() {
    const count = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
    if (!count) seed();
  }

  function summary() {
    const events = allEvents();
    const pets = derivePets(events);
    return {
      pets: pets.length,
      events: events.length,
      anomalyRows: pets.filter((pet) => pet.anomalies.length > 0).length,
      manualRejudges: events.filter((event) => event.type === 'rejudge').length,
    };
  }

  function createImport({ petId, profile, operator, source = 'vaccine_photo', note }) {
    const id = petId || `pet_${randomUUID().slice(0, 8)}`;
    const before = currentProfile(id);
    const after = normalizeProfile({ ...before, ...profile, revoked: false });
    return recordChange({
      petId: id,
      type: 'import',
      operator,
      source,
      note,
      snapshotBefore: before,
      snapshotAfter: after,
    });
  }

  function confirm(petId, { operator, note }) {
    const before = currentProfile(petId);
    return recordChange({
      petId,
      type: 'confirm',
      operator,
      source: 'manual',
      note: note || '人工确认档案信息',
      snapshotBefore: before,
      snapshotAfter: { ...before, confirmed: true },
    });
  }

  function revoke(petId, { operator, note }) {
    const before = currentProfile(petId);
    return recordChange({
      petId,
      type: 'revoke',
      operator,
      source: 'manual',
      note: note || '撤回当前判断，保留旧版本历史',
      snapshotBefore: before,
      snapshotAfter: { ...before, revoked: true, confirmed: false },
    });
  }

  function addendum(petId, { operator, note, updates = {} }) {
    const before = currentProfile(petId);
    const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key)));
    const after = normalizeProfile({ ...before, ...cleanUpdates });
    return recordChange({
      petId,
      type: 'addendum',
      operator,
      source: 'owner_supplement',
      note: note || '主人临时补录备注',
      snapshotBefore: before,
      snapshotAfter: after,
    });
  }

  function rejudge(petId, { operator, newJudge, reason, note }) {
    const before = currentProfile(petId);
    const after = normalizeProfile({ ...before, trainingJudge: newJudge });
    return recordChange({
      petId,
      type: 'rejudge',
      operator,
      source: 'manual',
      note: note || `人工改判：${before.trainingJudge} -> ${newJudge}`,
      oldJudge: before.trainingJudge,
      newJudge,
      rejudgeReason: reason,
      snapshotBefore: before,
      snapshotAfter: after,
    });
  }

  function listPets(filters = {}) {
    let pets = derivePets(allEvents());
    if (filters.anomaly) {
      pets = pets.filter((pet) => pet.anomalies.some((anomaly) => anomaly.type === filters.anomaly));
    }
    if (filters.q) {
      const q = String(filters.q).trim();
      pets = pets.filter((pet) => [pet.name, pet.breed, ...pet.aliases].some((value) => String(value).includes(q)));
    }
    return pets;
  }

  function exportData(filters = {}) {
    const pets = listPets(filters);
    const rows = buildExportRows(pets);
    const generatedAt = Date.now();
    const payload = {
      generatedAt,
      filters,
      rows,
      anomalyRows: pets.filter((pet) => pet.anomalies.length > 0).length,
    };
    const id = `exp_${generatedAt}_${randomUUID().slice(0, 6)}`;
    const digest = checksum(payload);
    db.prepare(`
      INSERT INTO exports (id, generated_at, filters_json, checksum, rows_json, diff_summary_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, generatedAt, json(filters), digest, json(rows), json({ anomalyRows: payload.anomalyRows }));
    return { id, checksum: digest, ...payload };
  }

  function exportCsv(filters = {}) {
    const result = exportData(filters);
    const headers = Object.keys(result.rows[0]?.values || {});
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      headers.map(quote).join(','),
      ...result.rows.map((row) => headers.map((header) => quote(row.values[header])).join(',')),
    ].join('\n');
    return { ...result, csv };
  }

  function getExport(id) {
    const row = db.prepare('SELECT * FROM exports WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      generatedAt: row.generated_at,
      filters: parseJson(row.filters_json, {}),
      checksum: row.checksum,
      rows: parseJson(row.rows_json, []),
      diffSummary: parseJson(row.diff_summary_json, {}),
    };
  }

  resetIfEmpty();

  return {
    dbPath,
    close: () => db.close(),
    seed,
    summary,
    allEvents,
    eventsForPet,
    listPets,
    exportData,
    exportCsv,
    getExport,
    createImport,
    confirm,
    revoke,
    addendum,
    rejudge,
  };
}
