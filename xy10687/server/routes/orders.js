const express = require('express');
const { v4: uuidv4 } = require('uuid');
const xlsx = require('xlsx');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads') });

const ORDER_STATUSES = {
  PENDING: '待派单',
  ASSIGNED: '已派单',
  EN_ROUTE: '技师出发',
  ARRIVED: '已到达',
  IN_PROGRESS: '维修中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  INVENTORY_ISSUE: '库存异常'
};

function generateOrderNo() {
  const db = getDb();
  const date = new Date();
  const prefix = 'RD' + date.getFullYear().toString().slice(-2) +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM orders WHERE orderNo LIKE ?', [prefix + '%'], (err, row) => {
      if (err) reject(err);
      else resolve(prefix + (row.count + 1).toString().padStart(4, '0'));
    });
  });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function addTimeline(orderId, status, previousStatus, action, reason, operator, changes = {}) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = Date.now();
    db.run(
      'INSERT INTO order_timeline (id, orderId, status, previousStatus, action, reason, operator, changes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, orderId, status, previousStatus, action, reason, operator, JSON.stringify(changes), now],
      (err) => err ? reject(err) : resolve(id)
    );
  });
}

router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { requestId, ownerName, ownerPhone, ownerLocation, ownerLocationLat, ownerLocationLng, faultType, faultDescription, createdBy } = req.body;

    if (requestId) {
      const existing = await new Promise((resolve) => {
        db.get('SELECT * FROM idempotency WHERE requestId = ?', [requestId], (err, row) => resolve(row));
      });
      if (existing) {
        return res.json(JSON.parse(existing.result));
      }
    }

    const orderNo = await generateOrderNo();
    const orderId = uuidv4();
    const now = Date.now();

    db.run(
      'INSERT INTO orders (id, orderNo, ownerName, ownerPhone, ownerLocation, ownerLocationLat, ownerLocationLng, faultType, faultDescription, status, createdAt, updatedAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, orderNo, ownerName, ownerPhone, ownerLocation, ownerLocationLat, ownerLocationLng, faultType, faultDescription, ORDER_STATUSES.PENDING, now, now, createdBy || '系统'],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        await addTimeline(orderId, ORDER_STATUSES.PENDING, null, '创建工单', '车主发起救援请求', createdBy || '系统');
        
        const result = { success: true, orderId, orderNo };
        
        if (requestId) {
          db.run('INSERT INTO idempotency (id, requestId, orderId, result, createdAt) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), requestId, orderId, JSON.stringify(result), now]);
        }
        
        res.json(result);
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  const db = getDb();
  const { status, responsiblePerson, startDate, endDate } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (responsiblePerson) {
    query += ' AND responsiblePerson = ?';
    params.push(responsiblePerson);
  }
  if (startDate) {
    query += ' AND createdAt >= ?';
    params.push(parseInt(startDate));
  }
  if (endDate) {
    query += ' AND createdAt <= ?';
    params.push(parseInt(endDate));
  }

  query += ' ORDER BY createdAt DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: '工单不存在' });
    
    db.all('SELECT * FROM order_timeline WHERE orderId = ? ORDER BY createdAt ASC', [req.params.id], (err, timeline) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...order, timeline });
    });
  });
});

