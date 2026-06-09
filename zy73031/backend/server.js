const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { getDatabase } = require('./config/database');
const { runDetection, ALGORITHM_VERSION, CALIBER_VERSION, CALIBER_DESC } = require('./services/anomaly-detector');

const initDatabase = require('./scripts/init-db');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const EXPORT_DIR = path.join(DATA_DIR, 'exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const API_CONTEXT = {
  algorithm_version: ALGORITHM_VERSION,
  caliber_version: CALIBER_VERSION,
  caliber_description: CALIBER_DESC,
  api_version: 'v1',
  generated_at: null
};

function withContext(data = {}) {
  return {
    ...data,
    _context: {
      ...API_CONTEXT,
      generated_at: new Date().toISOString()
    }
  };
}

app.get('/api/health', (req, res) => {
  res.json(withContext({ status: 'ok', service: 'pet-training-alert' }));
});

app.get('/api/anomaly/summary', async (req, res) => {
  const db = await getDatabase();
  const { start_date, end_date } = req.query;

  let dateFilter = '';
  const params = [];
  if (start_date) { dateFilter += ' AND aa.detected_at >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND aa.detected_at <= ?'; params.push(end_date + ' 23:59:59'); }

  const byType = db.prepare(`
    SELECT anomaly_type, anomaly_level, COUNT(*) as count
    FROM anomaly_alerts aa
    WHERE 1=1 ${dateFilter}
    GROUP BY anomaly_type, anomaly_level
    ORDER BY count DESC
  `).all(...params);

  const byLevel = db.prepare(`
    SELECT anomaly_level, COUNT(*) as count
    FROM anomaly_alerts aa
    WHERE 1=1 ${dateFilter}
    GROUP BY anomaly_level
  `).all(...params);

  const byDate = db.prepare(`
    SELECT DATE(detected_at) as dt, anomaly_level, COUNT(*) as count
    FROM anomaly_alerts aa
    WHERE 1=1 ${dateFilter}
    GROUP BY DATE(detected_at), anomaly_level
    ORDER BY dt DESC
  `).all(...params);

  const reviewStatus = db.prepare(`
    SELECT
      COALESCE(rr.review_status, 'pending') as status,
      COUNT(*) as count
    FROM anomaly_alerts aa
    LEFT JOIN review_records rr ON rr.anomaly_alert_id = aa.id
      AND rr.id = (SELECT MAX(id) FROM review_records WHERE anomaly_alert_id = aa.id)
    WHERE 1=1 ${dateFilter}
    GROUP BY COALESCE(rr.review_status, 'pending')
  `).all(...params);

  const total = db.prepare(`SELECT COUNT(*) as c FROM anomaly_alerts WHERE 1=1 ${dateFilter}`).get(...params).c;

  res.json(withContext({
    total,
    by_type: byType,
    by_level: byLevel,
    by_date: byDate,
    review_status: reviewStatus,
    date_range: { start_date: start_date || null, end_date: end_date || null }
  }));
});

