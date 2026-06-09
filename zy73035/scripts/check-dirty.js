const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'review.db');
const db = new DatabaseSync(dbPath);

const batches = db.prepare(`
  SELECT b.*,
    (SELECT COUNT(*) FROM rescue_records r WHERE r.batch_id = b.id) as record_count
  FROM review_batches b
  ORDER BY b.created_at DESC
`).all();

if (batches.length === 0) {
  console.log('还没有批次，先运行 npm run seed 加载示例');
  process.exit(0);
}

console.log('\n📦 选择要检测脏数据的批次：\n');
batches.forEach((b, i) => {
  console.log(`  ${i + 1}. ${b.batch_name} (第${b.run_number}次跑) · ${b.record_count}条记录`);
});

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\n输入数字（回车默认第1个）: ', (answer) => {
  const idx = (parseInt(answer) || 1) - 1;
  const batch = batches[idx];
  if (!batch) { console.log('编号不对'); rl.close(); return; }
  runCheck(batch.id, batch.batch_name, batch.run_number);
  rl.close();
});

function runCheck(batchId, name, runNo) {
  const records = db.prepare('SELECT * FROM rescue_records WHERE batch_id = ?').all(batchId);
  const reports = [];

  const aliasMap = new Map();
  records.forEach(r => {
    const alias = (r.pet_alias || '').trim();
    const n = (r.pet_name || '').trim();
    const key = alias ? `${n}|${alias}` : n;
    if (!aliasMap.has(key)) aliasMap.set(key, []);
    aliasMap.get(key).push(r);
  });
  for (const [key, items] of aliasMap.entries()) {
    if (items.length > 1) {
      const [nm, al] = key.split('|');
      reports.push({ sev: '🔴 错误', type: '别名重复', msg: `"${nm}"${al?'（'+al+'）':''}有${items.length}条重复，ID:${items.map(i=>i.id).join(',')}` });
    }
  }

  records.forEach(r => {
    if (!r.vaccine_photo_refs || r.vaccine_photo_refs.trim() === '') {
      reports.push({ sev: '🟡 警告', type: '疫苗照片缺失', msg: `#${r.id} ${r.pet_name}：没关联疫苗照片，散在聊天里？` });
    } else {
      const refs = r.vaccine_photo_refs.split(/[,，;；]/).map(s => s.trim()).filter(Boolean);
      if (refs.length < 2) reports.push({ sev: '🟡 警告', type: '疫苗照片不足', msg: `#${r.id} ${r.pet_name}：仅${refs.length}张照片` });
    }
    if (!r.rescue_date) reports.push({ sev: '🟡 警告', type: '救助日期缺', msg: `#${r.id} ${r.pet_name}：没填救助日期` });
    if (!r.species) reports.push({ sev: '🟡 警告', type: '物种缺失', msg: `#${r.id} ${r.pet_name}：没填物种` });
    if (r.manual_overridden === 1 && !r.override_reason) {
      reports.push({ sev: '🔴 错误', type: '改判原因缺失', msg: `#${r.id} ${r.pet_name}：改判了但没填原因，讲不清楚` });
    }
    if (!r.initial_conclusion && !r.final_conclusion) {
      reports.push({ sev: '🔵 信息', type: '结论待定', msg: `#${r.id} ${r.pet_name}：还没出结论` });
    }
  });

  db.prepare('DELETE FROM dirty_data_reports WHERE batch_id = ?').run(batchId);
  const ins = db.prepare(`INSERT INTO dirty_data_reports (batch_id, record_id, issue_type, severity, description, affected_fields) VALUES (?,?,?,?,?,?)`);
  db.exec('BEGIN');
  try {
    reports.forEach(r => {
      const m = r.msg.match(/#(\d+)/);
      const sev = r.sev.includes('错误') ? '错误' : r.sev.includes('警告') ? '警告' : '信息';
      ins.run(batchId, m ? m[1] : null, r.type, sev, r.msg, '');
    });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  console.log(`\n📋 ${name} 第${runNo}次跑 · 脏数据检测结果\n`);
  console.log(`   共 ${reports.length} 条问题：`);
  console.log(`   🔴 错误：${reports.filter(r=>r.sev.includes('错误')).length}条`);
  console.log(`   🟡 警告：${reports.filter(r=>r.sev.includes('警告')).length}条`);
  console.log(`   🔵 信息：${reports.filter(r=>r.sev.includes('信息')).length}条`);
  console.log('');
  const typeMap = {};
  reports.forEach(r => { if (!typeMap[r.type]) typeMap[r.type] = []; typeMap[r.type].push(r); });
  Object.entries(typeMap).forEach(([type, list]) => {
    console.log(`━━━ ${type} (${list.length}条) ━━━`);
    list.forEach(r => console.log(`  ${r.sev}  ${r.msg}`));
    console.log('');
  });

  db.close();
}
