'use strict';

const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const { runReconciliation, recalcSummary } = require('../core/matcher');
const { AppError, wrap } = require('../middleware/errors');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function getStore(req) {
  return req.app.get('store');
}

function getSession(store, sessionId) {
  if (!store.sessions.has(sessionId)) {
    throw new AppError(`会话 ${sessionId} 不存在`, 404, 'SESSION_NOT_FOUND');
  }
  return store.sessions.get(sessionId);
}

router.post('/import', upload.single('purchases'), wrap(async (req, res) => {
  const store = getStore(req);
  const today = req.body.today || new Date().toISOString().slice(0, 10);
  let purchases;

  if (req.file && req.file.buffer) {
    const raw = req.file.buffer.toString('utf8');
    purchases = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  } else if (Array.isArray(req.body.purchases)) {
    purchases = req.body.purchases;
  } else {
    purchases = store.purchases;
  }

  const { results, summary } = runReconciliation(store, purchases, { today });
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.sessions.set(sessionId, { results, summary, createdAt: new Date().toISOString() });

  res.json({ sessionId, summary, recordCount: results.length });
}));

router.get('/session/:id', wrap(async (req, res) => {
  const store = getStore(req);
  const sess = getSession(store, req.params.id);
  res.json({ sessionId: req.params.id, summary: sess.summary, records: sess.results });
}));

router.get('/session/:id/records', wrap(async (req, res) => {
  const store = getStore(req);
  const sess = getSession(store, req.params.id);
  const { action, type } = req.query;
  let list = sess.results;
  if (action) list = list.filter((r) => r.finalAction === action);
  if (type) list = list.filter((r) => r.discrepancies.some((d) => d.type === type));
  res.json({ total: list.length, records: list });
}));

router.get('/session/:id/record/:recordId', wrap(async (req, res) => {
  const store = getStore(req);
  const sess = getSession(store, req.params.id);
  const record = sess.results.find((r) => r.id === req.params.recordId);
  if (!record) throw new AppError('记录不存在', 404, 'RECORD_NOT_FOUND');
  res.json(record);
}));

router.post('/session/:id/review/:recordId', wrap(async (req, res) => {
  const store = getStore(req);
  const sess = getSession(store, req.params.id);
  const record = sess.results.find((r) => r.id === req.params.recordId);
  if (!record) throw new AppError('记录不存在', 404, 'RECORD_NOT_FOUND');

  const { action, note } = req.body;
  if (!['APPROVE', 'REJECT', 'REQUEST_MORE', 'KEEP_REVIEW'].includes(action)) {
    throw new AppError('不支持的复核动作', 400, 'INVALID_ACTION');
  }

  const actionMap = {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    REQUEST_MORE: 'MORE_INFO_REQUIRED',
    KEEP_REVIEW: 'REVIEW_REQUIRED'
  };

  record.finalAction = actionMap[action];
  record.reviewed = action !== 'KEEP_REVIEW';
  record.reviewerNote = note || (record.reviewerNote || '');
  record.reviewedAt = new Date().toISOString();
  sess.summary = recalcSummary(sess.results);

  res.json({ record, summary: sess.summary });
}));

router.post('/session/:id/recalc', wrap(async (req, res) => {
  const store = getStore(req);
  const sess = getSession(store, req.params.id);
  const purchases = sess.results.map((r) => r.purchase);
  const today = req.body.today || new Date().toISOString().slice(0, 10);
  const { results, summary } = runReconciliation(store, purchases, { today });

  // 保留已经人工复核的结论
  const reviewedMap = new Map();
  for (const r of sess.results) {
    if (r.reviewed) reviewedMap.set(r.id, { finalAction: r.finalAction, reviewerNote: r.reviewerNote, reviewedAt: r.reviewedAt });
  }
  for (const r of results) {
    const saved = reviewedMap.get(r.id);
    if (saved) {
      r.finalAction = saved.finalAction;
      r.reviewed = true;
      r.reviewerNote = saved.reviewerNote;
      r.reviewedAt = saved.reviewedAt;
    }
  }

  sess.results = results;
  sess.summary = recalcSummary(results);
  res.json({ sessionId: req.params.id, summary: sess.summary, recordCount: results.length });
}));

router.get('/session/:id/report', wrap(async (req, res) => {
  const store = getStore(req);
  const sess = getSession(store, req.params.id);
  const format = req.query.format || 'json';

  if (format === 'csv') {
    const rows = sess.results.map((r) => ({
      recordId: r.id,
      orderId: r.purchase.orderId,
      customerId: r.purchase.customerId,
      customerName: r.purchase.customerName,
      medicine: r.purchase.medicine,
      purchaseDate: r.purchase.purchaseDate,
      amount: r.purchase.amount,
      finalAction: r.finalAction,
      reviewed: r.reviewed,
      reviewerNote: r.reviewerNote || '',
      discrepancyCount: r.discrepancies.length,
      discrepancyTypes: r.discrepancies.map((d) => d.type).join(';'),
      discrepancyMessages: r.discrepancies.map((d) => d.message).join(' || ')
    }));
    const csv = stringify(rows, { header: true });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="reconcile-${req.params.id}.csv"`);
    res.send('\uFEFF' + csv);
    return;
  }

  res.json({
    sessionId: req.params.id,
    generatedAt: new Date().toISOString(),
    summary: sess.summary,
    records: sess.results.map((r) => ({
      id: r.id,
      purchase: r.purchase,
      customer: r.customer
        ? { id: r.customer.id, name: r.customer.name, tags: r.customer.tags }
        : null,
      discrepancies: r.discrepancies,
      autoAction: r.autoAction,
      finalAction: r.finalAction,
      reviewed: r.reviewed,
      reviewerNote: r.reviewerNote,
      reviewedAt: r.reviewedAt
    }))
  });
}));

router.get('/sessions', wrap(async (req, res) => {
  const store = getStore(req);
  const list = [];
  for (const [id, sess] of store.sessions.entries()) {
    list.push({ id, createdAt: sess.createdAt, summary: sess.summary });
  }
  res.json({ sessions: list });
}));

module.exports = router;
