'use strict';

const fastify = require('fastify')({ logger: true });
const db = require('./db');
const {
  persistBatch, parseFilesToItems,
  getBatch, getBatchReport, getBatchDetails,
  getDetail, getAuditForDetail,
} = require('./service');

fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});

fastify.get('/', async () => ({
  service: 'exhibit-import-api',
  version: '0.1.0',
  endpoints: [
    'POST /batches',
    'GET  /batches/:id',
    'GET  /batches/:id/details?status=',
    'GET  /batches/:id/report',
    'GET  /details/:id',
  ],
}));

const collectFiles = async (req) => {
  const files = [];
  for await (const part of req.parts()) {
    if (!part.file) continue;
    const chunks = [];
    for await (const chunk of part.file) chunks.push(chunk);
    files.push({ filename: part.filename, buffer: Buffer.concat(chunks) });
  }
  return files;
};

fastify.post('/batches', async (req, reply) => {
  const submittedBy = (req.query && req.query.submitted_by) ||
                     (req.headers['x-submitted-by']);

  let files;
  try {
    files = await collectFiles(req);
  } catch (e) {
    return reply.code(400).send({ error: 'MULTIPART_PARSE_FAILED', message: e.message });
  }
  if (!files.length) {
    return reply.code(400).send({ error: 'NO_FILES', message: '请至少上传 1 个文件' });
  }

  let parsed;
  try {
    parsed = parseFilesToItems(files);
  } catch (e) {
    return reply.code(400).send({ error: 'PARSE_FAILED', message: e.message });
  }

  let result;
  try {
    result = persistBatch({
      submittedBy,
      manifest: parsed.manifest,
      items: parsed.items,
    });
  } catch (e) {
    return reply.code(500).send({ error: 'PERSIST_FAILED', message: e.message });
  }

  if (result.existing) {
    return reply.code(200).send({
      duplicate: true,
      message: '该批材料已提交过，未重复生效',
      batch_id: result.batch.id,
      submitted_at: result.batch.submitted_at,
      summary: JSON.parse(result.batch.summary),
    });
  }

  const details = getBatchDetails(result.batchId);
  return reply.code(201).send({
    duplicate: false,
    batch_id: result.batchId,
    report_id: result.reportId,
    summary: {
      total: result.normal + result.pending + result.failed,
      normal: result.normal,
      pending: result.pending,
      failed: result.failed,
    },
    items: details.map((d) => ({
      id: d.id,
      kind: d.kind,
      item_key: d.item_key,
      status: d.status,
      rule_code: d.rule_code,
      message: d.message,
      suggestion: d.suggestion,
      raw_fields: JSON.parse(d.raw_fields),
    })),
  });
});

fastify.get('/batches/:id', async (req, reply) => {
  const b = getBatch(req.params.id);
  if (!b) return reply.code(404).send({ error: 'NOT_FOUND' });
  return {
    id: b.id,
    batch_key: b.batch_key,
    submitted_by: b.submitted_by,
    submitted_at: b.submitted_at,
    summary: JSON.parse(b.summary),
    manifest: JSON.parse(b.raw_manifest),
  };
});

fastify.get('/batches/:id/details', async (req, reply) => {
  const b = getBatch(req.params.id);
  if (!b) return reply.code(404).send({ error: 'NOT_FOUND' });
  const list = getBatchDetails(b.id, req.query.status);
  return list.map((d) => ({
    id: d.id,
    kind: d.kind,
    item_key: d.item_key,
    status: d.status,
    rule_code: d.rule_code,
    message: d.message,
    suggestion: d.suggestion,
    raw_fields: JSON.parse(d.raw_fields),
    linked_report_id: d.linked_report_id,
  }));
});

fastify.get('/batches/:id/report', async (req, reply) => {
  const b = getBatch(req.params.id);
  if (!b) return reply.code(404).send({ error: 'NOT_FOUND' });
  const rep = getBatchReport(b.id);
  const all = getBatchDetails(b.id);
  return {
    report: rep ? {
      id: rep.id,
      generated_at: rep.generated_at,
      summary: JSON.parse(rep.summary_json),
    } : null,
    groups: {
      normal:  all.filter((d) => d.status === 'normal').length,
      pending: all.filter((d) => d.status === 'pending').length,
      failed:  all.filter((d) => d.status === 'failed').length,
    },
    details: all.map((d) => ({
      id: d.id,
      kind: d.kind,
      item_key: d.item_key,
      status: d.status,
      rule_code: d.rule_code,
      message: d.message,
      suggestion: d.suggestion,
      raw_fields: JSON.parse(d.raw_fields),
    })),
  };
});

fastify.get('/details/:id', async (req, reply) => {
  const d = getDetail(req.params.id);
  if (!d) return reply.code(404).send({ error: 'NOT_FOUND' });
  const audit = getAuditForDetail(d.id);
  const report = d.linked_report_id
    ? dbGetReport(d.linked_report_id)
    : null;
  return {
    id: d.id,
    batch_id: d.batch_id,
    kind: d.kind,
    item_key: d.item_key,
    status: d.status,
    rule_code: d.rule_code,
    message: d.message,
    suggestion: d.suggestion,
    raw_fields: JSON.parse(d.raw_fields),
    linked_report: report ? {
      id: report.id,
      generated_at: report.generated_at,
      summary: JSON.parse(report.summary_json),
    } : null,
    audit_trail: audit.map((a) => ({
      id: a.id,
      event: a.event,
      at: a.at,
      meta: a.meta ? JSON.parse(a.meta) : null,
    })),
  };
});

let _getReportStmt;
function dbGetReport(id) {
  if (!_getReportStmt) _getReportStmt = db.prepare('SELECT * FROM reports WHERE id = ?');
  return _getReportStmt.get(id);
}

const port = Number(process.env.PORT) || 3000;
const start = async () => {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`exhibit-import-api listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) start();

module.exports = fastify;