app.get('/api/anomaly/list', async (req, res) => {
  const db = await getDatabase();
  const { anomaly_type, anomaly_level, review_status, start_date, end_date, page = 1, page_size = 20 } = req.query;

  const where = [];
  const params = [];
  if (anomaly_type) { where.push('aa.anomaly_type = ?'); params.push(anomaly_type); }
  if (anomaly_level) { where.push('aa.anomaly_level = ?'); params.push(anomaly_level); }
  if (start_date) { where.push('DATE(aa.detected_at) >= ?'); params.push(start_date); }
  if (end_date) { where.push('DATE(aa.detected_at) <= ?'); params.push(end_date); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  let reviewWhere = '';
  const reviewParams = [];
  if (review_status) {
    if (review_status === 'pending') {
      reviewWhere = ' AND rr.review_status IS NULL';
    } else {
      reviewWhere = ' AND rr.review_status = ?';
      reviewParams.push(review_status);
    }
  }

  const p = parseInt(page);
  const ps = parseInt(page_size);
  const offset = (p - 1) * ps;

  const countSQL = `
    SELECT COUNT(*) as c FROM anomaly_alerts aa
    LEFT JOIN review_records rr ON rr.id = (SELECT MAX(id) FROM review_records WHERE anomaly_alert_id = aa.id)
    ${whereSQL} ${reviewWhere}
  `;
  const total = db.prepare(countSQL).get(...params, ...reviewParams).c;

  const rowsSQL = `
    SELECT aa.*,
      rr.review_status, rr.reviewer, rr.review_note, rr.reviewed_at,
      CASE aa.source_type
        WHEN 'medical_record' THEN mr.record_no
        WHEN 'training_course' THEN tc.course_no
      END as source_no,
      CASE aa.source_type
        WHEN 'medical_record' THEN mr.pet_name
        WHEN 'training_course' THEN mr2.pet_name
      END as pet_name,
      CASE aa.source_type
        WHEN 'medical_record' THEN mr.visit_date
        WHEN 'training_course' THEN tc.course_date
      END as event_date
    FROM anomaly_alerts aa
    LEFT JOIN review_records rr ON rr.id = (SELECT MAX(id) FROM review_records WHERE anomaly_alert_id = aa.id)
    LEFT JOIN medical_records mr ON aa.source_type = 'medical_record' AND aa.source_id = mr.id
    LEFT JOIN training_courses tc ON aa.source_type = 'training_course' AND aa.source_id = tc.id
    LEFT JOIN medical_records mr2 ON tc.medical_record_id = mr2.id
    ${whereSQL} ${reviewWhere}
    ORDER BY aa.detected_at DESC, aa.id DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(rowsSQL).all(...params, ...reviewParams, ps, offset);

  res.json(withContext({
    total,
    page: p,
    page_size: ps,
    total_pages: Math.ceil(total / ps),
    items: rows
  }));
});

app.get('/api/anomaly/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id);
  const alert = db.prepare(`SELECT * FROM anomaly_alerts WHERE id = ?`).get(id);
  if (!alert) return res.status(404).json(withContext({ error: 'not found' }));

  let sourceData = null;
  if (alert.source_type === 'medical_record') {
    sourceData = db.prepare(`SELECT * FROM medical_records WHERE id = ?`).get(alert.source_id);
    if (sourceData) {
      sourceData.related_courses = db.prepare(`
        SELECT * FROM training_courses WHERE medical_record_id = ? ORDER BY course_date DESC
      `).all(sourceData.id);
      sourceData.public_notes = db.prepare(`
        SELECT * FROM public_notes WHERE medical_record_id = ? ORDER BY created_at DESC
      `).all(sourceData.id);
    }
  } else if (alert.source_type === 'training_course') {
    sourceData = db.prepare(`SELECT * FROM training_courses WHERE id = ?`).get(alert.source_id);
    if (sourceData) {
      sourceData.medical_record = sourceData.medical_record_id
        ? db.prepare(`SELECT * FROM medical_records WHERE id = ?`).get(sourceData.medical_record_id)
        : null;
    }
  }

  const reviewHistory = db.prepare(`
    SELECT * FROM review_records WHERE anomaly_alert_id = ? ORDER BY created_at DESC
  `).all(id);

  const is_anomaly_record = true;

  res.json(withContext({
    alert,
    source_data: sourceData,
    review_history: reviewHistory,
    is_anomaly_record,
    notice: '本记录为异常提醒关联材料，非普通训练/病历记录，复核前请勿作为统计依据'
  }));
});

app.post('/api/anomaly/:id/review', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id);
  const { review_status, reviewer, review_note, supplementary_material } = req.body;

  if (!['confirmed', 'supplement_needed', 'rejected'].includes(review_status)) {
    return res.status(400).json(withContext({ error: 'invalid review_status, must be confirmed/supplement_needed/rejected' }));
  }

  const alert = db.prepare(`SELECT id FROM anomaly_alerts WHERE id = ?`).get(id);
  if (!alert) return res.status(404).json(withContext({ error: 'not found' }));

  const info = db.prepare(`
    INSERT INTO review_records
      (anomaly_alert_id, review_status, reviewer, review_note, supplementary_material, reviewed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(id, review_status, reviewer || '前台小温', review_note || null, supplementary_material || null);

  const newReview = db.prepare(`SELECT * FROM review_records WHERE id = ?`).get(info.lastInsertRowid);
  res.json(withContext({ review: newReview, message: '复核记录已保存' }));
});

app.get('/api/anomaly/:id/material-link', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id);
  const alert = db.prepare(`SELECT * FROM anomaly_alerts WHERE id = ?`).get(id);
  if (!alert) return res.status(404).json(withContext({ error: 'not found' }));

  const links = [{ type: 'alert', id: alert.id, no: alert.alert_no, label: '异常提醒单', url: `/anomaly/${alert.id}` }];

  if (alert.source_type === 'medical_record') {
    const mr = db.prepare(`SELECT id, record_no, pet_name FROM medical_records WHERE id = ?`).get(alert.source_id);
    if (mr) {
      links.push({ type: 'medical_record', id: mr.id, no: mr.record_no, label: `病历单 - ${mr.pet_name}`, url: `/medical-record/${mr.id}` });
      const courses = db.prepare(`SELECT id, course_no, course_name, course_date FROM training_courses WHERE medical_record_id = ?`).all(mr.id);
      for (const c of courses) links.push({ type: 'training_course', id: c.id, no: c.course_no, label: `训练课 - ${c.course_name}`, url: `/training-course/${c.id}`, date: c.course_date });
    }
  } else if (alert.source_type === 'training_course') {
    const tc = db.prepare(`SELECT id, course_no, course_name, medical_record_id FROM training_courses WHERE id = ?`).get(alert.source_id);
    if (tc) {
      links.push({ type: 'training_course', id: tc.id, no: tc.course_no, label: `训练课 - ${tc.course_name}`, url: `/training-course/${tc.id}` });
      if (tc.medical_record_id) {
        const mr = db.prepare(`SELECT id, record_no, pet_name FROM medical_records WHERE id = ?`).get(tc.medical_record_id);
        if (mr) links.push({ type: 'medical_record', id: mr.id, no: mr.record_no, label: `关联病历 - ${mr.pet_name}`, url: `/medical-record/${mr.id}` });
      }
    }
  }

  res.json(withContext({ alert_no: alert.alert_no, material_links: links }));
});

