/* =========================================================
   流浪动物救助回访追踪 - Node 服务入口
   Express + better-sqlite3
   ========================================================= */

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  importRecord,
  confirmRecord,
  revokeRecord,
  humanPatchRecord,
  getRecordDetail,
  listRecords,
  listAnomalies,
  getSummary,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 8765;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ---------- 静态文件（前端） ---------- */
app.use(express.static(path.join(__dirname, '.')));

/* ---------- API 路由（保持克制，围绕必需能力） ---------- */

const api = express.Router();

function jsonOk(res, data) {
  res.json({ ok: true, data });
}
function jsonErr(res, message, status = 400) {
  res.status(status).json({ ok: false, error: message });
}

api.get('/summary', (req, res) => {
  try {
    jsonOk(res, getSummary());
  } catch (e) {
    jsonErr(res, e.message, 500);
  }
});

api.get('/records', (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    jsonOk(res, listRecords(filter));
  } catch (e) {
    jsonErr(res, e.message, 500);
  }
});

api.get('/records/:id', (req, res) => {
  try {
    const r = getRecordDetail(req.params.id);
    if (!r) return jsonErr(res, '记录不存在', 404);
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message, 500);
  }
});

api.post('/records', (req, res) => {
  try {
    const result = importRecord(req.body || {});
    jsonOk(res, result);
  } catch (e) {
    jsonErr(res, e.message, 400);
  }
});

api.post('/records/:id/confirm', (req, res) => {
  try {
    const r = confirmRecord(req.params.id, req.body || {});
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message, 400);
  }
});

api.post('/records/:id/revoke', (req, res) => {
  try {
    const r = revokeRecord(req.params.id, req.body || {});
    jsonOk(res, r);
  } catch (e) {
    jsonErr(res, e.message, 400);
  }
});

api.post('/records/:id/patch', (req, res) => {
  try {
    const result = humanPatchRecord(req.params.id, req.body || {}, { reason: req.body.reason });
    jsonOk(res, result);
  } catch (e) {
    jsonErr(res, e.message, 400);
  }
});

api.get('/anomalies', (req, res) => {
  try {
    jsonOk(res, listAnomalies());
  } catch (e) {
    jsonErr(res, e.message, 500);
  }
});

app.use('/api', api);

/* ---------- 启动 ---------- */
app.listen(PORT, () => {
  console.log(`🐾 流浪动物救助回访追踪服务已启动`);
  console.log(`   页面: http://localhost:${PORT}/index.html`);
  console.log(`   API:  http://localhost:${PORT}/api/...`);
});
