import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'drift-report.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS bundles (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'parsing'
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    bundle_id TEXT NOT NULL REFERENCES bundles(id),
    type TEXT NOT NULL CHECK(type IN ('normal', 'late_arrival', 'duplicate', 'correction')),
    raw_data TEXT NOT NULL,
    linked_sample_id TEXT REFERENCES annotation_samples(id),
    linked_evaluation_id TEXT REFERENCES evaluations(id),
    confidence REAL NOT NULL DEFAULT 1.0
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    model_id TEXT NOT NULL REFERENCES models(id),
    severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
    bundle_id TEXT REFERENCES bundles(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conclusions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical'))
  );

  CREATE TABLE IF NOT EXISTS conclusion_sources (
    id TEXT PRIMARY KEY,
    conclusion_id TEXT NOT NULL REFERENCES conclusions(id) ON DELETE CASCADE,
    record_id TEXT REFERENCES records(id),
    sample_id TEXT REFERENCES annotation_samples(id),
    evaluation_id TEXT REFERENCES evaluations(id)
  );

  CREATE TABLE IF NOT EXISTS annotation_samples (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL REFERENCES models(id),
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    file_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL REFERENCES models(id),
    report_id TEXT REFERENCES reports(id),
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    baseline REAL NOT NULL,
    drift REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS change_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('conclusion', 'evaluation', 'feedback')),
    entity_id TEXT NOT NULL,
    report_id TEXT REFERENCES reports(id),
    field_name TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    operator TEXT NOT NULL,
    operated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_records_bundle ON records(bundle_id);
  CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
  CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
  CREATE INDEX IF NOT EXISTS idx_reports_model ON reports(model_id);
  CREATE INDEX IF NOT EXISTS idx_conclusions_report ON conclusions(report_id);
  CREATE INDEX IF NOT EXISTS idx_conclusion_sources_conclusion ON conclusion_sources(conclusion_id);
  CREATE INDEX IF NOT EXISTS idx_evaluations_report ON evaluations(report_id);
  CREATE INDEX IF NOT EXISTS idx_change_history_report ON change_history(report_id);
  CREATE INDEX IF NOT EXISTS idx_change_history_entity ON change_history(entity_type, entity_id);
