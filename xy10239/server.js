const express = require('express');
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const generateComplaintNo = () => {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0') + 
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CP${dateStr}${random}`;
};

const updateStatistics = (batchId, callback) => {
  db.get(`SELECT * FROM order_batches WHERE id = ?`, [batchId], (err, batch) => {
    if (err) return callback(err);
    if (!batch) return callback(new Error('批次不存在'));

    db.get(`SELECT 
      COALESCE(SUM(actual_quantity), 0) as weighed_quantity,
      COALESCE(SUM(actual_weight), 0) as weighed_weight,
      COALESCE(SUM(difference_quantity), 0) as total_difference_quantity,
      COALESCE(SUM(difference_weight), 0) as total_difference_weight
    FROM weighing_records WHERE batch_id = ?`, [batchId], (err, weighStats) => {
      if (err) return callback(err);

      db.all(`SELECT status, COUNT(*) as count FROM complaints WHERE batch_id = ? GROUP BY status`, [batchId], (err, complaintStats) => {
        if (err) return callback(err);

        const statsMap = {};
        complaintStats.forEach(s => {
          statsMap[s.status] = s.count;
        });

        const totalComplaints = Object.values(statsMap).reduce((a, b) => a + b, 0);

        db.get(`SELECT * FROM statistics WHERE batch_id = ?`, [batchId], (err, existing) => {
          if (err) return callback(err);

          if (existing) {
            db.run(`UPDATE statistics SET 
              weighed_quantity = ?,
              weighed_weight = ?,
              total_complaints = ?,
              pending_complaints = ?,
              confirmed_complaints = ?,
              rejected_complaints = ?,
              total_difference_quantity = ?,
              total_difference_weight = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE batch_id = ?`, [
              weighStats.weighed_quantity,
              weighStats.weighed_weight,
              totalComplaints,
              statsMap['pending'] || 0,
              statsMap['confirmed'] || 0,
              statsMap['rejected'] || 0,
              weighStats.total_difference_quantity,
              weighStats.total_difference_weight,
              batchId
            ], callback);
          } else {
            db.run(`INSERT INTO statistics (
              batch_id, batch_no, order_quantity, order_weight,
              weighed_quantity, weighed_weight, total_complaints,
              pending_complaints, confirmed_complaints, rejected_complaints,
              total_difference_quantity, total_difference_weight
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
              batchId, batch.batch_no, batch.order_quantity, batch.order_weight,
              weighStats.weighed_quantity, weighStats.weighed_weight, totalComplaints,
              statsMap['pending'] || 0, statsMap['confirmed'] || 0, statsMap['rejected'] || 0,
              weighStats.total_difference_quantity, weighStats.total_difference_weight
            ], callback);
          }
        });
      });
    });
  });
};

app.post('/api/batches', (req, res) => {
  const { batch_no, supplier, product_name, order_quantity, order_weight, unit, arrival_date } = req.body;
  
  db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [batch_no], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (existing) {
      return res.status(200).json({ 
        message: '批次已存在，使用现有数据',
        data: existing,
        isNew: false
      });
    }

    db.run(`INSERT INTO order_batches (batch_no, supplier, product_name, order_quantity, order_weight, unit, arrival_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [batch_no, supplier, product_name, order_quantity, order_weight, unit, arrival_date],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const newId = this.lastID;
        updateStatistics(newId, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.get(`SELECT * FROM order_batches WHERE id = ?`, [newId], (err, data) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ data, isNew: true });
          });
        });
      }
    );
  });
});

app.post('/api/batches/bulk', (req, res) => {
  const batches = req.body.batches;
  const results = [];
  
  const processBatch = (index) => {
    if (index >= batches.length) {
      return res.json({ results, total: batches.length });
    }
    
    const batch = batches[index];
    db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [batch.batch_no], (err, existing) => {
      if (err) {
        results.push({ batch_no: batch.batch_no, error: err.message });
        return processBatch(index + 1);
      }
      
      if (existing) {
        results.push({ batch_no: batch.batch_no, status: 'skipped', message: '已存在' });
        return processBatch(index + 1);
      }
      
      db.run(`INSERT INTO order_batches (batch_no, supplier, product_name, order_quantity, order_weight, unit, arrival_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [batch.batch_no, batch.supplier, batch.product_name, batch.order_quantity, batch.order_weight, batch.unit, batch.arrival_date],
        function(err) {
          if (err) {
            results.push({ batch_no: batch.batch_no, error: err.message });
            return processBatch(index + 1);
          }
          
          results.push({ batch_no: batch.batch_no, status: 'added' });
          processBatch(index + 1);
        }
      );
    });
  };
  
  processBatch(0);
});