app.post('/api/medical-record/:id/public-note', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id);
  const { note_content, created_by } = req.body;
  if (!note_content) return res.status(400).json(withContext({ error: 'note_content required' }));

  const mr = db.prepare(`SELECT id FROM medical_records WHERE id = ?`).get(id);
  if (!mr) return res.status(404).json(withContext({ error: 'not found' }));

  const info = db.prepare(`
    INSERT INTO public_notes (medical_record_id, note_content, note_type, created_by)
    VALUES (?, ?, 'community_disclosure', ?)
  `).run(id, note_content, created_by || '前台小温(临时补充)');

  const note = db.prepare(`SELECT * FROM public_notes WHERE id = ?`).get(info.lastInsertRowid);
  res.json(withContext({ note, message: '公示备注已补充' }));
});

app.post('/api/algorithm/rerun', async (req, res) => {
  const result = await runDetection(true);
  res.json(withContext({
    message: '算法重跑完成',
    result: {
      count: result.count,
      algorithm_version: result.algorithm_version,
      caliber_version: result.caliber_version
    }
  }));
});

app.get('/api/export/anomalies', async (req, res) => {
  const db = await getDatabase();
  const { review_status, anomaly_type, format = 'xlsx' } = req.query;

  const where = [];
  const params = [];
  if (anomaly_type) { where.push('aa.anomaly_type = ?'); params.push(anomaly_type); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  let reviewWhere = '';
  const reviewParams = [];
  if (review_status) {
    if (review_status === 'pending') reviewWhere = ' AND rr.review_status IS NULL';
    else { reviewWhere = ' AND rr.review_status = ?'; reviewParams.push(review_status); }
  }

  const rows = db.prepare(`
    SELECT aa.*,
      rr.review_status, rr.reviewer, rr.review_note, rr.supplementary_material, rr.reviewed_at,
      CASE aa.source_type WHEN 'medical_record' THEN mr.record_no WHEN 'training_course' THEN tc.course_no END as source_no,
      CASE aa.source_type WHEN 'medical_record' THEN mr.pet_name WHEN 'training_course' THEN mr2.pet_name END as pet_name,
      CASE aa.source_type WHEN 'medical_record' THEN mr.visit_date WHEN 'training_course' THEN tc.course_date END as event_date,
      CASE aa.source_type WHEN 'medical_record' THEN mr.handwritten_note WHEN 'training_course' THEN tc.handwritten_note END as source_handwritten_note
    FROM anomaly_alerts aa
    LEFT JOIN review_records rr ON rr.id = (SELECT MAX(id) FROM review_records WHERE anomaly_alert_id = aa.id)
    LEFT JOIN medical_records mr ON aa.source_type = 'medical_record' AND aa.source_id = mr.id
    LEFT JOIN training_courses tc ON aa.source_type = 'training_course' AND aa.source_id = tc.id
    LEFT JOIN medical_records mr2 ON tc.medical_record_id = mr2.id
    ${whereSQL} ${reviewWhere}
    ORDER BY aa.detected_at DESC
  `).all(...params, ...reviewParams);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '宠物训练课异常提醒系统';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('异常提醒导出');
  ws.columns = [
    { header: '异常提醒编号', key: 'alert_no', width: 20 },
    { header: '异常类型', key: 'anomaly_type', width: 20 },
    { header: '异常级别', key: 'anomaly_level', width: 10 },
    { header: '关联宠物', key: 'pet_name', width: 12 },
    { header: '材料来源', key: 'source_type_cn', width: 14 },
    { header: '来源单号', key: 'source_no', width: 18 },
    { header: '事件日期', key: 'event_date', width: 12 },
    { header: '异常字段', key: 'anomaly_field', width: 14 },
    { header: '原始值', key: 'original_value', width: 22 },
    { header: '归一化值', key: 'normalized_value', width: 16 },
    { header: '异常描述', key: 'description', width: 50 },
    { header: '影响判断', key: 'judgment_change', width: 50 },
    { header: '复核状态', key: 'review_status_cn', width: 12 },
    { header: '复核人', key: 'reviewer', width: 12 },
    { header: '复核备注', key: 'review_note', width: 30 },
    { header: '补件材料', key: 'supplementary_material', width: 30 },
    { header: '复核时间', key: 'reviewed_at', width: 20 },
    { header: '检测时间', key: 'detected_at', width: 20 },
    { header: '算法版本', key: 'algorithm_version', width: 12 },
    { header: '口径版本', key: '口径版本', width: 14 },
    { header: '特殊标记', key: 'special_flag', width: 24 }
  ];

  const typeMap = { weight_unit_missing: '体重单位缺失', weight_unit_mixed: '体重单位混写', weight_unit_mismatch: '体重单位量级不匹配', conclusion_empty: '回访结论空值', conclusion_ambiguous: '回访结论歧义', link_orphan_course: '训练课关联断裂' };
  const levelMap = { danger: '高', warning: '中', info: '低' };
  const reviewMap = { confirmed: '已确认', supplement_needed: '待补件', rejected: '退回' };
  const sourceMap = { medical_record: '病历手写单', training_course: '训练课记录' };

  for (const r of rows) {
    ws.addRow({
      alert_no: r.alert_no,
      anomaly_type: typeMap[r.anomaly_type] || r.anomaly_type,
      anomaly_level: levelMap[r.anomaly_level] || r.anomaly_level,
      pet_name: r.pet_name || '-',
      source_type_cn: sourceMap[r.source_type] || r.source_type,
      source_no: r.source_no || '-',
      event_date: r.event_date || '-',
      anomaly_field: r.anomaly_field || '-',
      original_value: r.original_value || '-',
      normalized_value: r.normalized_value || '-',
      description: r.description,
      judgment_change: r.judgment_change || '-',
      review_status_cn: r.review_status ? (reviewMap[r.review_status] || r.review_status) : '待复核',
      reviewer: r.reviewer || '-',
      review_note: r.review_note || '-',
      supplementary_material: r.supplementary_material || '-',
      reviewed_at: r.reviewed_at || '-',
      detected_at: r.detected_at,
      algorithm_version: r.algorithm_version,
      '口径版本': r['口径版本'] || CALIBER_VERSION,
      special_flag: '⚠ 非普通记录 - 异常提醒导出数据'
    });
  }

  ws.addRow([]);
  ws.addRow({ alert_no: '口径说明', description: CALIBER_DESC });
  ws.addRow({ alert_no: '导出时间', description: new Date().toLocaleString('zh-CN') });

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  rows.forEach((r, i) => {
    const rowIdx = i + 2;
    if (r.anomaly_level === 'danger') ws.getRow(rowIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
    else if (r.anomaly_level === 'warning') ws.getRow(rowIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E0' } };
    if (!r.review_status) ws.getCell(`Q${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F0FF' } };
  });

  const fileName = `异常提醒导出_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now()}.xlsx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  await workbook.xlsx.writeFile(filePath);

  res.download(filePath, fileName);
});

app.get('/api/medical-record/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id);
  const mr = db.prepare(`SELECT * FROM medical_records WHERE id = ?`).get(id);
  if (!mr) return res.status(404).json(withContext({ error: 'not found' }));

  mr.related_courses = db.prepare(`SELECT * FROM training_courses WHERE medical_record_id = ? ORDER BY course_date DESC`).all(id);
  mr.public_notes = db.prepare(`SELECT * FROM public_notes WHERE medical_record_id = ? ORDER BY created_at DESC`).all(id);
  mr.linked_alerts = db.prepare(`SELECT * FROM anomaly_alerts WHERE source_type = 'medical_record' AND source_id = ? ORDER BY detected_at DESC`).all(id);
  mr.is_anomaly_linked = mr.linked_alerts.length > 0;

  res.json(withContext({ medical_record: mr }));
});

app.get('/api/training-course/:id', async (req, res) => {
  const db = await getDatabase();
  const id = parseInt(req.params.id);
  const tc = db.prepare(`SELECT * FROM training_courses WHERE id = ?`).get(id);
  if (!tc) return res.status(404).json(withContext({ error: 'not found' }));

  tc.medical_record = tc.medical_record_id ? db.prepare(`SELECT * FROM medical_records WHERE id = ?`).get(tc.medical_record_id) : null;
  tc.linked_alerts = db.prepare(`SELECT * FROM anomaly_alerts WHERE source_type = 'training_course' AND source_id = ? ORDER BY detected_at DESC`).all(id);
  tc.is_anomaly_linked = tc.linked_alerts.length > 0;

  res.json(withContext({ training_course: tc }));
});

app.get('/api/review/monthly-summary', async (req, res) => {
  const db = await getDatabase();
  const { month } = req.query;
  const where = month ? 'WHERE DATE(rr.created_at) LIKE ?' : '';
  const params = month ? [`${month}%`] : [];

  const rows = db.prepare(`
    SELECT
      rr.review_status,
      COUNT(*) as count,
      GROUP_CONCAT(aa.alert_no, '|') as alert_nos
    FROM review_records rr
    JOIN anomaly_alerts aa ON rr.anomaly_alert_id = aa.id
    ${where}
    AND rr.id = (SELECT MAX(id) FROM review_records WHERE anomaly_alert_id = aa.id)
    GROUP BY rr.review_status
  `).all(...params);

  const pendingSQL = `
    SELECT COUNT(*) as c, GROUP_CONCAT(alert_no, '|') as alert_nos
    FROM anomaly_alerts aa
    WHERE NOT EXISTS (SELECT 1 FROM review_records WHERE anomaly_alert_id = aa.id)
    ${month ? 'AND DATE(aa.detected_at) LIKE ?' : ''}
  `;
  const pending = db.prepare(pendingSQL).get(...(month ? [`${month}%`] : []));

  const result = {
    confirmed: { count: 0, alert_nos: [] },
    supplement_needed: { count: 0, alert_nos: [] },
    rejected: { count: 0, alert_nos: [] },
    pending: { count: pending?.c || 0, alert_nos: pending?.alert_nos ? String(pending.alert_nos).split('|') : [] }
  };

  for (const r of rows) {
    result[r.review_status] = {
      count: r.count,
      alert_nos: r.alert_nos ? String(r.alert_nos).split('|') : []
    };
  }

  res.json(withContext({
    month: month || '全部',
    summary: {
      '已确认': result.confirmed,
      '待补件': result.supplement_needed,
      '退回': result.rejected,
      '待复核': result.pending
    },
    total: result.confirmed.count + result.supplement_needed.count + result.rejected.count + result.pending.count
  }));
});

app.use('/exports', express.static(EXPORT_DIR));

async function initAndStart() {
  const dbFile = path.join(DATA_DIR, 'pet_hospital.db');
  const dbExists = fs.existsSync(dbFile);
  await initDatabase();
  if (!dbExists) {
    console.log('数据库文件不存在，执行初始化和种子数据导入...');
    await require('./scripts/seed-data');
  } else {
    console.log('数据库已存在，跳过初始化');
    await getDatabase();
  }

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  宠物训练课异常提醒系统 - 后端服务');
    console.log('========================================');
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  健康检查: http://localhost:${PORT}/api/health`);
    console.log(`  算法版本: ${ALGORITHM_VERSION}`);
    console.log(`  口径版本: ${CALIBER_VERSION}`);
    console.log('========================================');
    console.log('  主要接口:');
    console.log('  GET  /api/anomaly/summary        - 异常汇总图表数据');
    console.log('  GET  /api/anomaly/list           - 异常列表');
    console.log('  GET  /api/anomaly/:id            - 异常详情(含材料追溯)');
    console.log('  GET  /api/anomaly/:id/material-link - 关联材料链');
    console.log('  POST /api/anomaly/:id/review     - 提交复核');
    console.log('  GET  /api/export/anomalies       - 导出异常(含非普通标记)');
    console.log('  POST /api/medical-record/:id/public-note - 补公示备注');
    console.log('  POST /api/algorithm/rerun        - 算法重跑入口');
    console.log('  GET  /api/review/monthly-summary - 月底复核分类');
    console.log('========================================');
  });
}

initAndStart();
