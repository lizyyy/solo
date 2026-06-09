const express = require('express');
const cors = require('cors');
const path = require('path');
const { load, tx, now, insert, findAll, findOne, update } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const STATUS_MAP = {
  draft: '草稿',
  pending: '待审核',
  suspended: '已挂起',
  approved: '已核准',
  rejected: '已驳回'
};

const MATERIAL_TYPE_MAP = {
  handwritten: '病历手写单',
  mismatch: '标题明细对不上',
  verbal: '口头说明',
  supplement: '补充材料'
};

const ANOMALY_TYPE_MAP = {
  dosage_changed: '用药剂量变更',
  material_mismatch: '材料标题与明细冲突',
  info_conflict: '新旧信息冲突',
  late_supplement: '收尾时冒出补充信息'
};

function genCaseNo() {
  const db = load();
  const d = new Date();
  const s = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const count = db.reports.filter(r => r.case_no.startsWith(s)).length;
  return `${s}-${String(count + 1).padStart(3, '0')}`;
}

function addHistory(db, reportId, action, extra = {}) {
  insert(db, 'histories', {
    report_id: reportId,
    action,
    operator: extra.operator || '寄养店长老周',
    old_value: extra.old_value || null,
    new_value: extra.new_value || null,
    reason: extra.reason || null,
    remark: extra.remark || null
  });
}

function touchReport(db, id) {
  update(db, 'reports', r => r.id === id, { updated_at: now() });
}

function detectDosageChange(db, reportId, materialId) {
  const byDrug = {};
  for (const m of db.medications.filter(m => m.report_id === reportId)) {
    if (!byDrug[m.drug_name]) byDrug[m.drug_name] = [];
    byDrug[m.drug_name].push(m);
  }
  const changed = [];
  for (const drug in byDrug) {
    const list = byDrug[drug].sort((a, b) => a.version - b.version);
    if (list.length >= 2) {
      const oldest = list[0];
      const newest = list[list.length - 1];
      if (oldest.dosage !== newest.dosage) {
        changed.push({
          drug,
          old_dosage: oldest.dosage,
          new_dosage: newest.dosage
        });
      }
    }
  }
  return changed;
}

function suspendIfDosageChanged(db, reportId, materialId) {
  const changes = detectDosageChange(db, reportId, materialId);
  if (changes.length === 0) return null;

  const desc = changes.map(c => `${c.drug}: ${c.old_dosage} → ${c.new_dosage}`).join('；');
  const affected = ['救助成本核算', '用药合规性判定', '恢复周期评估', '最终报销额度'];

  const anomalyRow = insert(db, 'anomalies', {
    report_id: reportId,
    type: 'dosage_changed',
    description: `病历手写单中用药剂量已改动：${desc}`,
    affected_conclusions: JSON.stringify(affected),
    resolved: 0,
    resolved_at: null
  });

  update(db, 'reports', r => r.id === reportId, { status: 'suspended' });
  touchReport(db, reportId);
  addHistory(db, reportId, 'suspend', {
    reason: `用药剂量改动触发挂起，关联异常#${anomalyRow.id}`,
    remark: `牵动结论：${affected.join('、')}`
  });

  return { anomalyId: anomalyRow.id, changes, affected };
}

// ============ Reports 列表 ============
app.get('/api/reports', (req, res) => {
  const db = load();
  const { status, q } = req.query;
  let rows = [...db.reports];
  if (status && status !== 'all') rows = rows.filter(r => r.status === status);
  if (q) rows = rows.filter(r => r.case_no.includes(q) || r.animal_name.includes(q));
  rows.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  rows = rows.map(r => ({ ...r, status_text: STATUS_MAP[r.status] || r.status }));
  res.json(rows);
});

app.get('/api/reports/summary', (req, res) => {
  const db = load();
  res.json({
    total: db.reports.length,
    suspended: db.reports.filter(r => r.status === 'suspended').length,
    pending: db.reports.filter(r => r.status === 'pending').length,
    anomalies: db.anomalies.filter(a => !a.resolved).length
  });
});

