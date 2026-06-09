const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'review.db');
if (!fs.existsSync(dbPath)) {
  console.error('数据库不存在，请先运行 npm run init');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const batchResult = db.prepare(`
  INSERT INTO review_batches (batch_name, run_number, created_by, remark)
  VALUES (?, ?, ?, ?)
`).run('2026年6月徐汇站第一批', 1, '小温', '社区王阿姨+志愿者小李送的材料，照片散在微信群里');
const batchId = batchResult.lastInsertRowid;

console.log('📦 创建批次: 2026年6月徐汇站第一批 (run 1)');

const records = [
  {
    pet_name: '小黄', pet_alias: '小黄豆', species: '狗', gender: '公', rescue_date: '2026-05-12',
    vaccine_photo_refs: '微信聊天-0513-小黄疫苗1, 疫苗本P2, 疫苗本P3',
    initial_conclusion: '3针基础免疫+狂犬均在有效期内',
    review_status: '已确认', review_remark: '', manual_overridden: 0,
    final_conclusion: '3针基础免疫+狂犬均在有效期内'
  },
  {
    pet_name: '小黄', pet_alias: '小黄豆', species: '狗', gender: '公', rescue_date: '2026-05-12',
    vaccine_photo_refs: '重复录入的记录',
    initial_conclusion: '同上', review_status: '待复核', review_remark: '', manual_overridden: 0
  },
  {
    pet_name: '咪咪', pet_alias: '小奶牛', species: '猫', gender: '母', rescue_date: '2026-04-28',
    vaccine_photo_refs: '', initial_conclusion: '', review_status: '待复核', review_remark: '', manual_overridden: 0
  },
  {
    pet_name: '大黑', pet_alias: '黑炭头', species: '狗', gender: '公', rescue_date: '2026-03-15',
    vaccine_photo_refs: '聊天记录截图-1张',
    initial_conclusion: '疫苗照片只看到1张，疑似缺加强针',
    review_status: '待复核', review_remark: '', manual_overridden: 0
  },
  {
    pet_name: '花花', pet_alias: '', species: '猫', gender: '母', rescue_date: '2026-05-02',
    vaccine_photo_refs: '疫苗本首页, 疫苗本P3',
    initial_conclusion: '首免2针已做，还差第3针',
    review_status: '有疑问', review_remark: '', manual_overridden: 0
  },
  {
    pet_name: '阿灰', pet_alias: '灰灰', species: '', gender: '', rescue_date: '',
    vaccine_photo_refs: '', initial_conclusion: '', review_status: '待复核', review_remark: '', manual_overridden: 0
  },
  {
    pet_name: '小白', pet_alias: '白雪公主', species: '狗', gender: '母', rescue_date: '2026-05-20',
    vaccine_photo_refs: '医院系统可查, A20260521008',
    initial_conclusion: '疫苗照片缺失，系统有记录但需确认',
    review_status: '待复核', review_remark: '', manual_overridden: 1,
    override_reason: '疫苗本丢失，经联系接诊医院张医生核实，2026-05-21完成全部4针免疫+狂犬，系统编号A20260521008，截图已存档',
    final_conclusion: '人工确认免疫合格，医院系统可查全部记录',
    confirmed_by: '前台小温（人工改判）'
  },
  {
    pet_name: '旺财', pet_alias: '', species: '狗', gender: '公', rescue_date: '2026-04-10',
    vaccine_photo_refs: '志愿者小李转发-图3, 社区医院证明扫描件',
    initial_conclusion: '疫苗齐全', review_status: '已确认', review_remark: '', manual_overridden: 0,
    final_conclusion: '疫苗齐全'
  }
];

const insertRecord = db.prepare(`
  INSERT INTO rescue_records (batch_id, pet_name, pet_alias, species, gender, rescue_date, vaccine_photo_refs, initial_conclusion, review_status, review_remark, manual_overridden, override_reason, final_conclusion, confirmed_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const logChange = db.prepare(`
  INSERT INTO change_history (record_id, batch_id, field_name, old_value, new_value, changed_by, change_type, change_reason)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN');
try {
  for (const r of records) {
    const rid = insertRecord.run(
      batchId, r.pet_name, r.pet_alias, r.species, r.gender, r.rescue_date,
      r.vaccine_photo_refs, r.initial_conclusion, r.review_status, r.review_remark,
      r.manual_overridden, r.override_reason || '', r.final_conclusion || '',
      r.confirmed_by || ''
    ).lastInsertRowid;

    logChange.run(rid, batchId, 'record_create', '', JSON.stringify({ pet_name: r.pet_name, pet_alias: r.pet_alias }),
      '小温', '创建记录', '模拟现场收到的材料录入');

    if (r.manual_overridden === 1) {
      logChange.run(rid, batchId, 'manual_overridden', '0', '1',
        '前台小温（人工改判）', '人工改判', r.override_reason);
      if (r.final_conclusion) {
        logChange.run(rid, batchId, 'final_conclusion', '', r.final_conclusion,
          '前台小温（人工改判）', '字段修改', '人工改判后设置最终结论');
      }
      if (r.review_status) {
        logChange.run(rid, batchId, 'review_status', '待复核', r.review_status,
          '前台小温', '字段修改', '人工改判后确认状态');
      }
    }
  }
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }

console.log(`✅ 录入 ${records.length} 条模拟救助记录`);
console.log('   · 包含【别名重复】：小黄/小黄豆 出现2次（故意的脏数据）');
console.log('   · 包含【疫苗照片缺失】：咪咪、阿灰（模拟聊天里散着的照片没记全）');
console.log('   · 包含【疫苗照片不足】：大黑只有1张、花花2张');
console.log('   · 包含【物种/性别/日期缺失】：阿灰');
console.log('   · 包含【人工改判】：小白 疫苗本丢了但医院系统核实通过，带完整改判原因');
console.log('   · 包含【已确认】：小黄、旺财');
console.log('');

const batch2 = db.prepare(`
  INSERT INTO review_batches (batch_name, run_number, created_by, remark)
  VALUES (?, ?, ?, ?)
`).run('2026年6月徐汇站第一批', 2, '小温', '补录备注后第2次重跑，方便对比');
const batch2Id = batch2.lastInsertRowid;

const prevRecords = db.prepare('SELECT * FROM rescue_records WHERE batch_id = ?').all(batchId);
const insert2 = db.prepare(`
  INSERT INTO rescue_records (batch_id, pet_name, pet_alias, species, gender, rescue_date, vaccine_photo_refs, initial_conclusion, review_status, review_remark, manual_overridden, override_reason, final_conclusion)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN');
try {
  for (const r of prevRecords) {
    let remark = r.review_remark || '';
    let status = r.review_status;
    let conclusion = r.final_conclusion || '';
    if (r.pet_name === '咪咪') { remark = '补注：王阿姨说本周带咪咪去补疫苗照片，聊天截图已保存到D盘'; status = '复核中'; }
    if (r.pet_name === '大黑') { remark = '补加强针照片已收到，共3张齐全，等确认'; conclusion = '加强针照片补到后确认免疫齐全'; }
    if (r.pet_name === '花花') { remark = '联系救助人，第3针已在6/1补打，等照片'; status = '已确认'; conclusion = '第3针补打凭证已收，免疫完整'; }

    const rid = insert2.run(batch2Id, r.pet_name, r.pet_alias, r.species, r.gender, r.rescue_date,
      r.vaccine_photo_refs, r.initial_conclusion, status, remark,
      r.manual_overridden, r.override_reason || '', conclusion || ''
    ).lastInsertRowid;

    logChange.run(rid, batch2Id, 'batch_carryover', `run1`, `run2`,
      '系统', '批次重跑继承', `从批次 2026年6月徐汇站第一批 run1 继承数据`);
    if (remark !== (r.review_remark || '')) {
      logChange.run(rid, batch2Id, 'review_remark', r.review_remark || '', remark,
        '前台小温', '字段修改', '补跑时补充备注');
    }
    if (conclusion !== (r.final_conclusion || '')) {
      logChange.run(rid, batch2Id, 'final_conclusion', r.final_conclusion || '', conclusion,
        '前台小温', '字段修改', '补跑时更新最终结论');
    }
    if (status !== r.review_status) {
      logChange.run(rid, batch2Id, 'review_status', r.review_status, status,
        '前台小温', '字段修改', '补跑时更新复核状态');
    }
  }
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }

console.log('🔄 创建同批次 run2（补跑）：');
console.log('   · 继承 run1 全部数据');
console.log('   · 修改了咪咪、大黑、花花的备注/状态/结论');
console.log('   · 打开"批次对比"页可看到 run1 vs run2 的差异');
console.log('');

db.close();
console.log('🎉 示例材料准备完成！现在可以 npm start 启动了');
