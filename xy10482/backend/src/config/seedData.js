const db = require('./database');

function seedData() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.all('SELECT COUNT(*) as count FROM plots', [], (err, rows) => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        
        if (rows[0].count > 0) {
          console.log('数据已存在，跳过初始化');
          db.run('COMMIT');
          return resolve();
        }

        const plots = [
          { name: '草莓园A区', area: 5.5, crop_type: '草莓', location: '东区', status: 'active' },
          { name: '草莓园B区', area: 4.0, crop_type: '草莓', location: '西区', status: 'active' },
          { name: '蔬菜园1号', area: 3.0, crop_type: '蔬菜', location: '南区', status: 'active' },
          { name: '蔬菜园2号', area: 2.5, crop_type: '蔬菜', location: '北区', status: 'active' }
        ];

        const plotStmt = db.prepare('INSERT INTO plots (name, area, crop_type, location, status) VALUES (?, ?, ?, ?, ?)');
        plots.forEach(p => plotStmt.run(p.name, p.area, p.crop_type, p.location, p.status));
        plotStmt.finalize();

        const grades = [
          { name: '优品', code: 'A', description: '品质优良，大小均匀', sort_order: 1, status: 'active' },
          { name: '合格品', code: 'B', description: '品质合格，略有瑕疵', sort_order: 2, status: 'active' },
          { name: '次品', code: 'C', description: '品质较差，可加工使用', sort_order: 3, status: 'active' }
        ];

        const gradeStmt = db.prepare('INSERT INTO grades (name, code, description, sort_order, status) VALUES (?, ?, ?, ?, ?)');
        grades.forEach(g => gradeStmt.run(g.name, g.code, g.description, g.sort_order, g.status));
        gradeStmt.finalize();

        const lossReasons = [
          { name: '机械损伤', description: '采收或运输过程中造成的物理损伤' },
          { name: '病虫害', description: '受到病虫害影响' },
          { name: '成熟过度', description: '成熟度过高导致品质下降' },
          { name: '畸形', description: '形状畸形不符合标准' },
          { name: '大小不符', description: '大小不符合等级标准' }
        ];

        const lossStmt = db.prepare('INSERT INTO loss_reasons (name, description) VALUES (?, ?)');
        lossReasons.forEach(l => lossStmt.run(l.name, l.description));
        lossStmt.finalize();

        const managers = [
          { name: '张三', phone: '13800138001', status: 'active' },
          { name: '李四', phone: '13800138002', status: 'active' },
          { name: '王五', phone: '13800138003', status: 'active' }
        ];

        const managerStmt = db.prepare('INSERT INTO harvest_managers (name, phone, status) VALUES (?, ?, ?)');
        managers.forEach(m => managerStmt.run(m.name, m.phone, m.status));
        managerStmt.finalize();

        const tasks = [
          { plot_id: 1, manager_id: 1, harvest_date: '2026-05-01', crop_type: '草莓', estimated_quantity: 500, actual_quantity: 480, status: 'completed' },
          { plot_id: 1, manager_id: 2, harvest_date: '2026-05-08', crop_type: '草莓', estimated_quantity: 450, actual_quantity: 0, status: 'in_progress' },
          { plot_id: 3, manager_id: 3, harvest_date: '2026-05-05', crop_type: '蔬菜', estimated_quantity: 800, actual_quantity: 0, status: 'pending' },
          { plot_id: 2, manager_id: 1, harvest_date: '2026-05-03', crop_type: '草莓', estimated_quantity: 300, actual_quantity: 0, status: 'pending' }
        ];

        const taskStmt = db.prepare('INSERT INTO harvest_tasks (plot_id, manager_id, harvest_date, crop_type, estimated_quantity, actual_quantity, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        tasks.forEach(t => taskStmt.run(t.plot_id, t.manager_id, t.harvest_date, t.crop_type, t.estimated_quantity, t.actual_quantity, t.status));
        taskStmt.finalize();

        const batches = [
          { batch_no: 'HC-20260501-A1B2C3', harvest_task_id: 1, grade_id: 1, quantity: 300, loss_quantity: 50, loss_reason_id: 1, unit: 'kg', storage_location: 'A-01', status: 'available', quality_status: 'passed' },
          { batch_no: 'HC-20260501-X4Y5Z6', harvest_task_id: 1, grade_id: 2, quantity: 80, loss_quantity: 50, loss_reason_id: 2, unit: 'kg', storage_location: 'A-02', status: 'quarantined', quality_status: 'failed' }
        ];

        const batchStmt = db.prepare('INSERT INTO inventory_batches (batch_no, harvest_task_id, grade_id, quantity, loss_quantity, loss_reason_id, unit, storage_location, status, quality_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        batches.forEach(b => batchStmt.run(b.batch_no, b.harvest_task_id, b.grade_id, b.quantity, b.loss_quantity, b.loss_reason_id, b.unit, b.storage_location, b.status, b.quality_status));
        batchStmt.finalize();

        const inspections = [
          { batch_id: 1, inspector: '质检员A', result: 'passed', score: 95, defects: null, notes: '品质优良，全部合格' },
          { batch_id: 2, inspector: '质检员B', result: 'failed', score: 45, defects: '发现病虫害痕迹，部分果实腐烂', notes: '病虫害严重，建议隔离处理' }
        ];

        const inspectStmt = db.prepare('INSERT INTO quality_inspections (batch_id, inspector, result, score, defects, notes) VALUES (?, ?, ?, ?, ?, ?)');
        inspections.forEach(i => inspectStmt.run(i.batch_id, i.inspector, i.result, i.score, i.defects, i.notes));
        inspectStmt.finalize();

        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          console.log('样例数据初始化完成');
          resolve();
        });
      });
    });
  });
}

module.exports = seedData;
