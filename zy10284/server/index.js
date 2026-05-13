const express = require('express');
const cors = require('cors');
const { db, initDatabase, insertSampleData } = require('./database');
const ExcelJS = require('exceljs');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

const getOrderById = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM repair_orders WHERE id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const hasAuditRecord = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM audits WHERE order_id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
};

const hasAssignmentRecord = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM assignments WHERE order_id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
};

const hasCompletionRecord = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM completions WHERE order_id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
};

const hasReviewRecord = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM reviews WHERE order_id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
};

const hasReworkRecord = (orderId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM reworks WHERE order_id = ?', [orderId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
};

const generateOrderNo = () => {
  const date = new Date();
  const prefix = `WX${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as count FROM repair_orders WHERE order_no LIKE ?`, [`${prefix}%`], (err, row) => {
      resolve(`${prefix}${String(row.count + 1).padStart(4, '0')}`);
    });
  });
};

app.get('/api/dorms', (req, res) => {
  db.all('SELECT * FROM dorms ORDER BY building, room_number', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/dorms/buildings', (req, res) => {
  db.all('SELECT DISTINCT building FROM dorms ORDER BY building', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.map(r => r.building));
  });
});

app.post('/api/repair-orders', async (req, res) => {
  const { dorm_id, student_name, student_phone, repair_type, description, images } = req.body;
  
  try {
    const existingOrder = await new Promise((resolve, reject) => {
      db.get(`
        SELECT ro.id, ro.order_no FROM repair_orders ro
        WHERE ro.dorm_id = ? AND ro.repair_type = ? AND ro.status != 'completed' AND ro.status != 'merged'
        ORDER BY ro.submit_time DESC LIMIT 1
      `, [dorm_id, repair_type], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingOrder) {
      return res.json({ 
        id: existingOrder.id, 
        order_no: existingOrder.order_no, 
        duplicated: true,
        message: '该宿舍已有同类报修在处理中，请勿重复提交'
      });
    }

    const order_no = await generateOrderNo();
    
    db.run(`
      INSERT INTO repair_orders (order_no, dorm_id, student_name, student_phone, repair_type, description, images, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [order_no, dorm_id, student_name, student_phone, repair_type, description, images, 'pending'], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, order_no, duplicated: false });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/repair-orders', (req, res) => {
  const { status, building, startDate, endDate } = req.query;
  let sql = `
    SELECT ro.*, d.building, d.room_number,
           a.audit_result, a.audit_remark,
           ass.worker,
           r.rating, r.need_rework,
           mo_main.order_no as merged_to_order_no,
           GROUP_CONCAT(mo_merged.order_no) as merged_orders
    FROM repair_orders ro
    JOIN dorms d ON ro.dorm_id = d.id
    LEFT JOIN audits a ON ro.id = a.order_id
    LEFT JOIN assignments ass ON ro.id = ass.order_id
    LEFT JOIN reviews r ON ro.id = r.order_id
    LEFT JOIN merged_orders mo ON ro.id = mo.merged_order_id
    LEFT JOIN repair_orders mo_main ON mo.main_order_id = mo_main.id
    LEFT JOIN merged_orders mo_inv ON ro.id = mo_inv.main_order_id
    LEFT JOIN repair_orders mo_merged ON mo_inv.merged_order_id = mo_merged.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    sql += ' AND ro.status = ?';
    params.push(status);
  }
  if (building) {
    sql += ' AND d.building = ?';
    params.push(building);
  }
  if (startDate) {
    sql += ' AND ro.submit_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND ro.submit_time <= ?';
    params.push(endDate + ' 23:59:59');
  }
  
  sql += ' GROUP BY ro.id ORDER BY ro.submit_time DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.get('/api/repair-orders/:id', async (req, res) => {
  const orderId = req.params.id;
  
  try {
    const row = await new Promise((resolve, reject) => {
      db.get(`
        SELECT ro.*, d.building, d.room_number,
               a.auditor, a.audit_result, a.audit_remark, a.audit_time,
               ass.worker, ass.worker_phone, ass.assign_remark, ass.assign_time,
               c.complete_remark, c.complete_time,
               r.rating, r.review_content, r.need_rework, r.review_time,
               mo_main.order_no as merged_to_order_no, mo_main.id as merged_to_id
        FROM repair_orders ro
        JOIN dorms d ON ro.dorm_id = d.id
        LEFT JOIN audits a ON ro.id = a.order_id
        LEFT JOIN assignments ass ON ro.id = ass.order_id
        LEFT JOIN completions c ON ro.id = c.order_id
        LEFT JOIN reviews r ON ro.id = r.order_id
        LEFT JOIN merged_orders mo ON ro.id = mo.merged_order_id
        LEFT JOIN repair_orders mo_main ON mo.main_order_id = mo_main.id
        WHERE ro.id = ?
      `, [orderId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    if (!row) return res.status(404).json({ error: '报修单不存在' });

    const materials = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM materials WHERE order_id = ?', [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    row.materials = materials;

    const mergedOrders = await new Promise((resolve, reject) => {
      db.all(`
        SELECT ro.id, ro.order_no, ro.student_name, ro.submit_time, mo.merge_time
        FROM merged_orders mo
        JOIN repair_orders ro ON mo.merged_order_id = ro.id
        WHERE mo.main_order_id = ?
      `, [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    row.merged_orders = mergedOrders;

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/repair-orders/:id/audit', async (req, res) => {
  const { auditor, audit_result, audit_remark } = req.body;
  const orderId = req.params.id;
  
  try {
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: '报修单不存在' });
    
    if (order.status !== 'pending') {
      return res.status(400).json({ error: '当前状态不允许审核，只有待审核状态可以操作' });
    }
    
    const hasAudited = await hasAuditRecord(orderId);
    if (hasAudited) {
      return res.status(400).json({ error: '该报修单已审核，请勿重复提交' });
    }
    
    db.run('INSERT INTO audits (order_id, auditor, audit_result, audit_remark) VALUES (?, ?, ?, ?)',
      [orderId, auditor, audit_result, audit_remark], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const newStatus = audit_result === 'pass' ? 'assigned' : 'blocked';
        db.run('UPDATE repair_orders SET status = ? WHERE id = ?', [newStatus, orderId], (updateErr) => {
          if (updateErr) res.status(500).json({ error: updateErr.message });
          else res.json({ success: true, new_status: newStatus });
        });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/repair-orders/:id/assign', async (req, res) => {
  const { worker, worker_phone, assign_remark } = req.body;
  const orderId = req.params.id;
  
  try {
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: '报修单不存在' });
    
    if (order.status !== 'assigned') {
      return res.status(400).json({ error: '当前状态不允许派工，只有待派工状态可以操作' });
    }
    
    const hasAssigned = await hasAssignmentRecord(orderId);
    if (hasAssigned) {
      return res.status(400).json({ error: '该报修单已派工，请勿重复提交' });
    }
    
    db.run('INSERT INTO assignments (order_id, worker, worker_phone, assign_remark) VALUES (?, ?, ?, ?)',
      [orderId, worker, worker_phone, assign_remark], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('UPDATE repair_orders SET status = ? WHERE id = ?', ['processing', orderId], (updateErr) => {
          if (updateErr) res.status(500).json({ error: updateErr.message });
          else res.json({ success: true, new_status: 'processing' });
        });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const getExistingMaterials = (orderId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT material_name FROM materials WHERE order_id = ?', [orderId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.material_name));
    });
  });
};

app.post('/api/repair-orders/:id/materials', async (req, res) => {
  const { materials } = req.body;
  const orderId = req.params.id;
  const materialLimit = { '水管': 2, '水龙头': 1, '灯泡': 5, '门锁': 1 };
  
  try {
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: '报修单不存在' });
    
    if (order.status !== 'processing') {
      return res.status(400).json({ error: '当前状态不允许记录材料，只有维修中状态可以操作' });
    }
    
    const existingMaterials = await getExistingMaterials(orderId);
    
    const stmt = db.prepare('INSERT INTO materials (order_id, material_name, quantity, unit, is_over_limit) VALUES (?, ?, ?, ?, ?)');
    
    const results = [];
    const skipped = [];
    materials.forEach(mat => {
      if (existingMaterials.includes(mat.material_name)) {
        skipped.push(mat.material_name);
        return;
      }
      const limit = materialLimit[mat.material_name] || 10;
      const isOverLimit = mat.quantity > limit ? 1 : 0;
      stmt.run(orderId, mat.material_name, mat.quantity, mat.unit || '个', isOverLimit);
      results.push({ name: mat.material_name, over_limit: isOverLimit });
    });
    
    stmt.finalize((err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ 
        success: true, 
        materials: results, 
        skipped: skipped,
        message: skipped.length > 0 ? `已跳过已存在的材料: ${skipped.join(', ')}` : null
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/repair-orders/:id/complete', async (req, res) => {
  const { complete_remark } = req.body;
  const orderId = req.params.id;
  
  try {
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: '报修单不存在' });
    
    if (order.status !== 'processing') {
      return res.status(400).json({ error: '当前状态不允许完工，只有维修中状态可以操作' });
    }
    
    const hasCompleted = await hasCompletionRecord(orderId);
    if (hasCompleted) {
      return res.status(400).json({ error: '该报修单已完工，请勿重复提交' });
    }
    
    db.run('INSERT INTO completions (order_id, complete_remark) VALUES (?, ?)',
      [orderId, complete_remark], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('UPDATE repair_orders SET status = ? WHERE id = ?', ['reviewing', orderId], (updateErr) => {
          if (updateErr) res.status(500).json({ error: updateErr.message });
          else res.json({ success: true, new_status: 'reviewing' });
        });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/repair-orders/:id/review', async (req, res) => {
  const { rating, review_content } = req.body;
  const orderId = req.params.id;
  const need_rework = rating <= 2 ? 1 : 0;
  
  try {
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: '报修单不存在' });
    
    if (order.status !== 'reviewing') {
      return res.status(400).json({ error: '当前状态不允许回访，只有待回访状态可以操作' });
    }
    
    const hasReviewed = await hasReviewRecord(orderId);
    if (hasReviewed) {
      return res.status(400).json({ error: '该报修单已回访，请勿重复提交' });
    }
    
    db.run('INSERT INTO reviews (order_id, rating, review_content, need_rework) VALUES (?, ?, ?, ?)',
      [orderId, rating, review_content, need_rework], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const newStatus = need_rework ? 'rework' : 'completed';
        db.run('UPDATE repair_orders SET status = ? WHERE id = ?', [newStatus, orderId], (updateErr) => {
          if (updateErr) res.status(500).json({ error: updateErr.message });
          else res.json({ success: true, need_rework: need_rework === 1, new_status: newStatus });
        });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/repair-orders/:id/rework', async (req, res) => {
  const { rework_reason, rework_worker } = req.body;
  const orderId = req.params.id;
  
  try {
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: '报修单不存在' });
    
    if (order.status !== 'rework') {
      return res.status(400).json({ error: '当前状态不允许返工，只有待返工状态可以操作' });
    }
    
    db.run('INSERT INTO reworks (order_id, rework_reason, rework_worker) VALUES (?, ?, ?)',
      [orderId, rework_reason, rework_worker], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('UPDATE repair_orders SET status = ? WHERE id = ?', ['processing', orderId], (updateErr) => {
          if (updateErr) res.status(500).json({ error: updateErr.message });
          else res.json({ success: true, new_status: 'processing' });
        });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/weekly', async (req, res) => {
  const { building } = req.query;
  const now = new Date();
  const weekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
  weekStart.setHours(0, 0, 0, 0);
  
  let sql = `
    SELECT ro.*, d.building, d.room_number,
           a.audit_result, ass.worker, r.rating
    FROM repair_orders ro
    JOIN dorms d ON ro.dorm_id = d.id
    LEFT JOIN audits a ON ro.id = a.order_id
    LEFT JOIN assignments ass ON ro.id = ass.order_id
    LEFT JOIN reviews r ON ro.id = r.order_id
    WHERE ro.submit_time >= ?
  `;
  const params = [weekStart.toISOString()];
  
  if (building) {
    sql += ' AND d.building = ?';
    params.push(building);
  }
  
  db.all(sql, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('本周维修情况');
    
    worksheet.columns = [
      { header: '报修单号', key: 'order_no', width: 20 },
      { header: '楼栋', key: 'building', width: 10 },
      { header: '房间', key: 'room_number', width: 10 },
      { header: '报修人', key: 'student_name', width: 12 },
      { header: '维修类型', key: 'repair_type', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '审核结果', key: 'audit_result', width: 12 },
      { header: '维修工人', key: 'worker', width: 12 },
      { header: '评分', key: 'rating', width: 8 },
      { header: '提交时间', key: 'submit_time', width: 20 },
    ];
    
    const statusMap = {
      pending: '待审核',
      assigned: '待派工',
      processing: '维修中',
      reviewing: '待回访',
      completed: '已完成',
      rework: '待返工',
      blocked: '已拦截',
      merged: '已合并'
    };
    
    rows.forEach(row => {
      row.status = statusMap[row.status] || row.status;
      worksheet.addRow(row);
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=weekly-repair-${now.toISOString().split('T')[0]}.xlsx`);
    res.send(Buffer.from(buffer));
  });
});

app.get('/api/stats', (req, res) => {
  db.all(`
    SELECT status, COUNT(*) as count
    FROM repair_orders
    GROUP BY status
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else {
      const stats = {
        pending: 0,
        assigned: 0,
        processing: 0,
        reviewing: 0,
        completed: 0,
        rework: 0,
        blocked: 0,
        merged: 0
      };
      rows.forEach(r => {
        stats[r.status] = r.count;
      });
      res.json(stats);
    }
  });
});

const initSampleOrders = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM repair_orders', (err, row) => {
      if (err) reject(err);
      if (row.count > 0) {
        resolve();
        return;
      }
      
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

      const orderPlaceholders = sampleOrders.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const orderValues = sampleOrders.flatMap(o => [
        o.order_no, o.dorm_id, o.student_name, o.student_phone, 
        o.repair_type, o.description, o.status, o.submit_time
      ]);
      
      db.run(`INSERT OR IGNORE INTO repair_orders 
        (order_no, dorm_id, student_name, student_phone, repair_type, description, status, submit_time)
        VALUES ${orderPlaceholders}`, orderValues, (err) => {
        if (err) reject(err);
        
        db.run('INSERT INTO audits (order_id, auditor, audit_result, audit_remark, audit_time) VALUES (?, ?, ?, ?, ?)',
          [2, '管理员A', 'pass', '情况属实，安排维修', '2025-05-11 11:00:00'], (err) => {
          if (err) reject(err);
          
          db.run('INSERT INTO assignments (order_id, worker, worker_phone, assign_remark, assign_time) VALUES (?, ?, ?, ?, ?)',
            [2, '王师傅', '13900139001', '请尽快维修水管问题', '2025-05-11 11:30:00'], (err) => {
            if (err) reject(err);
            
            db.run('INSERT INTO completions (order_id, complete_remark, complete_time) VALUES (?, ?, ?)',
              [4, '已更换新门锁，功能正常', '2025-05-12 17:00:00'], (err) => {
              if (err) reject(err);
              
              db.run('INSERT INTO reviews (order_id, rating, review_content, need_rework, review_time) VALUES (?, ?, ?, ?, ?)',
                [5, 4, '维修速度快，服务好', 0, '2025-05-12 18:00:00'], (err) => {
                if (err) reject(err);
                resolve();
              });
            });
          });
        });
      });
    });
  });
};

const startServer = async () => {
  await initDatabase();
  await insertSampleData();
  await initSampleOrders();
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
};

startServer();