app.get('/api/batches', (req, res) => {
  db.all(`SELECT * FROM order_batches ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/weighing', (req, res) => {
  const { batch_no, group_leader, weighing_time, actual_quantity, actual_weight, notes } = req.body;
  
  db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [batch_no], (err, batch) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    
    const difference_quantity = actual_quantity - batch.order_quantity;
    const difference_weight = actual_weight - batch.order_weight;
    
    db.get(`SELECT * FROM weighing_records WHERE batch_id = ? AND group_leader = ?`, 
      [batch.id, group_leader], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (existing) {
          db.run(`UPDATE weighing_records SET 
            weighing_time = ?, actual_quantity = ?, actual_weight = ?,
            difference_quantity = ?, difference_weight = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [weighing_time, actual_quantity, actual_weight, difference_quantity, difference_weight, notes, existing.id],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              
              updateStatistics(batch.id, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: '称重记录已更新', isNew: false });
              });
            }
          );
        } else {
          db.run(`INSERT INTO weighing_records 
            (batch_id, batch_no, group_leader, weighing_time, actual_quantity, actual_weight, 
            difference_quantity, difference_weight, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [batch.id, batch_no, group_leader, weighing_time, actual_quantity, actual_weight, 
            difference_quantity, difference_weight, notes],
            function(err) {
              if (err) return res.status(500).json({ error: err.message });
              
              updateStatistics(batch.id, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ id: this.lastID, isNew: true });
              });
            }
          );
        }
      }
    );
  });
});

app.get('/api/weighing', (req, res) => {
  db.all(`SELECT w.*, o.product_name, o.supplier FROM weighing_records w 
    LEFT JOIN order_batches o ON w.batch_id = o.id 
    ORDER BY w.created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/complaints', (req, res) => {
  const { batch_no, user_name, user_phone, complaint_time, complaint_type, complaint_content, 
    expected_quantity, expected_weight, actual_quantity, actual_weight } = req.body;
  
  db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [batch_no], (err, batch) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    
    const complaint_no = generateComplaintNo();
    
    db.run(`INSERT INTO complaints 
      (complaint_no, batch_id, batch_no, user_name, user_phone, complaint_time, 
      complaint_type, complaint_content, expected_quantity, expected_weight, actual_quantity, actual_weight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [complaint_no, batch.id, batch_no, user_name, user_phone, complaint_time, 
      complaint_type, complaint_content, expected_quantity, expected_weight, actual_quantity, actual_weight],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        updateStatistics(batch.id, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ complaint_no, id: this.lastID });
        });
      }
    );
  });
});

app.put('/api/complaints/:id', (req, res) => {
  const { user_name, user_phone, complaint_content, expected_quantity, expected_weight, 
    actual_quantity, actual_weight } = req.body;
  
  db.get(`SELECT * FROM complaints WHERE id = ?`, [req.params.id], (err, complaint) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!complaint) return res.status(404).json({ error: '申诉单不存在' });
    if (complaint.status !== 'pending') {
      return res.status(400).json({ error: '只能修改待处理的申诉单' });
    }
    
    db.run(`UPDATE complaints SET 
      user_name = ?, user_phone = ?, complaint_content = ?,
      expected_quantity = ?, expected_weight = ?, actual_quantity = ?, actual_weight = ?,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [user_name, user_phone, complaint_content, expected_quantity, expected_weight, 
      actual_quantity, actual_weight, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: '申诉单已更新' });
      }
    );
  });
});

app.post('/api/complaints/:id/confirm', (req, res) => {
  const { handler, handle_result, handle_notes } = req.body;
  
  db.get(`SELECT * FROM complaints WHERE id = ?`, [req.params.id], (err, complaint) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!complaint) return res.status(404).json({ error: '申诉单不存在' });
    
    db.run(`UPDATE complaints SET 
      status = 'confirmed', handler = ?, handle_time = CURRENT_TIMESTAMP,
      handle_result = ?, handle_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [handler, handle_result, handle_notes, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        updateStatistics(complaint.batch_id, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: '申诉已确认' });
        });
      }
    );
  });
});

app.post('/api/complaints/:id/reject', (req, res) => {
  const { handler, handle_result, handle_notes } = req.body;
  
  db.get(`SELECT * FROM complaints WHERE id = ?`, [req.params.id], (err, complaint) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!complaint) return res.status(404).json({ error: '申诉单不存在' });
    
    db.run(`UPDATE complaints SET 
      status = 'rejected', handler = ?, handle_time = CURRENT_TIMESTAMP,
      handle_result = ?, handle_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [handler, handle_result, handle_notes, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        updateStatistics(complaint.batch_id, (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: '申诉已拒绝' });
        });
      }
    );
  });
});

