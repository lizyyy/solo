const db = require('../db');
const fs = require('fs');
const path = require('path');
const { calculateBucketForSample } = require('../selfCheck');

const dbPath = path.join(__dirname, '..', '..', 'data', 'db.json');

function loadJSON() {
  if (!fs.existsSync(dbPath)) return {};
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch(e) { return {}; }
}

console.log('正在初始化样例数据...');

const data = loadJSON();
const checkReport = (data.weekly_reports || []).find(r => r.week_number === '2024-W23');

if (checkReport) {
  console.log('样例数据已存在，跳过初始化');
  process.exit(0);
}

const reportResult = db.prepare(`
  INSERT INTO weekly_reports (week_number, title, status, created_by)
  VALUES (?, ?, 'step1_imported', 'operator_zhang')
`).run('2024-W23', '2024年第23周推荐探索率周报');

const reportId = reportResult.lastInsertRowid;

const negativeSamples = [
  { original_line_no: 1, item_id: 'ITEM001', item_title: '夏季新款连衣裙', offline_score: 0.32, online_score: 0.41 },
  { original_line_no: 2, item_id: 'ITEM002', item_title: '男士休闲运动鞋', offline_score: 0.58, online_score: 0.52 },
  { original_line_no: 3, item_id: 'ITEM003', item_title: '智能手表Pro版', offline_score: 0.75, online_score: 0.68 },
  { original_line_no: 4, item_id: 'ITEM004', item_title: '无线蓝牙耳机', offline_score: 0.44, online_score: 0.51 },
  { original_line_no: 5, item_id: 'ITEM005', item_title: '家用空气净化器', offline_score: 0.21, online_score: 0.29 },
  { original_line_no: 6, item_id: 'ITEM006', item_title: '便携充电宝20000mAh', offline_score: 0.62, online_score: 0.71 },
  { original_line_no: 7, item_id: 'ITEM007', item_title: '机械键盘青轴', offline_score: 0.38, online_score: 0.47 },
  { original_line_no: 8, item_id: 'ITEM008', item_title: '人体工学办公椅', offline_score: 0.81, online_score: 0.83 },
  { original_line_no: 9, item_id: 'ITEM009', item_title: '高清投影仪家用', offline_score: 0.15, online_score: 0.24 },
  { original_line_no: 10, item_id: 'ITEM010', item_title: '电动牙刷声波震动', offline_score: 0.49, online_score: 0.58 },
];

const insertSample = db.prepare(`
  INSERT INTO negative_samples 
  (report_id, original_line_no, item_id, item_title, offline_score, online_score,
   offline_bucket, online_bucket, bucket_diff, is_bucket_diff_anomaly, raw_data, processing_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const addAudit = db.prepare(`
  INSERT INTO sample_audit_logs (sample_id, action, old_value, new_value, operator, remark)
  VALUES (?, ?, ?, ?, ?, ?)
`);

negativeSamples.forEach(s => {
  const bucketInfo = calculateBucketForSample(s);
  const result = insertSample.run(
    reportId,
    s.original_line_no,
    s.item_id,
    s.item_title,
    s.offline_score,
    s.online_score,
    bucketInfo.offline_bucket,
    bucketInfo.online_bucket,
    bucketInfo.bucket_diff,
    bucketInfo.is_bucket_diff_anomaly,
    JSON.stringify(s),
    'imported'
  );
  const sampleId = result.lastInsertRowid;
  addAudit.run(sampleId, 'import', null, JSON.stringify(s), 'operator_zhang', '第一次导入负样本');
});

const insertRecall = db.prepare(`
  INSERT INTO recall_candidates (report_id, sample_id, item_id, item_title, recall_source, recall_score, added_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertRecall.run(reportId, null, 'ITEM101', '碎花雪纺上衣', '召回通道A', 0.65, 'linjie');
insertRecall.run(reportId, null, 'ITEM102', '休闲凉鞋女款', '召回通道B', 0.58, 'linjie');
insertRecall.run(reportId, null, 'ITEM103', '运动速干T恤', '召回通道A', 0.72, 'linjie');

console.log(`✅ 样例数据初始化完成！`);
console.log(`   周报 ID: ${reportId} (2024-W23)`);
console.log(`   负样本: ${negativeSamples.length} 条`);
console.log(`   召回候选: 3 条（林姐补录，未关联）`);
console.log(`   包含: 离线线上分差一桶的异常记录若干，用于验证工作流`);
console.log(``);
console.log(`下一步: npm run dev`);
console.log(`然后访问: http://localhost:3001`);
