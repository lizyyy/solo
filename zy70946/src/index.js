const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

const dbMod = require('./db');
const rules = require('./rules');
const apps = require('./applications');
const inspections = require('./inspections');
const rec = require('./reconcile');
const review = require('./review');
const report = require('./report');

dbMod.init();

const app = express();
app.use(express.json());
const upload = multer({ dest: '/tmp/reconcile_uploads' });

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/rules', (req, res) => {
  res.json(rules.listRules());
});

app.post('/rules', (req, res) => {
  rules.upsertRule(req.body);
  res.json({ ok: true });
});

app.post('/import/applications', upload.single('file'), (req, res) => {
  try {
    const buf = fs.readFileSync(req.file.path);
    const rows = parse(buf.toString('utf8'), { columns: true, skip_empty_lines: true });
    const mapped = rows.map((r) => ({
      apply_no: r.apply_no || r.申请编号,
      owner_name: r.owner_name || r.业主姓名,
      room_no: r.room_no || r.房号,
      deposit_amount: Number(r.deposit_amount || r.押金金额 || 0),
      start_date: r.start_date || r.开工日期 || '',
      end_date: r.end_date || r.竣工日期 || '',
      remark: r.remark || r.备注 || '',
    }));
    const count = apps.importApplications(mapped);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, imported: count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/applications', (req, res) => {
  res.json(apps.listApplications(req.query));
});

app.post('/import/inspections', upload.single('file'), (req, res) => {
  try {
    const buf = fs.readFileSync(req.file.path);
    const data = JSON.parse(buf.toString('utf8'));
    const items = Array.isArray(data) ? data : data.items || data.records || [];
    const mapped = items.map((r, i) => ({
      apply_no: r.apply_no || r.申请编号,
      seq: r.seq || r.序号 || i + 1,
      inspector: r.inspector || r.巡检员 || '',
      inspect_date: r.inspect_date || r.巡检日期 || '',
      rule_code: r.rule_code || r.违规代码,
      detail: r.detail || r.违规描述 || '',
      raw_json: JSON.stringify(r),
    }));
    const count = inspections.importInspections(mapped);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, imported: count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/inspections', (req, res) => {
  if (req.query.apply_no) {
    res.json(inspections.getInspectionsByApply(req.query.apply_no));
  } else {
    res.json(inspections.getAllInspections());
  }
});

app.post('/batches', (req, res) => {
  const id = rec.createBatch(req.body.name || `对账批次 ${new Date().toLocaleString()}`, req.body.note);
  res.json({ ok: true, batch_id: id });
});

app.get('/batches', (req, res) => {
  res.json(rec.listBatches());
});

app.post('/batches/:id/run', (req, res) => {
  try {
    const result = rec.runBatch(Number(req.params.id));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/batches/:id/records', (req, res) => {
  res.json(rec.listRecords(Number(req.params.id)));
});

app.get('/batches/:id/summary', (req, res) => {
  res.json(rec.getSummary(Number(req.params.id)));
});

app.get('/records/:id', (req, res) => {
  const r = rec.getRecord(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json({
    ...r,
    violations: JSON.parse(r.raw_violations || '[]'),
  });
});

app.put('/records/:id', (req, res) => {
  try {
    const updated = review.updateRecord(
      Number(req.params.id),
      req.body,
      req.body.operator || req.headers['x-operator']
    );
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/records/:id/logs', (req, res) => {
  res.json(review.listLogs(Number(req.params.id)));
});

app.get('/batches/:id/report', (req, res) => {
  try {
    const r = report.buildReport(Number(req.params.id));
    res.json(r);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/batches/:id/export', async (req, res) => {
  try {
    const csv = await report.exportCsv(Number(req.params.id));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconcile_${req.params.id}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/batches/:id/export-summary', async (req, res) => {
  try {
    const csv = await report.exportSummaryCsv(Number(req.params.id));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="summary_${req.params.id}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`对账服务已启动 http://localhost:${PORT}`);
});