app.get('/api/complaints', (req, res) => {
  db.all(`SELECT c.*, o.product_name, o.supplier FROM complaints c 
    LEFT JOIN order_batches o ON c.batch_id = o.id 
    ORDER BY c.created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/statistics', (req, res) => {
  db.all(`SELECT s.*, o.product_name, o.supplier, o.arrival_date FROM statistics s
    LEFT JOIN order_batches o ON s.batch_id = o.id
    ORDER BY s.updated_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/export', (req, res) => {
  const { type } = req.query;
  
  const exportData = {};
  
  db.all(`SELECT * FROM order_batches ORDER BY arrival_date DESC`, (err, batches) => {
    if (err) return res.status(500).json({ error: err.message });
    exportData.batches = batches;
    
    db.all(`SELECT * FROM weighing_records ORDER BY created_at DESC`, (err, weighing) => {
      if (err) return res.status(500).json({ error: err.message });
      exportData.weighing = weighing;
      
      db.all(`SELECT * FROM complaints ORDER BY created_at DESC`, (err, complaints) => {
        if (err) return res.status(500).json({ error: err.message });
        exportData.complaints = complaints;
        
        db.all(`SELECT * FROM statistics ORDER BY updated_at DESC`, (err, stats) => {
          if (err) return res.status(500).json({ error: err.message });
          exportData.statistics = stats;
          
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData.batches), '订单批次');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData.weighing), '称重记录');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData.complaints), '申诉单');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData.statistics), '统计数据');
          
          const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=complaint_export_${Date.now()}.xlsx`);
          res.send(buffer);
        });
      });
    });
  });
});

const sampleBatches = [
  {
    batch_no: 'BATCH20260510001',
    supplier: '鲜达生鲜供应链',
    product_name: '山东大樱桃',
    order_quantity: 50,
    order_weight: 50,
    unit: '斤',
    arrival_date: '2026-05-10'
  },
  {
    batch_no: 'BATCH20260510002',
    supplier: '绿源蔬菜基地',
    product_name: '有机西红柿',
    order_quantity: 80,
    order_weight: 80,
    unit: '斤',
    arrival_date: '2026-05-10'
  },
  {
    batch_no: 'BATCH20260510003',
    supplier: '海丰水产',
    product_name: '鲜活基围虾',
    order_quantity: 30,
    order_weight: 30,
    unit: '斤',
    arrival_date: '2026-05-10'
  }
];

const sampleWeighing = [
  {
    batch_no: 'BATCH20260510001',
    group_leader: '张团长',
    weighing_time: '2026-05-10 08:30:00',
    actual_quantity: 48,
    actual_weight: 47.5,
    notes: '包装破损，部分樱桃压坏'
  },
  {
    batch_no: 'BATCH20260510002',
    group_leader: '李团长',
    weighing_time: '2026-05-10 09:00:00',
    actual_quantity: 80,
    actual_weight: 79.2,
    notes: '西红柿新鲜，但水分流失'
  },
  {
    batch_no: 'BATCH20260510003',
    group_leader: '王团长',
    weighing_time: '2026-05-10 09:30:00',
    actual_quantity: 28,
    actual_weight: 27.8,
    notes: '部分虾死亡，已剔除'
  }
];

const sampleComplaints = [
  {
    batch_no: 'BATCH20260510001',
    user_name: '用户A',
    user_phone: '13800138001',
    complaint_time: '2026-05-10 10:00:00',
    complaint_type: '缺斤少两',
    complaint_content: '购买5斤樱桃，实际称重只有4.8斤',
    expected_quantity: 5,
    expected_weight: 5,
    actual_quantity: 4.8,
    actual_weight: 4.8
  },
  {
    batch_no: 'BATCH20260510001',
    user_name: '用户B',
    user_phone: '13800138002',
    complaint_time: '2026-05-10 10:30:00',
    complaint_type: '质量问题',
    complaint_content: '收到的樱桃有压坏现象',
    expected_quantity: 3,
    expected_weight: 3,
    actual_quantity: 3,
    actual_weight: 2.9
  },
  {
    batch_no: 'BATCH20260510003',
    user_name: '用户C',
    user_phone: '13800138003',
    complaint_time: '2026-05-10 11:00:00',
    complaint_type: '缺斤少两',
    complaint_content: '购买2斤虾，实际只有1.8斤',
    expected_quantity: 2,
    expected_weight: 2,
    actual_quantity: 1.8,
    actual_weight: 1.8
  }
];

app.post('/api/sample-data', (req, res) => {
  const results = { batches: [], weighing: [], complaints: [] };
  
  const processBatches = (index) => {
    if (index >= sampleBatches.length) {
      return processWeighing(0);
    }
    
    const batch = sampleBatches[index];
    db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [batch.batch_no], (err, existing) => {
      if (err) {
        results.batches.push({ batch_no: batch.batch_no, error: err.message });
        return processBatches(index + 1);
      }
      
      if (existing) {
        results.batches.push({ batch_no: batch.batch_no, status: 'skipped' });
        return processBatches(index + 1);
      }
      
      db.run(`INSERT INTO order_batches (batch_no, supplier, product_name, order_quantity, order_weight, unit, arrival_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [batch.batch_no, batch.supplier, batch.product_name, batch.order_quantity, batch.order_weight, batch.unit, batch.arrival_date],
        (err) => {
          if (err) {
            results.batches.push({ batch_no: batch.batch_no, error: err.message });
          } else {
            results.batches.push({ batch_no: batch.batch_no, status: 'added' });
          }
          processBatches(index + 1);
        }
      );
    });
  };
  
  const processWeighing = (index) => {
    if (index >= sampleWeighing.length) {
      return processComplaints(0);
    }
    
    const w = sampleWeighing[index];
    db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [w.batch_no], (err, batch) => {
      if (err) {
        results.weighing.push({ batch_no: w.batch_no, error: err.message });
        return processWeighing(index + 1);
      }
      if (!batch) {
        results.weighing.push({ batch_no: w.batch_no, error: '批次不存在' });
        return processWeighing(index + 1);
      }
      
      const difference_quantity = w.actual_quantity - batch.order_quantity;
      const difference_weight = w.actual_weight - batch.order_weight;
      
      db.get(`SELECT * FROM weighing_records WHERE batch_id = ? AND group_leader = ?`, [batch.id, w.group_leader], (err, existing) => {
        if (existing) {
          results.weighing.push({ batch_no: w.batch_no, status: 'skipped' });
          updateStatistics(batch.id, () => processWeighing(index + 1));
          return;
        }
        
        db.run(`INSERT INTO weighing_records 
          (batch_id, batch_no, group_leader, weighing_time, actual_quantity, actual_weight, 
          difference_quantity, difference_weight, notes) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [batch.id, w.batch_no, w.group_leader, w.weighing_time, w.actual_quantity, w.actual_weight, 
          difference_quantity, difference_weight, w.notes],
          (err) => {
            if (err) {
              results.weighing.push({ batch_no: w.batch_no, error: err.message });
            } else {
              results.weighing.push({ batch_no: w.batch_no, status: 'added' });
              updateStatistics(batch.id, () => {});
            }
            processWeighing(index + 1);
          }
        );
      });
    });
  };
  
  const processComplaints = (index) => {
    if (index >= sampleComplaints.length) {
      return res.json(results);
    }
    
    const c = sampleComplaints[index];
    db.get(`SELECT * FROM order_batches WHERE batch_no = ?`, [c.batch_no], (err, batch) => {
      if (err) {
        results.complaints.push({ batch_no: c.batch_no, error: err.message });
        return processComplaints(index + 1);
      }
      if (!batch) {
        results.complaints.push({ batch_no: c.batch_no, error: '批次不存在' });
        return processComplaints(index + 1);
      }
      
      db.get(`SELECT * FROM complaints WHERE batch_id = ? AND user_name = ? AND complaint_content = ?`,
        [batch.id, c.user_name, c.complaint_content], (err, existing) => {
          if (err) {
            results.complaints.push({ batch_no: c.batch_no, error: err.message });
            return processComplaints(index + 1);
          }
          
          if (existing) {
            results.complaints.push({ batch_no: c.batch_no, status: 'skipped' });
            return processComplaints(index + 1);
          }
          
          const complaint_no = generateComplaintNo();
          
          db.run(`INSERT INTO complaints 
            (complaint_no, batch_id, batch_no, user_name, user_phone, complaint_time, 
            complaint_type, complaint_content, expected_quantity, expected_weight, actual_quantity, actual_weight)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [complaint_no, batch.id, c.batch_no, c.user_name, c.user_phone, c.complaint_time, 
            c.complaint_type, c.complaint_content, c.expected_quantity, c.expected_weight, c.actual_quantity, c.actual_weight],
            (err) => {
              if (err) {
                results.complaints.push({ batch_no: c.batch_no, error: err.message });
              } else {
                results.complaints.push({ batch_no: c.batch_no, status: 'added', complaint_no });
                updateStatistics(batch.id, () => {});
              }
              processComplaints(index + 1);
            }
          );
        }
      );
    });
  };
  
  processBatches(0);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});