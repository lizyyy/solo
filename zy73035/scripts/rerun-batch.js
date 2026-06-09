const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, '..', 'data', 'review.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const batches = db.prepare(`
  SELECT b.*,
    (SELECT COUNT(*) FROM rescue_records r WHERE r.batch_id = b.id) as record_count
  FROM review_batches b
  ORDER BY b.batch_name, b.run_number DESC
`).all();

if (batches.length === 0) {
  console.log('还没有批次，先运行 npm run seed');
  process.exit(0);
}

const names = [...new Set(batches.map(b => b.batch_name))];

console.log('\n🔄 选择要【重跑/补跑】的批次组（重跑会继承上轮数据，run_number+1）：\n');
names.forEach((n, i) => {
  const group = batches.filter(b => b.batch_name === n);
  const runs = group.map(g => `run${g.run_number}`).join(', ');
  console.log(`  ${i + 1}. ${n}  (已跑: ${runs})`);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\n输入数字: ', (answer) => {
  const idx = (parseInt(answer) || 1) - 1;
  const name = names[idx];
  if (!name) { console.log('编号不对'); rl.close(); process.exit(1); }

  rl.question('填写这次补跑的备注（可选，例：补了3张疫苗照片）: ', (remark) => {
    doRerun(name, remark);
    rl.close();
  });
});

function doRerun(batchName, remark) {
  const existing = db.prepare('SELECT MAX(run_number) as max_run FROM review_batches WHERE batch_name = ?').get(batchName);
  const runNumber = (existing?.max_run || 0) + 1;

  const insertBatch = db.prepare('INSERT INTO review_batches (batch_name, run_number, remark) VALUES (?, ?, ?)');
  const batchResult = insertBatch.run(batchName, runNumber, remark || `补跑：基于 run${runNumber - 1} 补充备注后重跑`);
  const newBatchId = batchResult.lastInsertRowid;

  const prevBatch = db.prepare(`SELECT id FROM review_batches WHERE batch_name = ? AND run_number = ?`).get(batchName, runNumber - 1);
  const prevRecords = db.prepare('SELECT * FROM rescue_records WHERE batch_id = ?').all(prevBatch.id);

  const insertRecord = db.prepare(`
    INSERT INTO rescue_records (batch_id, pet_name, pet_alias, species, gender, rescue_date, vaccine_photo_refs, initial_conclusion, review_status, review_remark, manual_overridden, override_reason, final_conclusion, confirmed_by, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const logChange = db.prepare(`
    INSERT INTO change_history (record_id, batch_id, field_name, old_value, new_value, changed_by, change_type, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (const r of prevRecords) {
      const rid = insertRecord.run(newBatchId, r.pet_name, r.pet_alias, r.species, r.gender, r.rescue_date,
        r.vaccine_photo_refs, r.initial_conclusion, r.review_status, r.review_remark,
        r.manual_overridden, r.override_reason || '', r.final_conclusion || '',
        r.confirmed_by || '', r.confirmed_at || ''
      ).lastInsertRowid;
      logChange.run(rid, newBatchId, 'batch_carryover',
        `${batchName} run${runNumber - 1}`, `${batchName} run${runNumber}`,
        '系统', '批次重跑继承', remark || '补跑自动继承上轮数据');
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  console.log(`\n✅ 重跑完成！`);
  console.log(`   批次：${batchName}`);
  console.log(`   本次是：第 ${runNumber} 次跑`);
  console.log(`   继承记录：${prevRecords.length} 条`);
  console.log(`   备注：${remark || '(默认)'}`);
  console.log(`\n👉 打开前端 → 批次对比 → 选 run${runNumber}，就能看到跟上一轮的差异`);

  db.close();
}
