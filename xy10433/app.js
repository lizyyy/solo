const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = 3002;

app.use(bodyParser.json());

function getCurrentDate() {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace('T', ' ');
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

app.post('/api/assets', (req, res) => {
  try {
    const { asset_code, name, category, department, total_quantity } = req.body;
    
    if (!asset_code || !name || !category || !department) {
      return res.status(400).json({ error: '缺少必要字段' });
    }

    const existing = db.getAssetByCode(asset_code);
    if (existing) {
      return res.status(400).json({ error: '资产编码已存在' });
    }

    const quantity = total_quantity || 1;
    const result = db.createAsset({
      asset_code,
      name,
      category,
      department,
      total_quantity: quantity,
      available_quantity: quantity,
      status: 'available'
    });

    res.status(201).json({ id: result.lastInsertRowid, message: '资产建档成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assets', (req, res) => {
  try {
    const { category, department } = req.query;
    const assets = db.getAssets({ category, department });
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrow-requests', (req, res) => {
  try {
    const { asset_code, request_department, applicant, purpose, request_quantity, expected_return_date } = req.body;
    
    if (!asset_code || !request_department || !applicant || !purpose || !expected_return_date) {
      return res.status(400).json({ error: '缺少必要字段' });
    }

    const asset = db.getAssetByCode(asset_code);
    if (!asset) {
      return res.status(404).json({ error: '资产不存在' });
    }

    const qty = request_quantity || 1;
    if (asset.available_quantity < qty) {
      return res.status(400).json({ error: '可用数量不足' });
    }

    const existingPending = db.getBorrowRequests({
      asset_code,
      request_department,
      status: 'pending'
    });

    if (existingPending.length > 0) {
      return res.status(400).json({ 
        error: '该部门已有待审批的相同资产借调申请，请先处理后再申请',
        existing_request_id: existingPending[0].id
      });
    }

    const result = db.createBorrowRequest({
      asset_id: asset.id,
      asset_code,
      request_department,
      applicant,
      purpose,
      request_quantity: qty,
      expected_return_date
    });

    res.status(201).json({ id: result.lastInsertRowid, message: '借调申请已提交' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/borrow-requests', (req, res) => {
  try {
    const { status, department } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (department) filters.request_department = department;
    
    const requests = db.getBorrowRequests(filters);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrow-requests/:id/approve', (req, res) => {
  try {
    const { approved_by } = req.body;
    const requestId = parseInt(req.params.id);

    const request = db.getBorrowRequestById(requestId);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: '申请已处理' });
    }

    const asset = db.getAssetById(request.asset_id);
    if (!asset) {
      return res.status(404).json({ error: '资产不存在' });
    }

    if (asset.available_quantity < request.request_quantity) {
      return res.status(400).json({ error: '可用数量不足，无法借出' });
    }

    const currentActiveBorrow = db.getBorrowRecords({
      asset_id: asset.id,
      status: 'borrowed'
    });

    if (currentActiveBorrow.length > 0) {
      return res.status(400).json({ error: '该资产已被借出，无法重复借出' });
    }

    const now = getCurrentDate();
    
    db.transaction(() => {
      const newAvailable = asset.available_quantity - request.request_quantity;
      db.updateAsset(asset.id, {
        available_quantity: newAvailable,
        status: newAvailable === 0 ? 'borrowed' : asset.status
      });

      db.updateBorrowRequest(requestId, {
        status: 'approved',
        approved_at: now,
        approved_by: approved_by || 'admin'
      });

      db.createBorrowRecord({
        request_id: requestId,
        asset_id: asset.id,
        asset_code: request.asset_code,
        request_department: request.request_department,
        applicant: request.applicant,
        borrow_quantity: request.request_quantity,
        expected_return_date: request.expected_return_date
      });
    });

    res.json({ message: '审批通过，资产已借出' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrow-requests/:id/reject', (req, res) => {
  try {
    const requestId = parseInt(req.params.id);

    const request = db.getBorrowRequestById(requestId);
    if (!request) {
      return res.status(404).json({ error: '申请不存在' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: '申请已处理' });
    }

    db.updateBorrowRequest(requestId, { status: 'rejected' });
    res.json({ message: '申请已拒绝' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrow-records/:id/return', (req, res) => {
  try {
    const { return_quantity, accept_remark } = req.body;
    const recordId = parseInt(req.params.id);

    const record = db.getBorrowRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: '借调记录不存在' });
    }

    if (record.status !== 'borrowed') {
      return res.status(400).json({ error: '该记录已归还' });
    }

    const qty = return_quantity || record.borrow_quantity;
    if (qty !== record.borrow_quantity) {
      return res.status(400).json({ 
        error: `归还数量(${qty})与借出数量(${record.borrow_quantity})不一致`,
        expected_quantity: record.borrow_quantity
      });
    }

    const pendingDamage = db.getDamageRecords({
      record_id: recordId,
      status: 'pending_compensation'
    });

    if (pendingDamage.length > 0) {
      return res.status(400).json({ 
        error: '存在未处理的损坏记录，请先处理赔偿后再归还',
        damage_id: pendingDamage[0].id
      });
    }

    const now = getCurrentDate();
    
    db.transaction(() => {
      const asset = db.getAssetById(record.asset_id);
      const newAvailable = asset.available_quantity + qty;
      db.updateAsset(record.asset_id, {
        available_quantity: newAvailable,
        status: 'available'
      });

      db.updateBorrowRecord(recordId, {
        status: 'returned',
        actual_return_date: now,
        accept_remark: accept_remark || null
      });
    });

    res.json({ message: '归还验收成功，验收结论已记录' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/borrow-records', (req, res) => {
  try {
    const { status, department, asset_code } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (department) filters.request_department = department;
    if (asset_code) filters.asset_code = asset_code;
    
    const records = db.getBorrowRecords(filters);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/damage-records', (req, res) => {
  try {
    const { record_id, damage_description, damage_quantity, estimated_cost } = req.body;
    
    if (!record_id || !damage_description) {
      return res.status(400).json({ error: '缺少必要字段' });
    }

    const record = db.getBorrowRecordById(parseInt(record_id));
    if (!record) {
      return res.status(404).json({ error: '借调记录不存在' });
    }

    if (record.status === 'returned') {
      return res.status(400).json({ error: '资产已归还，无法登记损坏' });
    }

    const existingDamage = db.getDamageRecords({
      record_id: parseInt(record_id),
      status: 'pending_compensation'
    });

    if (existingDamage.length > 0) {
      return res.status(400).json({ 
        error: '该借调记录已有待处理的损坏记录',
        existing_damage_id: existingDamage[0].id
      });
    }

    const result = db.createDamageRecord({
      record_id: parseInt(record_id),
      asset_id: record.asset_id,
      asset_code: record.asset_code,
      damage_description,
      damage_quantity: damage_quantity || 1,
      estimated_cost: estimated_cost || 0
    });

    res.status(201).json({ id: result.lastInsertRowid, message: '损坏已登记' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/damage-records/:id/compensate', (req, res) => {
  try {
    const { compensation_amount, compensator } = req.body;
    const damageId = parseInt(req.params.id);

    const damage = db.getDamageRecordById(damageId);
    if (!damage) {
      return res.status(404).json({ error: '损坏记录不存在' });
    }

    if (damage.status !== 'pending_compensation') {
      return res.status(400).json({ error: '该损坏记录已处理' });
    }

    const now = getCurrentDate();
    db.updateDamageRecord(damageId, {
      status: 'compensated',
      compensation_amount: compensation_amount || damage.estimated_cost,
      compensator: compensator || 'unknown',
      compensated_at: now
    });

    res.json({ message: '赔偿已确认' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/damage-records', (req, res) => {
  try {
    const { status, asset_code } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (asset_code) filters.asset_code = asset_code;
    
    const records = db.getDamageRecords(filters);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/occupancy', (req, res) => {
  try {
    const { department, category } = req.query;
    
    const filters = {};
    if (department) filters.department = department;
    if (category) filters.category = category;
    
    const assets = db.getAssets(filters);
    
    const borrowedFilters = { status: 'borrowed' };
    if (department) borrowedFilters.request_department = department;
    const borrowedRecords = db.getBorrowRecords(borrowedFilters);
    
    const enrichedRecords = borrowedRecords.map(r => {
      const asset = db.getAssetById(r.asset_id);
      return {
        ...r,
        asset_name: asset ? asset.name : null,
        asset_category: asset ? asset.category : null,
        asset_department: asset ? asset.department : null
      };
    });
    
    res.json({
      total_assets: assets.length,
      total_quantity: assets.reduce((sum, a) => sum + a.total_quantity, 0),
      available_quantity: assets.reduce((sum, a) => sum + a.available_quantity, 0),
      borrowed_quantity: borrowedRecords.reduce((sum, r) => sum + r.borrow_quantity, 0),
      borrowed_records: enrichedRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/overdue', (req, res) => {
  try {
    const { department } = req.query;
    const today = getToday();
    
    const filters = { status: 'borrowed' };
    if (department) filters.request_department = department;
    
    const borrowedRecords = db.getBorrowRecords(filters);
    
    const overdueRecords = borrowedRecords
      .filter(r => r.expected_return_date < today)
      .map(r => {
        const asset = db.getAssetById(r.asset_id);
        const expected = new Date(r.expected_return_date);
        const now = new Date();
        const diffTime = Math.abs(now - expected);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          ...r,
          asset_name: asset ? asset.name : null,
          asset_category: asset ? asset.category : null,
          asset_department: asset ? asset.department : null,
          overdue_days: diffDays
        };
      })
      .sort((a, b) => b.overdue_days - a.overdue_days);
    
    res.json({
      count: overdueRecords.length,
      records: overdueRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/damage-cost', (req, res) => {
  try {
    const { department, status } = req.query;
    
    let damageRecords = db.getDamageRecords(status ? { status } : {});
    
    const enrichedRecords = damageRecords.map(r => {
      const asset = db.getAssetById(r.asset_id);
      const borrowRecord = db.getBorrowRecordById(r.record_id);
      return {
        ...r,
        asset_name: asset ? asset.name : null,
        asset_category: asset ? asset.category : null,
        request_department: borrowRecord ? borrowRecord.request_department : null,
        applicant: borrowRecord ? borrowRecord.applicant : null
      };
    });
    
    let filteredRecords = enrichedRecords;
    if (department) {
      filteredRecords = enrichedRecords.filter(r => r.request_department === department);
    }
    
    const totalEstimated = filteredRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);
    const totalCompensated = filteredRecords
      .filter(r => r.status === 'compensated')
      .reduce((sum, r) => sum + (r.compensation_amount || 0), 0);
    
    res.json({
      total_estimated_cost: totalEstimated,
      total_compensated_amount: totalCompensated,
      pending_count: filteredRecords.filter(r => r.status === 'pending_compensation').length,
      records: filteredRecords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/history', (req, res) => {
  try {
    const { asset_code } = req.query;
    
    if (!asset_code) {
      return res.status(400).json({ error: '请指定资产编码' });
    }
    
    const borrowRecords = db.getBorrowRecords({ asset_code }).map(r => ({
      id: r.id,
      record_type: 'borrow',
      asset_code: r.asset_code,
      request_department: r.request_department,
      applicant: r.applicant,
      quantity: r.borrow_quantity,
      event_date: r.borrow_date,
      expected_return_date: r.expected_return_date,
      actual_return_date: r.actual_return_date,
      status: r.status,
      remark: r.accept_remark,
      created_at: r.created_at
    }));
    
    const damageRecords = db.getDamageRecords({ asset_code }).map(r => ({
      id: r.id,
      record_type: 'damage',
      asset_code: r.asset_code,
      request_department: '',
      applicant: '',
      quantity: r.damage_quantity,
      event_date: r.created_at,
      expected_return_date: '',
      actual_return_date: '',
      status: r.status,
      remark: r.damage_description,
      created_at: r.created_at
    }));
    
    const history = [...borrowRecords, ...damageRecords]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({
      asset_code,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`内部资产借调API服务运行在 http://localhost:${PORT}`);
});
