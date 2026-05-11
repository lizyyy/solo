const db = require('./db');
const readline = require('readline');

console.log('开始插入种子数据...\n');

function runSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seed() {
  try {
    await runSQL('BEGIN TRANSACTION');

    const batches = [
      { no: 'BATCH-SHEET-20240101', type: '床单', qty: 100, date: '2024-01-01' },
      { no: 'BATCH-TOWEL-20240101', type: '毛巾', qty: 200, date: '2024-01-01' },
      { no: 'BATCH-ROBE-20240101', type: '浴袍', qty: 50, date: '2024-01-01' },
    ];

    for (const batch of batches) {
      await runSQL(
        `INSERT INTO linen_batches (batch_no, linen_type, total_quantity, received_date) VALUES (?, ?, ?, ?)`,
        [batch.no, batch.type, batch.qty, batch.date]
      );
      await runSQL(
        `INSERT INTO inventory (linen_type, total_stock, in_stock) VALUES (?, ?, ?)`,
        [batch.type, batch.qty, batch.qty]
      );
      console.log(`✓ 创建批次: ${batch.no} (${batch.type} x ${batch.qty})`);
    }

    console.log('\n--- 场景1: 床单正常流转 ---');

    await runSQL(
      `INSERT INTO wash_records (batch_id, send_quantity, send_date, wash_factory, status, return_quantity, return_date)
       VALUES (1, 50, '2024-01-02', '洁净洗涤厂', 'returned', 50, '2024-01-04')`
    );
    console.log('✓ 发往洗涤: 床单 50件 -> 洗回 50件');

    await runSQL(
      `INSERT INTO usage_records (batch_id, room_no, quantity, usage_date, status)
       VALUES (1, '1001', 10, '2024-01-05', 'in_use')`
    );
    await runSQL(`UPDATE inventory SET in_stock = in_stock - 10, in_use = in_use + 10 WHERE linen_type = '床单'`);
    console.log('✓ 客房领用: 1001房 床单 10件');

    console.log('\n--- 场景2: 毛巾洗涤短回 ---');

    await runSQL(
      `INSERT INTO wash_records (batch_id, send_quantity, send_date, wash_factory, status, return_quantity, return_date)
       VALUES (2, 100, '2024-01-03', '洁净洗涤厂', 'returned', 95, '2024-01-05')`
    );
    await runSQL(`UPDATE inventory SET in_stock = in_stock - 5, total_stock = total_stock - 5 WHERE linen_type = '毛巾'`);
    console.log('✓ 发往洗涤: 毛巾 100件 -> 洗回 95件 (短少5件)');

    await runSQL(
      `INSERT INTO loss_records (batch_id, quantity, loss_type, reason, apply_date, compensate_confirmed, status)
       VALUES (2, 5, '洗涤损耗', '洗涤厂洗涤过程中破损5件', '2024-01-05', 'yes', 'confirmed')`
    );
    console.log('✓ 报损申请: 洗涤损耗 5件 (已确认)');

    console.log('\n--- 场景3: 浴袍客损 ---');

    await runSQL(
      `INSERT INTO usage_records (batch_id, room_no, quantity, usage_date, status)
       VALUES (3, '2008', 2, '2024-01-06', 'in_use')`
    );
    await runSQL(`UPDATE inventory SET in_stock = in_stock - 2, in_use = in_use + 2 WHERE linen_type = '浴袍'`);
    console.log('✓ 客房领用: 2008房 浴袍 2件');

    await runSQL(
      `INSERT INTO loss_records (batch_id, quantity, loss_type, reason, apply_date, room_no, compensate_amount, compensate_confirmed, status)
       VALUES (3, 1, '客损', '客人退房时发现浴袍染色损坏', '2024-01-08', '2008', 150.00, 'yes', 'confirmed')`
    );
    await runSQL(`UPDATE inventory SET total_stock = total_stock - 1, in_use = in_use - 1 WHERE linen_type = '浴袍'`);
    console.log('✓ 报损申请: 客损 1件 (赔付150元，已确认)');

    console.log('\n--- 场景4: 床单仓库盘亏 ---');

    await runSQL(
      `INSERT INTO loss_records (batch_id, quantity, loss_type, reason, apply_date, compensate_confirmed, status)
       VALUES (1, 3, '仓库盘亏', '月末盘点发现库存短少3件', '2024-01-31', 'no', 'pending')`
    );
    console.log('✓ 报损申请: 仓库盘亏 3件 (待处理)');

    await runSQL('COMMIT');

    console.log('\n✓ 种子数据插入完成!\n');
    console.log('预期库存汇总:');
    console.log('  床单: 总库存100 | 在库87 | 在洗0 | 在用10 (盘亏3件待处理)');
    console.log('  毛巾: 总库存195 | 在库195 | 在洗0 | 在用0 (洗涤损耗5件)');
    console.log('  浴袍: 总库存49 | 在库48 | 在洗0 | 在用1 (客损1件已赔付)');
    console.log('\n提示: 运行 npm start 启动服务后，可使用 curl 命令测试接口');
    
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 种子数据插入失败:', err.message);
    await runSQL('ROLLBACK').catch(() => {});
    db.close();
    process.exit(1);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.once('line', () => {
  rl.close();
  seed();
});

setTimeout(() => {
  rl.close();
  seed();
}, 100);