app.get('/api/reports/:id', (req, res) => {
  const db = load();
  const id = Number(req.params.id);
  const report = findOne(db, 'reports', r => r.id === id);
  if (!report) return res.status(404).json({ error: '报告不存在' });
  const rep = { ...report, status_text: STATUS_MAP[report.status] };

  const materials = findAll(db, 'materials', m => m.report_id === id,
    (a, b) => a.created_at.localeCompare(b.created_at))
    .map(m => ({ ...m, type_text: MATERIAL_TYPE_MAP[m.type] || m.type }));

  const medications = findAll(db, 'medications', m => m.report_id === id,
    (a, b) => a.created_at.localeCompare(b.created_at));

  const histories = findAll(db, 'histories', h => h.report_id === id,
    (a, b) => b.created_at.localeCompare(a.created_at));

  const anomalies = findAll(db, 'anomalies', a => a.report_id === id,
    (a, b) => (a.resolved ? 1 : 0) - (b.resolved ? 1 : 0) || b.created_at.localeCompare(a.created_at))
    .map(a => ({
      ...a,
      type_text: ANOMALY_TYPE_MAP[a.type] || a.type,
      affected_conclusions: a.affected_conclusions ? JSON.parse(a.affected_conclusions) : []
    }));

  res.json({ report: rep, materials, medications, histories, anomalies });
});

app.post('/api/reports', (req, res) => {
  const { animal_name, animal_type = '犬' } = req.body || {};
  if (!animal_name) return res.status(400).json({ error: '缺少动物名称' });

  tx(db => {
    const case_no = genCaseNo();
    const r = insert(db, 'reports', {
      case_no, animal_name, animal_type, status: 'draft',
      conclusion: null, current_operator: '寄养店长老周', updated_at: now()
    });
    addHistory(db, r.id, 'create', { new_value: `新建报告 ${case_no}` });
    res.json({ id: r.id, case_no });
  });
});

// ============ 材料 ============
app.post('/api/reports/:id/materials', (req, res) => {
  const reportId = Number(req.params.id);
  const { type, title, content, source = '寄养店长老周', medications = [] } = req.body;
  if (!type || !title || !content) return res.status(400).json({ error: '材料不完整' });

  tx(db => {
    const report = findOne(db, 'reports', r => r.id === reportId);
    if (!report) return res.status(404).json({ error: '报告不存在' });

    const sameTitle = findAll(db, 'materials', m => m.report_id === reportId && m.title === title,
      (a, b) => b.version - a.version);
    let version = 1, is_original = 1, parent_id = null;

    if (sameTitle.length > 0) {
      const prev = sameTitle[0];
      version = prev.version + 1;
      is_original = 0;
      parent_id = prev.id;
      const anomalyDesc = `材料「${title}」口径变更：v${prev.version} → v${version}，来源：${source}`;
      const affected = ['事实一致性', '原始材料链可信度', '最终导出结论'];
      insert(db, 'anomalies', {
        report_id: reportId, type: 'info_conflict', description: anomalyDesc,
        affected_conclusions: JSON.stringify(affected), resolved: 0, resolved_at: null
      });
    }

    const mat = insert(db, 'materials', {
      report_id: reportId, type, title, content, source,
      version, is_original, parent_id
    });

    for (const md of medications || []) {
      insert(db, 'medications', {
        report_id: reportId, material_id: mat.id,
        drug_name: md.drug_name, dosage: md.dosage, version
      });
    }

    addHistory(db, reportId, 'add_material', {
      new_value: `[${MATERIAL_TYPE_MAP[type] || type}] ${title}（v${version}${is_original ? ' 原始' : ' 口径变更'}）`,
      remark: content.length > 100 ? content.slice(0, 100) + '…' : content
    });

    touchReport(db, reportId);
    const suspend = suspendIfDosageChanged(db, reportId, mat.id);

    res.json({ id: mat.id, version, suspended: !!suspend, suspend });
  });
});

// ============ 改判 ============
app.post('/api/reports/:id/verdict', (req, res) => {
  const reportId = Number(req.params.id);
  const { conclusion, operator = '寄养店长老周', reason, remark } = req.body;
  if (!conclusion) return res.status(400).json({ error: '缺少改判结论' });

  tx(db => {
    const report = findOne(db, 'reports', r => r.id === reportId);
    if (!report) return res.status(404).json({ error: '报告不存在' });
    const oldConclusion = report.conclusion;
    update(db, 'reports', r => r.id === reportId, { conclusion, current_operator: operator, status: 'pending' });
    addHistory(db, reportId, 'change_conclusion', {
      operator,
      old_value: oldConclusion || '(无)',
      new_value: conclusion,
      reason, remark
    });
    touchReport(db, reportId);
    res.json({ ok: true });
  });
});

