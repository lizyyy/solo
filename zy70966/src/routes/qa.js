const express = require('express');
const db = require('../db');
const { submitAppeal, processReview, getAppealDetail, explainDifferences } = require('../services/appealService');
const { recalcQaItem, recalcAll } = require('../services/recalcEngine');
const { jsonOk, jsonErr } = require('../utils/response');

const router = express.Router();

router.post('/appeals', (req, res) => {
  try {
    const r = submitAppeal(req.body);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/reviews', (req, res) => {
  try {
    const r = processReview(req.body);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/appeals/:id', (req, res) => {
  try {
    const r = getAppealDetail(Number(req.params.id));
    if (!r) return jsonErr(res, 'not found', 404);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/qa-items/:id/explain', (req, res) => {
  try {
    const r = explainDifferences(Number(req.params.id));
    if (!r) return jsonErr(res, 'not found', 404);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/qa-items/:id/recalc', (req, res) => {
  try {
    const r = recalcQaItem(Number(req.params.id), req.body);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.post('/recalc-all', (req, res) => {
  try {
    const r = recalcAll();
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/qa-items', (req, res) => {
  try {
    const { team, agent_id, page = 1, page_size = 20 } = req.query;
    const where = [];
    const params = [];
    if (team) { where.push('team = ?'); params.push(team); }
    if (agent_id) { where.push('agent_id = ?'); params.push(agent_id); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) AS c FROM qa_items ${whereSql}`).get(...params).c;
    const rows = db.prepare(`SELECT * FROM qa_items ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(page_size), (Number(page) - 1) * Number(page_size));
    jsonOk(res, { rows, total, page: Number(page), page_size: Number(page_size) });
  } catch (e) {
    jsonErr(res, e.message);
  }
});

router.get('/qa-items/:id', (req, res) => {
  try {
    const r = db.prepare('SELECT * FROM qa_items WHERE id = ?').get(Number(req.params.id));
    if (!r) return jsonErr(res, 'not found', 404);
    r.deductions = db.prepare('SELECT * FROM deductions WHERE qa_item_id = ?').all(r.id);
    r.summary = db.prepare('SELECT * FROM call_summaries WHERE call_id = ?').get(r.call_id);
    r.appeals = db.prepare('SELECT * FROM appeals WHERE qa_item_id = ? ORDER BY created_at').all(r.id);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message);
  }
});

module.exports = router;
