'use strict';

const crypto = require('crypto');
const db = require('./db');
const { uuid, now, inferParser } = require('./parsers');
const { evaluate } = require('./rules');

const hashBatch = (manifest) => {
  const sorted = [...manifest].sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
  const h = crypto.createHash('sha1');
  for (const m of sorted) h.update(m.filename || '').update(m.sha256);
  return h.digest('hex');
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const findBatchByKey = (key) =>
  db.prepare('SELECT * FROM batches WHERE batch_key = ?').get(key);

const persistBatch = ({ submittedBy, manifest, items }) => {
  const batchKey = hashBatch(manifest);
  const existing = findBatchByKey(batchKey);
  if (existing) {
    db.prepare('INSERT INTO audit_log (id, batch_id, event, at, meta) VALUES (?,?,?,?,?)')
      .run(uuid(), existing.id, 'BATCH_REPLAY_ATTEMPT', now(),
        JSON.stringify({ submitted_by: submittedBy, manifest }));
    return { existing: true, batch: existing };
  }

  const batchId = uuid();
  const submittedAt = now();
  const evaluated = items.map((it) => ({ ...it, eval: evaluate(it) }));

  const normal  = evaluated.filter((x) => x.eval.status === 'normal').length;
  const pending = evaluated.filter((x) => x.eval.status === 'pending').length;
  const failed  = evaluated.filter((x) => x.eval.status === 'failed').length;

  const summary = JSON.stringify({ total: evaluated.length, normal, pending, failed });

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO batches (id, batch_key, submitted_by, submitted_at, summary, raw_manifest)
      VALUES (?,?,?,?,?,?)
    `).run(batchId, batchKey, submittedBy || null, submittedAt, summary, JSON.stringify(manifest));

    const reportId = uuid();
    db.prepare(`
      INSERT INTO reports (id, batch_id, generated_at, total, normal, pending, failed, summary_json)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(reportId, batchId, submittedAt, evaluated.length, normal, pending, failed, summary);

    const insDetail = db.prepare(`
      INSERT INTO details (id, batch_id, kind, item_key, status, rule_code, message, suggestion, raw_fields, linked_report_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);

    const insAudit = db.prepare(`
      INSERT INTO audit_log (id, batch_id, detail_id, event, at, meta)
      VALUES (?,?,?,?,?,?)
    `);

    for (const it of evaluated) {
      const detailId = uuid();
      insDetail.run(
        detailId, batchId, it.kind, it.key, it.eval.status,
        it.eval.rule_code, it.eval.message, it.eval.suggestion,
        JSON.stringify(it.raw), reportId, submittedAt
      );
      insAudit.run(uuid(), batchId, detailId, 'DETAIL_CREATED', submittedAt,
        JSON.stringify({ rule_code: it.eval.rule_code, status: it.eval.status }));
    }

    insAudit.run(uuid(), batchId, null, 'BATCH_COMMITTED', submittedAt, summary);
    return { batchId, reportId, normal, pending, failed };
  });

  return { existing: false, ...tx() };
};

const parseFilesToItems = (files) => {
  const items = [];
  const manifest = [];
  for (const f of files) {
    const buf = f.buffer;
    manifest.push({ filename: f.filename, size: buf.length, sha256: sha256(buf) });
    const parsed = inferParser(f.filename, buf);
    for (const p of parsed) items.push(p);
  }
  return { items, manifest };
};

const getBatch = (id) => db.prepare('SELECT * FROM batches WHERE id = ?').get(id);

const getBatchReport = (id) =>
  db.prepare('SELECT * FROM reports WHERE batch_id = ? ORDER BY generated_at DESC LIMIT 1').get(id);

const getBatchDetails = (batchId, status) => {
  const sql = status
    ? 'SELECT * FROM details WHERE batch_id = ? AND status = ? ORDER BY created_at ASC, id ASC'
    : 'SELECT * FROM details WHERE batch_id = ? ORDER BY created_at ASC, id ASC';
  const stmt = db.prepare(sql);
  return status ? stmt.all(batchId, status) : stmt.all(batchId);
};

const getDetail = (id) => db.prepare('SELECT * FROM details WHERE id = ?').get(id);

const getAuditForDetail = (detailId) =>
  db.prepare('SELECT * FROM audit_log WHERE detail_id = ? OR batch_id = (SELECT batch_id FROM details WHERE id = ?) ORDER BY at ASC')
    .all(detailId, detailId);

module.exports = {
  persistBatch,
  parseFilesToItems,
  getBatch,
  getBatchReport,
  getBatchDetails,
  getDetail,
  getAuditForDetail,
  findBatchByKey,
};