app.post('/api/reports/:id/status', (req, res) => {
  const reportId = Number(req.params.id);
  const { status, operator = '寄养店长老周', reason, remark } = req.body;
  if (!STATUS_MAP[status]) return res.status(400).json({ error: '无效状态' });

  tx(db => {
    const old = findOne(db, 'reports', r => r.id === reportId);
    if (!old) return res.status(404).json({ error: '报告不存在' });
    update(db, 'reports', r => r.id === reportId, { status, current_operator: operator });
    addHistory(db, reportId, `status_${old.status}_${status}`, {
      operator,
      old_value: STATUS_MAP[old.status],
      new_value: STATUS_MAP[status],
      reason, remark
    });
    touchReport(db, reportId);
    res.json({ ok: true });
  });
});

// ============ 异常队列 ============
app.get('/api/anomalies', (req, res) => {
  const db = load();
  const { resolved } = req.query;
  let list = [...db.anomalies];
  if (resolved === '0') list = list.filter(a => !a.resolved);
  else if (resolved === '1') list = list.filter(a => !!a.resolved);
  list.sort((a, b) => (a.resolved ? 1 : 0) - (b.resolved ? 1 : 0) || (b.created_at || '').localeCompare(a.created_at || ''));

  const result = list.map(a => {
    const r = findOne(db, 'reports', x => x.id === a.report_id) || {};
    return {
      ...a,
      case_no: r.case_no,
      animal_name: r.animal_name,
      report_status: r.status,
      type_text: ANOMALY_TYPE_MAP[a.type] || a.type,
      report_status_text: STATUS_MAP[r.status] || r.status,
      affected_conclusions: a.affected_conclusions ? JSON.parse(a.affected_conclusions) : []
    };
  });
  res.json(result);
});

app.post('/api/anomalies/:id/resolve', (req, res) => {
  const id = Number(req.params.id);
  const { operator = '算法值班人', remark, resume_report = false } = req.body;

  tx(db => {
    const a = findOne(db, 'anomalies', x => x.id === id);
    if (!a) return res.status(404).json({ error: '异常不存在' });
    update(db, 'anomalies', x => x.id === id, { resolved: 1, resolved_at: now() });
    addHistory(db, a.report_id, 'resolve_anomaly', {
      operator,
      new_value: `解决异常 #${a.id}：${ANOMALY_TYPE_MAP[a.type] || a.type}`,
      remark
    });
    if (resume_report) {
      update(db, 'reports', x => x.id === a.report_id, { status: 'pending', current_operator: operator });
      addHistory(db, a.report_id, 'resume', { operator, reason: remark || '异常已解决，恢复处理' });
      touchReport(db, a.report_id);
    }
    res.json({ ok: true });
  });
});

// ============ 导出 ============
app.post('/api/reports/:id/export', (req, res) => {
  const reportId = Number(req.params.id);

  const db = load();
  const detail = findOne(db, 'reports', r => r.id === reportId);
  if (!detail) return res.status(404).json({ error: '报告不存在' });
  if (detail.status === 'suspended') return res.status(400).json({ error: '报告已挂起，无法导出' });

  const materials = findAll(db, 'materials', m => m.report_id === reportId,
    (a, b) => a.created_at.localeCompare(b.created_at));
  const meds = findAll(db, 'medications', m => m.report_id === reportId);
  const anomalies = findAll(db, 'anomalies', a => a.report_id === reportId);
  const unresolved = anomalies.filter(a => !a.resolved);
  if (unresolved.length > 0) return res.status(400).json({ error: '存在未解决异常，无法导出' });

  tx(d => {
    addHistory(d, reportId, 'export', {
      operator: req.body?.operator || '算法值班人',
      remark: '导出正式报告'
    });
    touchReport(d, reportId);
  });

  res.json({
    case_no: detail.case_no,
    animal_name: detail.animal_name,
    animal_type: detail.animal_type,
    status: detail.status,
    conclusion: detail.conclusion,
    materials, medications: meds,
    anomalies,
    exported_at: new Date().toLocaleString('zh-CN')
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ 救助报告后端已启动: http://localhost:${PORT}`);
});
