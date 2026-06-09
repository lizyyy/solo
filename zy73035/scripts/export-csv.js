const { DatabaseSync } = require('node:sqlite');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const dbPath = path.join(__dirname, '..', 'data', 'review.db');
const db = new DatabaseSync(dbPath);

const batches = db.prepare(`
  SELECT b.*,
    (SELECT COUNT(*) FROM rescue_records r WHERE r.batch_id = b.id) as record_count
  FROM review_batches b
  ORDER BY b.created_at DESC
`).all();

if (batches.length === 0) {
  console.log('还没有批次，先运行 npm run seed');
  process.exit(0);
}

console.log('\n📦 选择要导出的批次：\n');
batches.forEach((b, i) => {
  console.log(`  ${i + 1}. ${b.batch_name} (第${b.run_number}次跑) · ${b.record_count}条记录 · ${b.created_at}`);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\n输入数字（回车默认第1个）: ', (answer) => {
  const idx = (parseInt(answer) || 1) - 1;
  const batch = batches[idx];
  if (!batch) { console.log('编号不对'); rl.close(); process.exit(1); }
  doExport(batch);
  rl.close();
});

function doExport(batch) {
  const batchId = batch.id;

  const records = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM change_history h WHERE h.record_id = r.id) as change_count
    FROM rescue_records r
    WHERE r.batch_id = ?
    ORDER BY r.id
  `).all(batchId);

  const dirty = db.prepare('SELECT * FROM dirty_data_reports WHERE batch_id = ?').all(batchId);

  const history = db.prepare(`
    SELECT h.*, r.pet_name
    FROM change_history h
    LEFT JOIN rescue_records r ON h.record_id = r.id
    WHERE h.batch_id = ?
    ORDER BY h.changed_at DESC
  `).all(batchId);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const exportDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const files = [];

  const recordsFile = path.join(exportDir, `${batch.batch_name}-run${batch.run_number}-记录-${timestamp}.csv`);
  createCsvWriter({
    path: recordsFile,
    header: [
      { id: 'id', title: '记录ID' }, { id: 'pet_name', title: '宠物名称' },
      { id: 'pet_alias', title: '别名' }, { id: 'species', title: '物种' },
      { id: 'gender', title: '性别' }, { id: 'rescue_date', title: '救助日期' },
      { id: 'vaccine_photo_refs', title: '疫苗照片引用' }, { id: 'initial_conclusion', title: '初步结论' },
      { id: 'review_status', title: '复核状态' }, { id: 'review_remark', title: '复核备注' },
      { id: 'manual_overridden', title: '人工改判(1=是)' }, { id: 'override_reason', title: '改判原因' },
      { id: 'final_conclusion', title: '最终结论' }, { id: 'confirmed_by', title: '确认人' },
      { id: 'confirmed_at', title: '确认时间' }, { id: 'created_at', title: '创建时间' },
      { id: 'updated_at', title: '更新时间' }, { id: 'change_count', title: '变更次数' }
    ]
  }).writeRecords(records);
  files.push({ name: '记录CSV', file: recordsFile, count: records.length });

  const dirtyFile = path.join(exportDir, `${batch.batch_name}-run${batch.run_number}-脏数据-${timestamp}.csv`);
  createCsvWriter({
    path: dirtyFile,
    header: [
      { id: 'id', title: '报告ID' }, { id: 'record_id', title: '记录ID' },
      { id: 'issue_type', title: '问题类型' }, { id: 'severity', title: '严重程度' },
      { id: 'description', title: '详细说明' }, { id: 'affected_fields', title: '涉及字段' },
      { id: 'detected_at', title: '检测时间' }
    ]
  }).writeRecords(dirty);
  files.push({ name: '脏数据CSV', file: dirtyFile, count: dirty.length });

  const historyFile = path.join(exportDir, `${batch.batch_name}-run${batch.run_number}-变更历史-${timestamp}.csv`);
  createCsvWriter({
    path: historyFile,
    header: [
      { id: 'id', title: '变更ID' }, { id: 'pet_name', title: '宠物名称' },
      { id: 'field_name', title: '变更字段' }, { id: 'old_value', title: '原值' },
      { id: 'new_value', title: '新值' }, { id: 'changed_by', title: '操作人' },
      { id: 'change_type', title: '变更类型' }, { id: 'change_reason', title: '变更原因' },
      { id: 'changed_at', title: '变更时间' }
    ]
  }).writeRecords(history);
  files.push({ name: '变更历史CSV', file: historyFile, count: history.length });

  console.log('\n✅ 导出完成！文件列表：\n');
  files.forEach(f => {
    console.log(`  📄 ${f.name}（${f.count}条）：${path.basename(f.file)}`);
    console.log(`     路径：${f.file}`);
  });
  console.log(`\n📁 导出目录：${exportDir}`);

  db.close();
}
