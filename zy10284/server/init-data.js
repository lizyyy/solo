const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'repair.db');
const db = new sqlite3.Database(dbPath);

const initSampleData = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const dorms = [
        { building: '1号楼', room_number: '101' },
        { building: '1号楼', room_number: '102' },
        { building: '1号楼', room_number: '201' },
        { building: '2号楼', room_number: '101' },
        { building: '2号楼', room_number: '102' },
        { building: '3号楼', room_number: '301' },
        { building: '3号楼', room_number: '302' },
        { building: '4号楼', room_number: '401' },
      ];

      const placeholders = dorms.map(() => '(?, ?)').join(',');
      const values = dorms.flatMap(d => [d.building, d.room_number]);
      
      db.run(`INSERT OR IGNORE INTO dorms (building, room_number) VALUES ${placeholders}`, values, (err) => {
        if (err) reject(err);
        
        const sampleOrders = [
          {
            order_no: 'WX202505100001',
            dorm_id: 1,
            student_name: '张三',
            student_phone: '13800138001',
            repair_type: '水管',
            description: '卫生间水管漏水三天了，地面一直有水',
            status: 'pending',
            submit_time: '2025-05-10 09:30:00'
          },
          {
            order_no: 'WX202505100002',
            dorm_id: 2,
            student_name: '李四',
            student_phone: '13800138002',
            repair_type: '水龙头',
            description: '洗手池水龙头关不紧，一直滴水',
            status: 'processing',
            submit_time: '2025-05-11 10:20:00'
          },
          {
            order_no: 'WX202505110003',
            dorm_id: 3,
            student_name: '王五',
            student_phone: '13800138003',
            repair_type: '电路',
            description: '宿舍灯不亮，检查后发现是开关坏了',
            status: 'assigned',
            submit_time: '2025-05-11 14:15:00'
          },
          {
            order_no: 'WX202505120004',
            dorm_id: 4,
            student_name: '赵六',
            student_phone: '13800138004',
            repair_type: '门锁',
            description: '门锁坏了，打不开门，已报修多次',
            status: 'reviewing',
            submit_time: '2025-05-12 08:45:00'
          },
          {
            order_no: 'WX202505120005',
            dorm_id: 5,
            student_name: '孙七',
            student_phone: '13800138005',
            repair_type: '灯具',
            description: '阳台灯闪烁，可能需要更换灯泡',
            status: 'completed',
            submit_time: '2025-05-12 16:30:00'
          },
        ];

        const orderPlaceholders = sampleOrders.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
        const orderValues = sampleOrders.flatMap(o => [
          o.order_no, o.dorm_id, o.student_name, o.student_phone, 
          o.repair_type, o.description, o.status
        ]);
        
        db.run(`INSERT OR IGNORE INTO repair_orders 
          (order_no, dorm_id, student_name, student_phone, repair_type, description, status)
          VALUES ${orderPlaceholders}`, orderValues, (err) => {
          if (err) reject(err);
          
          db.run('INSERT INTO audits (order_id, auditor, audit_result, audit_remark) VALUES (?, ?, ?, ?)',
            [2, '管理员A', 'pass', '情况属实，安排维修'], (err) => {
            if (err) reject(err);
            
            db.run('INSERT INTO assignments (order_id, worker, worker_phone, assign_remark) VALUES (?, ?, ?, ?)',
              [2, '王师傅', '13900139001', '请尽快维修水管问题'], (err) => {
              if (err) reject(err);
              
              db.run('INSERT INTO completions (order_id, complete_remark) VALUES (?, ?)',
                [4, '已更换新门锁，功能正常'], (err) => {
                if (err) reject(err);
                
                db.run('INSERT INTO reviews (order_id, rating, review_content, need_rework) VALUES (?, ?, ?, ?)',
                  [5, 4, '维修速度快，服务好', 0], (err) => {
                  if (err) reject(err);
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
};

initSampleData()
  .then(() => {
    console.log('样例数据初始化完成！');
    db.close();
  })
  .catch((err) => {
    console.error('数据初始化失败:', err);
    db.close();
  });
