const db = require('./src/database');

console.log('正在初始化样例数据...');

db.serialize(() => {
  const roomTypes = [
    { room_type: '标准间', item_name: '床单', quantity: 2 },
    { room_type: '标准间', item_name: '被罩', quantity: 2 },
    { room_type: '标准间', item_name: '枕套', quantity: 4 },
    { room_type: '标准间', item_name: '毛巾', quantity: 2 },
    { room_type: '大床房', item_name: '床单', quantity: 2 },
    { room_type: '大床房', item_name: '被罩', quantity: 2 },
    { room_type: '大床房', item_name: '枕套', quantity: 2 },
    { room_type: '大床房', item_name: '毛巾', quantity: 2 },
    { room_type: '豪华套房', item_name: '床单', quantity: 3 },
    { room_type: '豪华套房', item_name: '被罩', quantity: 3 },
    { room_type: '豪华套房', item_name: '枕套', quantity: 6 },
    { room_type: '豪华套房', item_name: '毛巾', quantity: 4 },
    { room_type: '豪华套房', item_name: '浴巾', quantity: 2 },
  ];

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO room_types (room_type, item_name, quantity, unit, updated_at)
     VALUES (?, ?, ?, '件', CURRENT_TIMESTAMP)`
  );
  
  roomTypes.forEach(item => {
    stmt.run(item.room_type, item.item_name, item.quantity);
  });
  stmt.finalize();

  db.run(
    `INSERT INTO laundry_batches (batch_no, send_date, total_items, status, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    ['BATCH-20240520-001', '2024-05-20', 410, 'pending', '张经理'],
    function(err) {
      if (err) {
        console.error('创建批次失败:', err);
        return;
      }
      const batchId = this.lastID;
      
      const laundryItems = [
        { room_type: '标准间', item_name: '床单', qty: 50 },
        { room_type: '标准间', item_name: '被罩', qty: 50 },
        { room_type: '标准间', item_name: '枕套', qty: 100 },
        { room_type: '标准间', item_name: '毛巾', qty: 50 },
        { room_type: '大床房', item_name: '床单', qty: 30 },
        { room_type: '大床房', item_name: '被罩', qty: 30 },
        { room_type: '大床房', item_name: '枕套', qty: 30 },
        { room_type: '大床房', item_name: '毛巾', qty: 30 },
        { room_type: '豪华套房', item_name: '床单', qty: 10 },
        { room_type: '豪华套房', item_name: '被罩', qty: 10 },
        { room_type: '豪华套房', item_name: '枕套', qty: 20 },
        { room_type: '豪华套房', item_name: '毛巾', qty: 20 },
        { room_type: '豪华套房', item_name: '浴巾', qty: 10 },
      ];

      const itemStmt = db.prepare(
        `INSERT INTO laundry_items (batch_id, room_type, item_name, send_quantity)
         VALUES (?, ?, ?, ?)`
      );
      
      laundryItems.forEach(item => {
        itemStmt.run(batchId, item.room_type, item.item_name, item.qty);
      });
      itemStmt.finalize();

      db.run(
        `INSERT INTO recovery_records (batch_id, recovery_no, recovery_date, handler, status)
         VALUES (?, ?, ?, ?, ?)`,
        [batchId, 'HS-20240522-001', '2024-05-22', '李主管', 'pending'],
        function(err) {
          if (err) {
            console.error('创建回收记录失败:', err);
            return;
          }
          const recoveryId = this.lastID;
          
          const recoveryItems = [
            { room_type: '标准间', item_name: '床单', qty: 48 },
            { room_type: '标准间', item_name: '被罩', qty: 50 },
            { room_type: '标准间', item_name: '枕套', qty: 97 },
            { room_type: '标准间', item_name: '毛巾', qty: 50 },
            { room_type: '大床房', item_name: '床单', qty: 30 },
            { room_type: '大床房', item_name: '被罩', qty: 29 },
            { room_type: '大床房', item_name: '枕套', qty: 30 },
            { room_type: '大床房', item_name: '毛巾', qty: 30 },
            { room_type: '豪华套房', item_name: '床单', qty: 10 },
            { room_type: '豪华套房', item_name: '被罩', qty: 10 },
            { room_type: '豪华套房', item_name: '枕套', qty: 20 },
            { room_type: '豪华套房', item_name: '毛巾', qty: 20 },
            { room_type: '豪华套房', item_name: '浴巾', qty: 9 },
          ];

          const recStmt = db.prepare(
            `INSERT INTO recovery_items (recovery_id, room_type, item_name, quantity)
             VALUES (?, ?, ?, ?)`
          );
          
          recoveryItems.forEach(item => {
            recStmt.run(recoveryId, item.room_type, item.item_name, item.qty);
          });
          recStmt.finalize();

          db.run(
            `INSERT INTO compensation_records 
             (batch_id, item_name, room_type, shortage_qty, damage_qty, reason, handler, status, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [batchId, '床单', '标准间', 2, 0, '送洗50件，回收48件，短少2件', '王审核', 'pending', '需与洗涤厂确认赔偿金额'],
            function() {
              db.run(
                `INSERT INTO compensation_records 
                 (batch_id, item_name, room_type, shortage_qty, damage_qty, reason, handler, status, remark)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [batchId, '枕套', '标准间', 3, 0, '送洗100件，回收97件，短少3件', '王审核', 'pending', '需与洗涤厂确认'],
                function() {
                  db.run(
                    `INSERT INTO compensation_records 
                     (batch_id, item_name, room_type, shortage_qty, damage_qty, reason, handler, status, remark)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [batchId, '被罩', '大床房', 1, 0, '送洗30件，回收29件，短少1件', '王审核', 'pending', '待确认'],
                    function() {
                      db.run(
                        `INSERT INTO compensation_records 
                         (batch_id, item_name, room_type, shortage_qty, damage_qty, reason, handler, status, remark)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [batchId, '浴巾', '豪华套房', 1, 0, '送洗10件，回收9件，短少1件', '王审核', 'pending', '待跟进'],
                        function() {
                          console.log('✅ 样例数据初始化完成！');
                          console.log('');
                          console.log('📊 已创建数据:');
                          console.log('  - 房型配置: 13条');
                          console.log('  - 洗涤批次: 1个 (BATCH-20240520-001)');
                          console.log('  - 送洗明细: 13条 (共410件)');
                          console.log('  - 回收记录: 1条');
                          console.log('  - 赔付记录: 4条 (需要人工审核修正)');
                          console.log('');
                          console.log('⚠️  需要人工修正的记录:');
                          console.log('  1. 标准间床单短少2件 - 需确认赔偿金额');
                          console.log('  2. 标准间枕套短少3件 - 需与洗涤厂确认');
                          console.log('  3. 大床房被罩短少1件 - 待确认');
                          console.log('  4. 豪华套房浴巾短少1件 - 待跟进');
                          console.log('');
                          console.log('🚀 启动服务: npm start');
                          process.exit(0);
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});
