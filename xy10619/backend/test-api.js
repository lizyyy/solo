const db = require('./src/models/database');

console.log('=== 测试核心业务逻辑 ===\n');

// 测试1: 查询欠费记录
console.log('1. 查询欠费记录:');
db.all('SELECT * FROM reader_debts', (err, rows) => {
  if (err) console.error('错误:', err.message);
  else rows.forEach(r => console.log(`  - ID:${r.id}, 类型:${r.debt_type}, 金额:${r.final_amount}, 已缴:${r.is_paid}`));
  
  // 测试2: 查询遗失赔偿
  console.log('\n2. 查询遗失赔偿:');
  db.all('SELECT * FROM lost_compensation', (err, rows) => {
    if (err) console.error('错误:', err.message);
    else rows.forEach(r => console.log(`  - ID:${r.id}, 借阅ID:${r.borrow_record_id}, 金额:${r.compensation_amount}, 已缴:${r.is_paid}`));
    
    // 测试3: 模拟缴费 - 更新遗失赔偿
    console.log('\n3. 测试遗失赔偿缴费 (同步更新欠费):');
    db.run(`UPDATE lost_compensation SET is_paid = 1, paid_date = CURRENT_TIMESTAMP, processed_by = 1 WHERE id = 1`, function(err) {
      if (err) console.error('错误:', err.message);
      else {
        console.log(`  遗失赔偿更新成功, 影响行数: ${this.changes}`);
        
        // 同步更新对应的欠费记录
        db.get('SELECT borrow_record_id FROM lost_compensation WHERE id = 1', (err, lc) => {
          if (lc) {
            db.run(`UPDATE reader_debts SET is_paid = 1 WHERE borrow_record_id = ? AND debt_type = 'lost'`, [lc.borrow_record_id], function(err) {
              if (err) console.error('  欠费更新错误:', err.message);
              else console.log(`  关联欠费更新成功, 影响行数: ${this.changes}`);
              
              // 测试4: 检查修改日志
              console.log('\n4. 修改日志:');
              db.all('SELECT * FROM modification_logs ORDER BY id DESC LIMIT 5', (err, rows) => {
                if (err) console.error('错误:', err.message);
                else rows.forEach(r => console.log(`  - 表:${r.table_name}, 字段:${r.field_name}, ${r.old_value} → ${r.new_value}`));
                
                // 测试5: 减免审批测试
                console.log('\n5. 测试减免审批 (累计减免计算):');
                db.get('SELECT * FROM reader_debts WHERE id = 2', (err, debt) => {
                  if (debt) {
                    console.log(`  原欠费: 原始=${debt.original_amount}, 已减免=${debt.reduction_amount}, 最终=${debt.final_amount}`);
                    
                    const reductionAmount = 5;
                    const newReductionAmount = debt.reduction_amount + reductionAmount;
                    const newFinalAmount = Math.max(0, debt.original_amount - newReductionAmount);
                    
                    console.log(`  再减免${reductionAmount}后: 累计减免=${newReductionAmount}, 最终=${newFinalAmount}`);
                    
                    db.run(`UPDATE reader_debts SET reduction_amount = ?, final_amount = ? WHERE id = ?`, 
                      [newReductionAmount, newFinalAmount, debt.id], function(err) {
                        if (err) console.error('错误:', err.message);
                        else {
                          console.log(`  减免更新成功!`);
                          
                          // 记录修改日志
                          db.run(`INSERT INTO modification_logs (table_name, record_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?)`,
                            ['reader_debts', debt.id, 'reduction_amount', debt.reduction_amount, newReductionAmount, 1]);
                          db.run(`INSERT INTO modification_logs (table_name, record_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?)`,
                            ['reader_debts', debt.id, 'final_amount', debt.final_amount, newFinalAmount, 1], () => {
                              
                              // 最终验证
                              console.log('\n=== 最终验证 ===');
                              db.get('SELECT * FROM reader_debts WHERE id = 2', (err, d) => {
                                console.log(`  欠费ID 2: 原始=${d.original_amount}, 累计减免=${d.reduction_amount}, 最终=${d.final_amount}`);
                                console.log('\n✓ 所有测试完成!');
                                db.close();
                              });
                            });
                        }
                    });
                  }
                });
              });
            });
          }
        });
      }
    });
  });
});
