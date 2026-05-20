const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function testSystem() {
  console.log('🏥 住院床位管理系统 - 功能测试\n');

  const dbPath = path.join(__dirname, '../data/hospital.db');
  const db = new sqlite3.Database(dbPath);

  const getAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  console.log('📊 床位统计:');
  const beds = await getAsync('SELECT * FROM beds');
  console.log(`   总床位: ${beds.length}`);
  const occupied = beds.filter(b => b.status === 'occupied').length;
  console.log(`   已占用: ${occupied}`);
  console.log(`   可用: ${beds.length - occupied}`);

  console.log('\n👥 患者统计:');
  const patients = await getAsync('SELECT * FROM patients');
  console.log(`   患者总数: ${patients.length}`);

  console.log('\n📋 追踪记录统计:');
  const records = await getAsync('SELECT * FROM tracking_records');
  console.log(`   记录总数: ${records.length}`);
  const statusCounts = {};
  records.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n📦 批次统计:');
  const batches = await getAsync('SELECT * FROM batches');
  console.log(`   总批次数: ${batches.length}`);

  console.log('\n🧹 保洁工单统计:');
  const cleaningOrders = await getAsync('SELECT * FROM cleaning_orders');
  console.log(`   总工单数: ${cleaningOrders.length}`);
  const timeoutOrders = cleaningOrders.filter(o => o.is_timeout === 1).length;
  console.log(`   超时工单: ${timeoutOrders}`);

  if (records.length > 0) {
    console.log('\n🔍 最新追踪记录详情:');
    const latestRecord = await getAsync('SELECT * FROM tracking_records ORDER BY handled_at DESC LIMIT 1');
    if (latestRecord.length > 0) {
      const rec = latestRecord[0];
      console.log(`   记录编号: ${rec.record_no}`);
      console.log(`   类型: ${rec.record_type}`);
      console.log(`   状态: ${rec.status}`);
      console.log(`   处理人: ${rec.handler}`);
      if (rec.reason) {
        console.log(`   原因: ${rec.reason}`);
      }
    }
  }

  console.log('\n✅ 测试完成！');
  db.close();
}

testSystem().catch(console.error);