router.put('/:id/assign', (req, res) => {
  const db = getDb();
  const { technicianId, operator } = req.body;
  
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: '工单不存在' });
    if (order.status !== ORDER_STATUSES.PENDING) {
      return res.status(400).json({ error: '只有待派单状态才能派单' });
    }

    db.get('SELECT * FROM technicians WHERE id = ?', [technicianId], async (err, tech) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!tech) return res.status(404).json({ error: '技师不存在' });

      const distance = calculateDistance(
        order.ownerLocationLat, order.ownerLocationLng,
        tech.currentLat, tech.currentLng
      );
      const estimatedArrivalTime = Math.round(distance * 5);

      const changes = {
        technicianId: { before: null, after: technicianId },
        technicianName: { before: null, after: tech.name },
        technicianLocation: { before: null, after: tech.currentLocation },
        technicianLocationLat: { before: null, after: tech.currentLat },
        technicianLocationLng: { before: null, after: tech.currentLng },
        estimatedArrivalTime: { before: null, after: estimatedArrivalTime },
        responsiblePerson: { before: null, after: tech.name },
        status: { before: order.status, after: ORDER_STATUSES.ASSIGNED }
      };

      const now = Date.now();
      db.run(
        'UPDATE orders SET technicianId = ?, technicianName = ?, technicianLocation = ?, technicianLocationLat = ?, technicianLocationLng = ?, estimatedArrivalTime = ?, responsiblePerson = ?, status = ?, updatedAt = ? WHERE id = ?',
        [technicianId, tech.name, tech.currentLocation, tech.currentLat, tech.currentLng, estimatedArrivalTime, tech.name, ORDER_STATUSES.ASSIGNED, now, req.params.id],
        async (err) => {
          if (err) return res.status(500).json({ error: err.message });
          await addTimeline(req.params.id, ORDER_STATUSES.ASSIGNED, order.status, '派单', `分配技师 ${tech.name}，预计 ${estimatedArrivalTime} 分钟到达`, operator || '系统', changes);
          res.json({ success: true, estimatedArrivalTime });
        }
      );
    });
  });
});

router.put('/:id/advance', (req, res) => {
  const db = getDb();
  const { status, operator, reason } = req.body;
  const validTransitions = {
    [ORDER_STATUSES.ASSIGNED]: [ORDER_STATUSES.EN_ROUTE, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.EN_ROUTE]: [ORDER_STATUSES.ARRIVED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.ARRIVED]: [ORDER_STATUSES.IN_PROGRESS, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.IN_PROGRESS]: [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED, ORDER_STATUSES.INVENTORY_ISSUE]
  };

  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], async (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: '工单不存在' });

    const allowed = validTransitions[order.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({ error: `无法从 ${order.status} 转换到 ${status}` });
    }

    const changes = { status: { before: order.status, after: status } };
    const now = Date.now();

    if (status === ORDER_STATUSES.ARRIVED) {
      changes.actualArrivalTime = { before: null, after: now };
    }

    let updateQuery = 'UPDATE orders SET status = ?, updatedAt = ?';
    const params = [status, now];

    if (status === ORDER_STATUSES.ARRIVED) {
      updateQuery += ', actualArrivalTime = ?';
      params.push(now);
    }

    if (status === ORDER_STATUSES.CANCELLED) {
      const { cancelReason } = req.body;
      updateQuery += ', cancelReason = ?';
      params.push(cancelReason || reason);
      changes.cancelReason = { before: null, after: cancelReason || reason };
    }

    updateQuery += ' WHERE id = ?';
    params.push(req.params.id);

    db.run(updateQuery, params, async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const actions = {
        [ORDER_STATUSES.EN_ROUTE]: '技师出发',
        [ORDER_STATUSES.ARRIVED]: '技师到达',
        [ORDER_STATUSES.IN_PROGRESS]: '开始维修',
        [ORDER_STATUSES.COMPLETED]: '完成维修',
        [ORDER_STATUSES.CANCELLED]: '取消工单',
        [ORDER_STATUSES.INVENTORY_ISSUE]: '库存异常'
      };

      await addTimeline(req.params.id, status, order.status, actions[status] || '状态变更', reason || actions[status], operator || '系统', changes);
      res.json({ success: true });
    });
  });
});

