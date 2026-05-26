const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function loadSampleData() {
  console.log('开始加载样例数据...');

  const batchId = 'BATCH-SAMPLE-001';
  
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO batches (batch_id, batch_name, total_count, operator, status) VALUES (?, ?, ?, ?, ?)',
      [batchId, '2024年5月租赁结算批次', 10, '系统管理员', 'completed'],
      function(err) {
        if (err) reject(err);
        else {
          console.log('✓ 创建批次:', batchId);
          resolve();
        }
      }
    );
  });

  const csvPath = path.join(__dirname, '../../sample-data/rental_sample.csv');
  const rentals = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => rentals.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  for (const row of rentals) {
    await new Promise((resolve, reject) => {
      const startDate = new Date(row.rental_start_date);
      const endDate = new Date(row.rental_end_date);
      const actualReturn = new Date(row.actual_return_date);
      
      let overdueDays = 0;
      let overdueFee = 0;
      if (actualReturn > endDate) {
        overdueDays = Math.ceil((actualReturn - endDate) / (1000 * 60 * 60 * 24));
        overdueFee = overdueDays * parseFloat(row.daily_rate);
      }

      const totalRental = parseFloat(row.total_rental_fee) || 0;
      const actualPayment = parseFloat(row.actual_payment) || 0;
      const hasDuplicatePayment = actualPayment > totalRental + 1;

      db.run(`
        INSERT INTO rental_records 
        (batch_id, device_serial, device_name, customer_name, customer_phone,
         rental_start_date, rental_end_date, actual_return_date, daily_rate,
         deposit_amount, deposit_flow_id, total_rental_fee, actual_payment,
         status, overdue_days, overdue_fee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        batchId, row.device_serial, row.device_name, row.customer_name, row.customer_phone,
        row.rental_start_date, row.rental_end_date, row.actual_return_date, row.daily_rate,
        row.deposit_amount, row.deposit_flow_id, row.total_rental_fee, row.actual_payment,
        'pending', overdueDays, overdueFee
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          const rentalId = this.lastID;
          console.log(`✓ 导入租赁记录: ${row.device_serial} (ID: ${rentalId})`);
          
          if (overdueDays > 0) {
            db.run(`
              INSERT INTO exceptions (rental_id, exception_type, description, amount)
              VALUES (?, 'overdue', ?, ?)
            `, [rentalId, `逾期 ${overdueDays} 天`, overdueFee]);
            console.log(`  ⚠ 检测到逾期: ${overdueDays}天, 金额: ¥${overdueFee}`);
          }
          
          if (hasDuplicatePayment) {
            const diff = actualPayment - totalRental;
            db.run(`
              INSERT INTO exceptions (rental_id, exception_type, description, amount)
              VALUES (?, 'duplicate_payment', ?, ?)
            `, [rentalId, `重复扣款: 实收 ${actualPayment}, 应收 ${totalRental}`, diff]);
            console.log(`  ⚠ 检测到重复扣款: ¥${diff}`);
          }
          
          resolve(rentalId);
        }
      });
    });
  }

  const repairData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../sample-data/repair_sample.json'), 'utf8')
  );
  
  for (const repair of repairData.repairs) {
    await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM rental_records WHERE device_serial = ? ORDER BY id DESC LIMIT 1',
        [repair.device_serial],
        (err, row) => {
          if (err) reject(err);
          const rentalId = row ? row.id : null;
          
          db.run(`
            INSERT INTO repair_records 
            (rental_id, device_serial, repair_type, repair_description, 
             repair_cost, is_customer_fault, fault_reason, report_date, repair_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            rentalId, repair.device_serial, repair.repair_type, repair.repair_description,
            repair.repair_cost, repair.is_customer_fault ? 1 : 0, repair.fault_reason,
            repair.report_date, repair.repair_date
          ], function(err) {
            if (err) reject(err);
            else {
              console.log(`✓ 导入维修记录: ${repair.device_serial} (${repair.repair_type})`);
              
              if (rentalId && repair.is_customer_fault) {
                db.run(`
                  UPDATE rental_records 
                  SET repair_fee = repair_fee + ?, has_repair = 1 
                  WHERE id = ?
                `, [repair.repair_cost, rentalId]);
                
                db.run(`
                  INSERT INTO exceptions (rental_id, exception_type, description, amount)
                  VALUES (?, 'repair_liability', ?, ?)
                `, [rentalId, `客户责任维修: ${repair.repair_description}`, repair.repair_cost]);
                console.log(`  ⚠ 客户责任维修费用: ¥${repair.repair_cost}`);
              }
              resolve();
            }
          });
        }
      );
    });
  }

  const depositRules = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../sample-data/deposit_rules.json'), 'utf8')
  );
  
  for (const rule of depositRules.rules) {
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO deposit_rules (device_type, device_model, deposit_amount, overdue_rate)
        VALUES (?, ?, ?, ?)
      `, [rule.device_type, rule.device_model, rule.deposit_amount, rule.overdue_rate],
      function(err) {
        if (err) reject(err);
        else {
          console.log(`✓ 导入押金规则: ${rule.device_type}-${rule.device_model}`);
          resolve();
        }
      });
    });
  }

  await new Promise((resolve, reject) => {
    db.get('SELECT id FROM rental_records WHERE device_serial = ?', ['EQ-2024-002'], (err, row) => {
      if (err) reject(err);
      if (row) {
        db.run(`
          INSERT INTO operation_logs 
          (rental_id, batch_id, operation_type, operator, reason, old_status, new_status)
          VALUES (?, ?, 'return', '李主管', '存在客户责任维修费用，需要客户确认', 'pending', 'returned')
        `, [row.id, batchId], (err) => {
          if (err) reject(err);
          db.run('UPDATE rental_records SET status = ? WHERE id = ?', ['returned', row.id], (err) => {
            if (err) reject(err);
            console.log('✓ 创建退回修改记录: EQ-2024-002');
            resolve();
          });
        });
      } else {
        resolve();
      }
    });
  });

  await new Promise((resolve, reject) => {
    db.get('SELECT id FROM rental_records WHERE device_serial = ?', ['EQ-2024-001'], (err, row) => {
      if (err) reject(err);
      if (row) {
        db.run(`
          INSERT INTO operation_logs 
          (rental_id, batch_id, operation_type, operator, reason, old_status, new_status)
          VALUES (?, ?, 'process', '王审核员', '租期正常，费用无误，准予结算', 'pending', 'approved')
        `, [row.id, batchId], (err) => {
          if (err) reject(err);
          db.run('UPDATE rental_records SET status = ? WHERE id = ?', ['approved', row.id], (err) => {
            if (err) reject(err);
            console.log('✓ 创建审批通过记录: EQ-2024-001');
            resolve();
          });
        });
      } else {
        resolve();
      }
    });
  });

  console.log('\n=== 样例数据加载完成 ===');
  console.log('注意: EQ-2024-002 已被退回，需要人工处理');
  console.log('      EQ-2024-003 存在重复扣款异常');
  console.log('      EQ-2024-006 存在逾期记录');
  console.log('      请启动服务后查看异常列表');
  
  db.close();
}

loadSampleData().catch(err => {
  console.error('加载样例数据失败:', err);
  db.close();
  process.exit(1);
});
