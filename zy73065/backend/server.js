const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB, ready, getDB } = require('./db');
const core = require('./replay-core');

const PORT = process.env.PORT || 3100;
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const DB_PATH = path.join(__dirname, '..', 'data', 'replay.db');

(async () => {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  await ready();
  initDB();

  app.get('/api/meta', (req, res) => {
    res.json({
      status_labels: core.STATUS_LABEL,
      anomaly_thresholds: core.ANOMALY_THRESHOLDS
    });
  });

  app.get('/api/workorders', (req, res) => {
    const list = core.listWorkordersWithDetail(req.query.status || null);
    const groups = {
      confirmed: list.filter(x => x.status === 'confirmed'),
      pending_part: list.filter(x => x.status === 'pending_part'),
      returned: list.filter(x => x.status === 'returned'),
      pending: list.filter(x => x.status === 'pending')
    };
    res.json({
      total: list.length,
      counts: {
        confirmed: groups.confirmed.length,
        pending_part: groups.pending_part.length,
        returned: groups.returned.length,
        pending: groups.pending.length
      },
      groups,
      items: list,
      pending_explain: buildPendingExplain(groups)
    });
  });

  function buildPendingExplain(groups) {
    const pending = [...groups.pending, ...groups.pending_part];
    return pending.map(wo => ({
      workorder_id: wo.id,
      blade_no: wo.blade_no,
      wind_farm: wo.wind_farm,
      current_status: wo.status_label,
      reasons: wo.pending_reason,
      replay_steps: wo.replay_trace.length,
      last_action: wo.replay_trace.length ? wo.replay_trace[wo.replay_trace.length - 1] : null
    }));
  }

  app.get('/api/workorders/:id', (req, res) => {
    const wo = getDB().prepare('SELECT * FROM workorders WHERE id=?').get(req.params.id);
    if (!wo) return res.status(404).json({ error: 'not_found' });
    res.json(core.enrichWorkorder(wo));
  });

  app.get('/api/workorders/:id/trail', (req, res) => {
    res.json(core.getReplayTrail(req.params.id));
  });

  app.get('/api/steps', (req, res) => {
    res.json(core.listAllSteps());
  });

  app.get('/api/steps/:id', (req, res) => {
    const s = core.getStepDetail(req.params.id);
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json(s);
  });

  app.post('/api/import', (req, res) => {
    try {
      const r = core.importLegacyData({
        fileName: req.body.file_name || 'legacy_data.json',
        operator: req.body.operator || '小林',
        rows: req.body.rows || []
      });
      res.json(r);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/workorders/:id/boundary', (req, res) => {
    try {
      const r = core.addBoundarySample({
        workorderId: req.params.id,
        operator: req.body.operator || '排班同事',
        sensorLog: req.body.sensor_log
      });
      res.json(r);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/parts/:id/replace', (req, res) => {
    try {
      const r = core.replacePart({
        partId: parseInt(req.params.id),
        replacementModel: req.body.replacement_model,
        operator: req.body.operator || '系统',
        sourceLine: req.body.source_line,
        impactScope: req.body.impact_scope,
        note: req.body.note
      });
      res.json(r);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/workorders/:id/status', (req, res) => {
    try {
      const newStatus = req.body.status || req.body.to;
      if (!newStatus) {
        return res.status(400).json({ error: '缺少状态字段,需传 status 或 to' });
      }
      if (!['confirmed', 'pending_part', 'returned', 'pending'].includes(newStatus)) {
        return res.status(400).json({
          error: `非法状态值: ${newStatus}`,
          allowed: ['confirmed', 'pending_part', 'returned', 'pending']
        });
      }
      const r = core.changeStatus({
        workorderId: req.params.id,
        newStatus,
        operator: req.body.operator || '小林',
        note: req.body.note,
        confirmNote: req.body.confirm_note,
        returnReason: req.body.return_reason
      });
      res.json({ ...r, received_status_field: req.body.status ? 'status' : 'to' });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/health', (req, res) => {
    const d = getDB();
    res.json({
      ok: true,
      counts: {
        workorders: d.prepare('SELECT COUNT(*) c FROM workorders').get().c,
        sensor_logs: d.prepare('SELECT COUNT(*) c FROM sensor_logs').get().c,
        spare_parts: d.prepare('SELECT COUNT(*) c FROM spare_parts').get().c,
        replay_steps: d.prepare('SELECT COUNT(*) c FROM replay_steps').get().c,
        snapshots: d.prepare('SELECT COUNT(*) c FROM replay_snapshots').get().c
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`[server] 风机叶片工单回放系统运行于 http://localhost:${PORT}`);
  });
})().catch(e => { console.error('[server] 启动失败:', e); process.exit(1); });