router.put('/:id/correct', (req, res) => {
  const db = getDb();
  const { operator, ...updates } = req.body;
  const allowedFields = ['ownerName', 'ownerPhone', 'ownerLocation', 'ownerLocationLat', 'ownerLocationLng', 'faultType', 'faultDescription', 'technicianLocation', 'technicianLocationLat', 'technicianLocationLng'];

  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], async (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: '工单不存在' });

    const changes = {};
    const updateParts = [];
    const params = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined && updates[field] !== order[field]) {
        changes[field] = { before: order[field], after: updates[field] };
        updateParts.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }

    if (updateParts.length === 0) {
      return res.json({ success: true, message: '没有需要修改的内容' });
    }

    updateParts.push('updatedAt = ?');
    params.push(Date.now());
    params.push(req.params.id);

    db.run(`UPDATE orders SET ${updateParts.join(', ')} WHERE id = ?`, params, async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      await addTimeline(req.params.id, order.status, order.status, '修正信息', '修正工单信息', operator || '系统', changes);
      res.json({ success: true });
    });
  });
});

router.post('/import', upload.single('file'), async (req, res) => {
  const results = [];
  const filePath = req.file.path;
  const { operator } = req.body;

  if (req.file.originalname.endsWith('.csv')) {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        await processImport(results, operator, res);
        fs.unlinkSync(filePath);
      });
  } else {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    await processImport(data, operator, res);
    fs.unlinkSync(filePath);
  }
});

async function processImport(data, operator, res) {
  const db = getDb();
  const success = [];
  const failed = [];

  for (const row of data) {
    try {
      const orderNo = await generateOrderNo();
      const orderId = uuidv4();
      const now = Date.now();

      db.run(
        'INSERT INTO orders (id, orderNo, ownerName, ownerPhone, ownerLocation, ownerLocationLat, ownerLocationLng, faultType, faultDescription, status, createdAt, updatedAt, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, orderNo, row['车主姓名'] || row.ownerName, row['车主电话'] || row.ownerPhone, row['车主位置'] || row.ownerLocation, parseFloat(row['纬度'] || row.ownerLocationLat || 0), parseFloat(row['经度'] || row.ownerLocationLng || 0), row['故障类型'] || row.faultType, row['故障描述'] || row.faultDescription, ORDER_STATUSES.PENDING, now, now, operator || '批量导入'],
        async (err) => {
          if (!err) {
            await addTimeline(orderId, ORDER_STATUSES.PENDING, null, '创建工单', '批量导入', operator || '批量导入');
          }
        }
      );
      success.push({ orderNo, ...row });
    } catch (error) {
      failed.push({ row, error: error.message });
    }
  }

  res.json({ success: success.length, failed: failed.length, failedItems: failed });
}

router.get('/export/download', (req, res) => {
  const db = getDb();
  const { responsiblePerson, startDate, endDate } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (responsiblePerson) {
    query += ' AND responsiblePerson = ?';
    params.push(responsiblePerson);
  }
  if (startDate) {
    query += ' AND createdAt >= ?';
    params.push(parseInt(startDate));
  }
  if (endDate) {
    query += ' AND createdAt <= ?';
    params.push(parseInt(endDate));
  }

  query += ' ORDER BY createdAt DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const exportData = rows.map(row => ({
      '工单号': row.orderNo,
      '车主姓名': row.ownerName,
      '车主电话': row.ownerPhone,
      '车主位置': row.ownerLocation,
      '故障类型': row.faultType,
      '技师姓名': row.technicianName,
      '预计到达(分钟)': row.estimatedArrivalTime,
      '实际到达时间': row.actualArrivalTime ? new Date(row.actualArrivalTime).toLocaleString() : '',
      '状态': row.status,
      '责任人': row.responsiblePerson,
      '创建时间': new Date(row.createdAt).toLocaleString(),
      '更新时间': new Date(row.updatedAt).toLocaleString()
    }));

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '工单数据');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
    res.send(buffer);
  });
});

router.get('/:id/timeline', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM order_timeline WHERE orderId = ? ORDER BY createdAt ASC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({
      ...row,
      changes: JSON.parse(row.changes || '{}')
    })));
  });
});

module.exports = router;
