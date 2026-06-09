const dayjs = require('dayjs');
const { getDB } = require('./db');

const STATUS_LABEL = {
  confirmed: '已确认',
  pending_part: '待补件',
  returned: '退回',
  pending: '待处理'
};

const ANOMALY_THRESHOLDS = {
  vibration_max: 8.5,
  vibration_min: 0.3,
  pitch_max: 32,
  pitch_min: -2,
  temp_max: 78,
  temp_min: -15
};

let _seq = 0;
function nextSeq() {
  const d = getDB();
  const row = d.prepare('SELECT COALESCE(MAX(seq_no),0) m FROM replay_steps').get();
  _seq = row.m;
  return ++_seq;
}

function uid(prefix = 'st') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function now() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

function safeJson(v, fallback = '{}') {
  try { return typeof v === 'string' ? v : JSON.stringify(v || {}); }
  catch { return fallback; }
}

function parseJson(v, fallback = {}) {
  if (!v) return fallback;
  try { return typeof v === 'string' ? JSON.parse(v) : v; }
  catch { return fallback; }
}

/* ========== 1. 步骤留痕（replay_steps + snapshot） ========== */
function recordStep({ action, operator, paramsBefore, paramsAfter, changedFields, workorderImpact, note }) {
  const d = getDB();
  const stepId = uid('step');
  const seqNo = nextSeq();
  d.prepare(`INSERT INTO replay_steps
    (id, seq_no, action, operator, params_before, params_after, changed_fields, workorder_impact, note, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    stepId, seqNo, action, operator,
    safeJson(paramsBefore), safeJson(paramsAfter),
    safeJson(changedFields, '[]'), safeJson(workorderImpact, '[]'),
    note || '', now()
  );
  snapshotAllWorkorders(stepId);
  return getStepDetail(stepId);
}

function snapshotAllWorkorders(stepId) {
  const d = getDB();
  const wos = d.prepare('SELECT * FROM workorders').all();
  const ins = d.prepare(`INSERT INTO replay_snapshots
    (step_id, workorder_id, status_snapshot, anomaly_flags, parts_summary, sensor_stats, created_at)
    VALUES (?,?,?,?,?,?,?)`);
  const t = now();
  for (const wo of wos) {
    const anomalies = detectAnomalies(wo.id);
    const parts = summarizeParts(wo.id);
    const sensor = summarizeSensor(wo.id);
    ins.run(stepId, wo.id, wo.status, safeJson(anomalies), safeJson(parts), safeJson(sensor), t);
  }
}

function getStepDetail(stepId) {
  const d = getDB();
  const step = d.prepare('SELECT * FROM replay_steps WHERE id=?').get(stepId);
  if (!step) return null;
  const snapshots = d.prepare('SELECT * FROM replay_snapshots WHERE step_id=? ORDER BY workorder_id').all(stepId);
  return {
    ...step,
    params_before: parseJson(step.params_before),
    params_after: parseJson(step.params_after),
    changed_fields: parseJson(step.changed_fields, []),
    workorder_impact: parseJson(step.workorder_impact, []),
    snapshots: snapshots.map(s => ({
      ...s,
      anomaly_flags: parseJson(s.anomaly_flags, {}),
      parts_summary: parseJson(s.parts_summary, {}),
      sensor_stats: parseJson(s.sensor_stats, {})
    }))
  };
}

/* ========== 2. 传感器统计（重点：异常值不被均值掩盖） ========== */
function summarizeSensor(workorderId) {
  const d = getDB();
  const logs = d.prepare('SELECT * FROM sensor_logs WHERE workorder_id=? ORDER BY log_time').all(workorderId);
  if (!logs.length) return { count: 0, note: '无传感器数据' };

  const keys = ['vibration', 'pitch', 'temp'];
  const result = { count: logs.length, per_field: {}, anomalies: [], boundaries: [] };

  for (const k of keys) {
    const vals = logs.map(l => l[k]).sort((a, b) => a - b);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const p50 = vals[Math.floor(vals.length / 2)];
    const p95 = vals[Math.min(vals.length - 1, Math.ceil(vals.length * 0.95))];
    const p05 = vals[Math.floor(vals.length * 0.05)];
    result.per_field[k] = {
      min: vals[0], max: vals[vals.length - 1],
      avg: round2(avg), median: round2(p50),
      p05: round2(p05), p95: round2(p95),
      stddev: round2(Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length))
    };
  }

  for (const log of logs) {
    const flags = [];
    if (log.vibration > ANOMALY_THRESHOLDS.vibration_max) flags.push(`振动超上限${log.vibration}`);
    if (log.vibration < ANOMALY_THRESHOLDS.vibration_min) flags.push(`振动超下限${log.vibration}`);
    if (log.pitch > ANOMALY_THRESHOLDS.pitch_max) flags.push(`桨距角异常${log.pitch}`);
    if (log.pitch < ANOMALY_THRESHOLDS.pitch_min) flags.push(`桨距角异常${log.pitch}`);
    if (log.temp > ANOMALY_THRESHOLDS.temp_max) flags.push(`温度过高${log.temp}`);
    if (log.temp < ANOMALY_THRESHOLDS.temp_min) flags.push(`温度过低${log.temp}`);
    if (flags.length) {
      result.anomalies.push({ time: log.log_time, line: log.raw_line_no, flags, is_boundary: !!log.is_boundary, remark: log.remark });
    }
    if (log.is_boundary) {
      result.boundaries.push({ time: log.log_time, line: log.raw_line_no, remark: log.remark, vibration: log.vibration, pitch: log.pitch, temp: log.temp });
    }
  }

  result.summary_note = buildSummaryNote(result);
  return result;
}

function buildSummaryNote(stats) {
  const parts = [];
  for (const k of Object.keys(stats.per_field)) {
    const f = stats.per_field[k];
    parts.push(`${k}=${f.avg}(均值) p95=${f.p95} 极值=[${f.min}~${f.max}]`);
  }
  if (stats.anomalies.length) {
    parts.push(`⚠异常${stats.anomalies.length}条(单独列出,未被均值掩盖)`);
  }
  if (stats.boundaries.length) {
    parts.push(`⚑边界样本${stats.boundaries.length}条`);
  }
  return parts.join(' | ');
}

function round2(v) { return Math.round(v * 100) / 100; }

/* ========== 3. 异常检测（供小林核对不被掩盖） ========== */
function detectAnomalies(workorderId) {
  const s = summarizeSensor(workorderId);
  const parts = summarizeParts(workorderId);
  const flags = {
    sensor_anomaly_count: s.anomalies.length,
    sensor_anomalies: s.anomalies.slice(0, 20),
    boundary_samples: s.boundaries,
    has_part_replacement: parts.replaced_count > 0,
    replaced_parts: parts.replaced,
    masked_risk: assessMaskedRisk(s)
  };
  flags.overall = flags.sensor_anomaly_count > 0 || flags.has_part_replacement ? 'need_review' : 'normal';
  return flags;
}

function assessMaskedRisk(stats) {
  const risks = [];
  for (const k of Object.keys(stats.per_field || {})) {
    const f = stats.per_field[k];
    if (f.max > f.p95 * 1.5) risks.push(`${k}:最大值${f.max}远高于p95(${f.p95}),需防止被均值掩盖`);
    if (f.min < f.p05 * 0.5 && f.min > 0) risks.push(`${k}:最小值${f.min}远低于p05(${f.p05}),需防止被均值掩盖`);
  }
  return risks;
}

/* ========== 4. 备件替换（来源行 + 影响范围） ========== */
function summarizeParts(workorderId) {
  const d = getDB();
  const parts = d.prepare('SELECT * FROM spare_parts WHERE workorder_id=?').all(workorderId);
  const replaced = parts.filter(p => p.status === 'replaced');
  const pending = parts.filter(p => p.status === 'pending_replace');
  return {
    total: parts.length,
    original_count: parts.filter(p => p.status === 'original').length,
    replaced_count: replaced.length,
    pending_replace_count: pending.length,
    replaced: replaced.map(p => ({
      id: p.id, original: p.original_model, replacement: p.replacement_model, qty: p.quantity,
      source_line: p.replace_source_line, impact_scope: p.replace_impact_scope, operator: p.replace_operator
    })),
    pending_replace: pending.map(p => ({ id: p.id, original: p.original_model, qty: p.quantity }))
  };
}

/* ========== 5. 导入旧材料 ========== */
function importLegacyData({ fileName, operator, rows }) {
  const d = getDB();
  const importId = uid('imp');
  const t = now();

  d.prepare(`INSERT INTO imports (id, file_name, imported_at, row_count, operator, step_id) VALUES (?,?,?,?,?,?)`)
    .run(importId, fileName, t, rows.length, operator, null);

  const workorders = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const woId = r.workorder_id || uid('wo');
    const existing = d.prepare('SELECT id FROM workorders WHERE id=?').get(woId);
    if (existing) {
      d.prepare(`UPDATE workorders SET status=?, updated_at=? WHERE id=?`).run(r.status || 'pending', t, woId);
    } else {
      d.prepare(`INSERT INTO workorders
        (id, blade_no, wind_farm, created_at, status, confirm_note, return_reason, source_import_id, created_step_id, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        woId, r.blade_no, r.wind_farm, r.created_at || t, r.status || 'pending',
        r.confirm_note || null, r.return_reason || null, importId, null, t
      );
    }
    workorders.push(woId);

    if (r.sensor_logs && r.sensor_logs.length) {
      const insLog = d.prepare(`INSERT INTO sensor_logs
        (workorder_id, log_time, vibration, pitch, temp, is_boundary, raw_line_no, source_file, remark)
        VALUES (?,?,?,?,?,?,?,?,?)`);
      for (let j = 0; j < r.sensor_logs.length; j++) {
        const lg = r.sensor_logs[j];
        insLog.run(woId, lg.log_time, lg.vibration, lg.pitch, lg.temp,
          lg.is_boundary ? 1 : 0, lg.raw_line_no || (i * 100 + j + 1), fileName, lg.remark || null);
      }
    }

    if (r.parts && r.parts.length) {
      const insPart = d.prepare(`INSERT INTO spare_parts
        (workorder_id, original_model, replacement_model, quantity, replaced_at, replace_source_line, replace_impact_scope, replace_operator, status)
        VALUES (?,?,?,?,?,?,?,?,?)`);
      for (const p of r.parts) {
        insPart.run(woId, p.original_model, p.replacement_model || null, p.quantity,
          p.replaced_at || null, p.replace_source_line || null, p.replace_impact_scope || null,
          p.replace_operator || null, p.status || 'original');
      }
    }
  }

  const step = recordStep({
    action: `导入旧材料 ${fileName}`,
    operator,
    paramsBefore: { file: fileName, existing_count: d.prepare('SELECT COUNT(*) c FROM workorders').get().c - rows.length },
    paramsAfter: { file: fileName, row_count: rows.length, import_id: importId, workorders },
    changedFields: ['import_count', 'workorder_ids'],
    workorderImpact: workorders,
    note: `从${fileName}导入${rows.length}条历史工单`
  });
  d.prepare('UPDATE imports SET step_id=? WHERE id=?').run(step.id, importId);
  return { import_id: importId, step, workorders };
}