`)

function seedData() {
  const modelCount = db.prepare('SELECT COUNT(*) as count FROM models').get() as { count: number }
  if (modelCount.count > 0) return

  const insertModel = db.prepare('INSERT INTO models (id, name, description) VALUES (?, ?, ?)')
  const insertReport = db.prepare('INSERT INTO reports (id, date, model_id, severity, bundle_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertConclusion = db.prepare('INSERT INTO conclusions (id, report_id, title, description, severity) VALUES (?, ?, ?, ?, ?)')
  const insertSample = db.prepare('INSERT INTO annotation_samples (id, model_id, label, content, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  const insertEvaluation = db.prepare('INSERT INTO evaluations (id, model_id, report_id, metric, value, baseline, drift, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insertSource = db.prepare('INSERT INTO conclusion_sources (id, conclusion_id, record_id, sample_id, evaluation_id) VALUES (?, ?, ?, ?, ?)')
  const insertChange = db.prepare('INSERT INTO change_history (id, entity_type, entity_id, report_id, field_name, old_value, new_value, operator, operated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')

  const m1 = uuidv4()
  const m2 = uuidv4()
  const m3 = uuidv4()

  insertModel.run(m1, '用户意图识别模型', '基于BERT的多意图分类模型，用于识别用户查询的真实意图')
  insertModel.run(m2, '商品推荐模型', '协同过滤+深度学习混合推荐模型，服务于首页及详情页推荐')
  insertModel.run(m3, '情感分析模型', '基于RoBERTa的细粒度情感分析模型，支持正/负/中三分类')

  const s1 = uuidv4()
  const s2 = uuidv4()
  const s3 = uuidv4()
  const s4 = uuidv4()
  const s5 = uuidv4()

  insertSample.run(s1, m1, '查询意图-退款', '用户输入"我想退掉这个商品"的标注样本，标注为退款意图', '/samples/intent/refund_001.json', '2026-05-28 10:00:00')
  insertSample.run(s2, m1, '查询意图-换货', '用户输入"能不能换一个尺码"的标注样本，标注为换货意图', '/samples/intent/exchange_002.json', '2026-05-28 10:05:00')
  insertSample.run(s3, m2, '推荐偏好-数码', '用户浏览了3款手机后推荐的数码类商品标注', '/samples/rec/digital_001.json', '2026-05-29 09:00:00')
  insertSample.run(s4, m3, '情感-正面', '用户评论"这个产品质量真的很好"标注为正面情感', '/samples/sentiment/pos_001.json', '2026-05-29 11:00:00')
  insertSample.run(s5, m3, '情感-负面', '用户评论"太差了完全不推荐"标注为负面情感', '/samples/sentiment/neg_001.json', '2026-05-29 11:05:00')

  const r1 = uuidv4()
  const r2 = uuidv4()
  const r3 = uuidv4()
  const r4 = uuidv4()
  const r5 = uuidv4()
  const r6 = uuidv4()

  insertReport.run(r1, '2026-05-26', m1, 'medium', null, '2026-05-26 08:30:00', '2026-05-26 09:00:00')
  insertReport.run(r2, '2026-05-27', m2, 'high', null, '2026-05-27 08:30:00', '2026-05-27 10:00:00')
  insertReport.run(r3, '2026-05-28', m1, 'critical', null, '2026-05-28 08:30:00', '2026-05-28 11:00:00')
  insertReport.run(r4, '2026-05-29', m3, 'low', null, '2026-05-29 08:30:00', '2026-05-29 09:00:00')
  insertReport.run(r5, '2026-05-30', m2, 'medium', null, '2026-05-30 08:30:00', '2026-05-30 09:30:00')
  insertReport.run(r6, '2026-05-30', m3, 'high', null, '2026-05-30 08:30:00', '2026-05-30 10:00:00')

  const e1 = uuidv4()
  const e2 = uuidv4()
  const e3 = uuidv4()
  const e4 = uuidv4()
  const e5 = uuidv4()
  const e6 = uuidv4()

  insertEvaluation.run(e1, m1, r1, 'accuracy', 0.91, 0.94, -0.03, '2026-05-26 09:00:00')
  insertEvaluation.run(e2, m2, r2, 'ndcg@10', 0.72, 0.78, -0.06, '2026-05-27 09:30:00')
  insertEvaluation.run(e3, m1, r3, 'accuracy', 0.85, 0.94, -0.09, '2026-05-28 09:00:00')
  insertEvaluation.run(e4, m3, r4, 'f1_score', 0.88, 0.90, -0.02, '2026-05-29 09:00:00')
  insertEvaluation.run(e5, m2, r5, 'ndcg@10', 0.74, 0.78, -0.04, '2026-05-30 09:00:00')
  insertEvaluation.run(e6, m3, r6, 'f1_score', 0.82, 0.90, -0.08, '2026-05-30 09:30:00')

  const c1 = uuidv4()
  const c2 = uuidv4()
  const c3 = uuidv4()
  const c4 = uuidv4()
  const c5 = uuidv4()
  const c6 = uuidv4()
  const c7 = uuidv4()
  const c8 = uuidv4()
  const c9 = uuidv4()
  const c10 = uuidv4()

  insertConclusion.run(c1, r1, '意图识别准确率小幅下降', '模型在退款和换货意图上的识别准确率从94%降至91%，主要受近期新增意图类别影响', 'medium')
  insertConclusion.run(c2, r2, '推荐NDCG指标显著下降', 'NDCG@10从0.78降至0.72，下降幅度达7.7%，数码品类推荐效果恶化明显', 'high')
  insertConclusion.run(c3, r3, '意图识别准确率严重漂移', '准确率从94%暴跌至85%，退款项意图混淆严重，疑似训练数据存在标注错误', 'critical')
  insertConclusion.run(c4, r3, '训练集标注样本疑似泄漏', '发现3条线上预测样本与训练集高度相似，可能存在数据泄漏问题', 'critical')
  insertConclusion.run(c5, r4, '情感分析F1微降', 'F1分数从0.90降至0.88，中性评论分类边界模糊，属正常波动范围', 'low')
  insertConclusion.run(c6, r5, '推荐NDCG持续偏低', 'NDCG@10维持在0.74附近，较基线仍低0.04，数码品类已部分恢复', 'medium')
  insertConclusion.run(c7, r6, '负面情感召回率下降', 'F1从0.90降至0.82，负面情感召回率下降明显，漏判比例上升', 'high')
  insertConclusion.run(c8, r6, '新增负面样本分布偏移', '近期新增的差评样本与训练集分布差异较大，导致模型判断不稳定', 'medium')
  insertConclusion.run(c9, r1, '新增意图类别影响有限', '新增3个意图类别后，旧类别识别准确率仅下降1.2%，影响可控', 'low')
  insertConclusion.run(c10, r5, '用户点击率略有回升', '推荐列表点击率从2.1%回升至2.4%，但距基线2.8%仍有差距', 'low')

  insertSource.run(uuidv4(), c1, null, s1, e1)
  insertSource.run(uuidv4(), c1, null, s2, e1)
  insertSource.run(uuidv4(), c2, null, s3, e2)
  insertSource.run(uuidv4(), c3, null, s1, e3)
  insertSource.run(uuidv4(), c4, null, s2, null)
  insertSource.run(uuidv4(), c5, null, s4, e4)
  insertSource.run(uuidv4(), c7, null, s5, e6)
  insertSource.run(uuidv4(), c8, null, s5, e6)

  insertChange.run(uuidv4(), 'conclusion', c3, r3, 'severity', 'high', 'critical', '张明', '2026-05-28 10:30:00')
  insertChange.run(uuidv4(), 'conclusion', c3, r3, 'description', '准确率从94%降至85%', '准确率从94%暴跌至85%，退款项意图混淆严重，疑似训练数据存在标注错误', '张明', '2026-05-28 10:45:00')
  insertChange.run(uuidv4(), 'evaluation', e3, r3, 'drift', '-0.03', '-0.09', '李华', '2026-05-28 09:15:00')
  insertChange.run(uuidv4(), 'conclusion', c7, r6, 'severity', 'medium', 'high', '王芳', '2026-05-30 09:45:00')
  insertChange.run(uuidv4(), 'feedback', r5, r5, 'status', 'pending', 'reviewed', '王芳', '2026-05-30 10:00:00')
}

const transaction = db.transaction(seedData)
transaction()

export { db }