/* ========== 6. 追加边界样本 ========== */
function addBoundarySample({ workorderId, operator, sensorLog }) {
  const d = getDB();
  const wo = d.prepare('SELECT * FROM workorders WHERE id=?').get(workorderId);
  if (!wo) throw new Error('工单不存在: ' + workorderId);

  const beforeCount = d.prepare('SELECT COUNT(*) c FROM sensor_logs WHERE workorder_id=?').get(workorderId).c;
  const beforeAnom = detectAnomalies(workorderId);

  const lineNo = d.prepare('SELECT COALESCE(MAX(raw_line_no),0) m FROM sensor_logs WHERE workorder_id=?').get(workorderId).m + 1;
  d.prepare(`INSERT INTO sensor_logs
    (workorder_id, log_time, vibration, pitch, temp, is_boundary, raw_line_no, source_file, remark)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    workorderId, sensorLog.log_time || now(), sensorLog.vibration, sensorLog.pitch, sensorLog.temp,
    1, lineNo, sensorLog.source_file || 'manual_boundary.csv', sensorLog.remark || '现场毛边-边界样本'
  );

  const afterAnom = detectAnomalies(workorderId);
  const diffFields = [];
  if (beforeAnom.sensor_anomaly_count !== afterAnom.sensor_anomaly_count) diffFields.push('sensor_anomaly_count');
  if (beforeAnom.boundary_samples.length !== afterAnom.boundary_samples.length) diffFields.push('boundary_samples');
  if (beforeAnom.overall !== afterAnom.overall) diffFields.push('overall_flag');

  const step = recordStep({
    action: `追加边界样本->${wo.blade_no}`,
    operator,
    paramsBefore: { workorder: workorderId, sensor_count_before: beforeCount, anomaly_before: beforeAnom.sensor_anomaly_count, boundary_before: beforeAnom.boundary_samples.length },
    paramsAfter: { workorder: workorderId, sensor_count_after: beforeCount + 1, anomaly_after: afterAnom.sensor_anomaly_count, boundary_after: afterAnom.boundary_samples.length, new_log: sensorLog },
    changedFields: diffFields,
    workorderImpact: [workorderId],
    note: `原始行号=${lineNo}; 说明=${sensorLog.remark || '边界样本'}; 变化字段=${diffFields.join(',') || '无'}`
  });
  return { step, line_no: lineNo, anomalies_now: afterAnom };
}

/* ========== 7. 备件型号替换（留影响范围+来源行） ========== */
function replacePart({ partId, replacementModel, operator, sourceLine, impactScope, note }) {
  const d = getDB();
  const part = d.prepare('SELECT * FROM spare_parts WHERE id=?').get(partId);
  if (!part) throw new Error('备件记录不存在');

  const before = { ...part };
  d.prepare(`UPDATE spare_parts SET replacement_model=?, status='replaced', replaced_at=?,
    replace_source_line=?, replace_impact_scope=?, replace_operator=? WHERE id=?`).run(
    replacementModel, now(), sourceLine || null, impactScope || null, operator, partId
  );
  const after = d.prepare('SELECT * FROM spare_parts WHERE id=?').get(partId);

  const diff = diffObj(before, after, ['replacement_model', 'status', 'replaced_at', 'replace_source_line', 'replace_impact_scope', 'replace_operator']);

  const step = recordStep({
    action: `备件替换 原=${part.original_model} 新=${replacementModel}`,
    operator,
    paramsBefore: { part_id: partId, original: before.original_model, before_status: before.status },
    paramsAfter: { part_id: partId, replacement: replacementModel, source_line: sourceLine, impact_scope: impactScope, note },
    changedFields: diff,
    workorderImpact: [part.workorder_id],
    note: `来源行=${sourceLine || '未指定'}; 影响范围=${impactScope || '未指定'}; ${note || ''}`
  });
  return { step, part: after };
}

function diffObj(a, b, fields) {
  return fields.filter(f => a[f] !== b[f]);
}

/* ========== 8. 工单状态流转（已确认/待补件/退回） ========== */
function changeStatus({ workorderId, newStatus, operator, note, confirmNote, returnReason }) {
  if (!STATUS_LABEL[newStatus]) throw new Error('无效状态: ' + newStatus);
  const d = getDB();
  const wo = d.prepare('SELECT * FROM workorders WHERE id=?').get(workorderId);
  if (!wo) throw new Error('工单不存在');
  const before = { status: wo.status, confirm_note: wo.confirm_note, return_reason: wo.return_reason };

  d.prepare(`UPDATE workorders SET status=?, confirm_note=?, return_reason=?, updated_at=? WHERE id=?`).run(
    newStatus, confirmNote || wo.confirm_note, returnReason || wo.return_reason, now(), workorderId
  );

  const after = d.prepare('SELECT * FROM workorders WHERE id=?').get(workorderId);
  const diff = [];
  if (before.status !== after.status) diff.push('status');
  if (before.confirm_note !== after.confirm_note) diff.push('confirm_note');
  if (before.return_reason !== after.return_reason) diff.push('return_reason');

  const partsAfter = summarizeParts(workorderId);
  if (newStatus === 'pending_part' && partsAfter.pending_replace_count === 0) {
    note = (note ? note + '; ' : '') + '提示: 置为"待补件"但当前无待补备件,请核对';
  }

  const step = recordStep({
    action: `状态流转 ${STATUS_LABEL[before.status]}→${STATUS_LABEL[newStatus]}`,
    operator,
    paramsBefore: { workorder: workorderId, before: before },
    paramsAfter: { workorder: workorderId, after: { status: after.status, confirm_note: after.confirm_note, return_reason: after.return_reason } },
    changedFields: diff,
    workorderImpact: [workorderId],
    note: note || ''
  });
  return { step, workorder: after };
}

/* ========== 9. 查询（月底复核 + 排班同事查看待处理） ========== */
function listWorkordersWithDetail(statusFilter) {
  const d = getDB();
  let sql = 'SELECT * FROM workorders ORDER BY updated_at DESC';
  const args = [];
  if (statusFilter) { sql += ' WHERE status=?'; args.push(statusFilter); }
  const rows = d.prepare(sql).all(...args);
  return rows.map(wo => enrichWorkorder(wo));
}

function enrichWorkorder(wo) {
  const d = getDB();
  const anomalies = detectAnomalies(wo.id);
  const parts = summarizeParts(wo.id);
  const sensor = summarizeSensor(wo.id);
  const steps = d.prepare(`SELECT s.* FROM replay_steps s
    INNER JOIN replay_snapshots sn ON sn.step_id=s.id
    WHERE sn.workorder_id=? ORDER BY s.seq_no`).all(wo.id);

  return {
    ...wo,
    status_label: STATUS_LABEL[wo.status],
    anomalies,
    parts,
    sensor_summary: sensor,
    pending_reason: buildPendingReason(wo, anomalies, parts),
    replay_trace: steps.map(s => ({
      seq: s.seq_no, action: s.action, operator: s.operator,
      changed_fields: parseJson(s.changed_fields, []), note: s.note, time: s.created_at
    }))
  };
}

function buildPendingReason(wo, anomalies, parts) {
  const reasons = [];
  if (wo.status === 'pending') reasons.push('未进入处理流程,请先分类');
  if (wo.status === 'pending_part') {
    if (parts.pending_replace_count) reasons.push(`待补件:${parts.pending_replace.map(x => `${x.original}x${x.qty}`).join(',')}`);
    else reasons.push('标记待补件,但无待补备件记录');
  }
  if (wo.status === 'returned') reasons.push(`退回原因:${wo.return_reason || '未填写'}`);
  if (anomalies.sensor_anomaly_count) reasons.push(`传感器异常${anomalies.sensor_anomaly_count}条需核对`);
  if (anomalies.masked_risk && anomalies.masked_risk.length) reasons.push('极值与均值差异大,请重点核对(未掩盖)');
  return reasons;
}

function getReplayTrail(workorderId) {
  const d = getDB();
  const steps = d.prepare(`SELECT s.* FROM replay_steps s
    INNER JOIN replay_snapshots sn ON sn.step_id=s.id
    WHERE sn.workorder_id=? ORDER BY s.seq_no`).all(workorderId);
  const snapshots = d.prepare('SELECT * FROM replay_snapshots WHERE workorder_id=? ORDER BY step_id').all(workorderId);
  return {
    workorder_id: workorderId,
    steps: steps.map(s => {
      const snap = snapshots.find(x => x.step_id === s.id);
      return {
        seq_no: s.seq_no,
        action: s.action,
        operator: s.operator,
        created_at: s.created_at,
        changed_fields: parseJson(s.changed_fields, []),
        note: s.note,
        impact: parseJson(s.workorder_impact, []),
        snapshot: snap ? {
          status: snap.status_snapshot,
          status_label: STATUS_LABEL[snap.status_snapshot],
          anomalies: parseJson(snap.anomaly_flags, {}),
          parts: parseJson(snap.parts_summary, {}),
          sensor: parseJson(snap.sensor_stats, {})
        } : null
      };
    })
  };
}

function listAllSteps() {
  const d = getDB();
  return d.prepare('SELECT * FROM replay_steps ORDER BY seq_no').all().map(s => ({
    ...s,
    changed_fields: parseJson(s.changed_fields, []),
    workorder_impact: parseJson(s.workorder_impact, [])
  }));
}

module.exports = {
  STATUS_LABEL, ANOMALY_THRESHOLDS,
  recordStep, getStepDetail, listAllSteps,
  summarizeSensor, detectAnomalies, summarizeParts,
  importLegacyData, addBoundarySample, replacePart, changeStatus,
  listWorkordersWithDetail, enrichWorkorder, getReplayTrail
};
