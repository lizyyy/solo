const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { db, prepare } = require('./database');
const { validateTransferRequest } = require('./validation');
const { calculateTransportAllowance, calculateBatchAllowance } = require('./allowance');

router.get('/stores', (req, res) => {
  const stores = [...db.stores].sort((a, b) => a.name.localeCompare(b.name));
  res.json({ stores });
});

router.get('/skills', (req, res) => {
  const skills = [...db.skills].sort((a, b) => a.name.localeCompare(b.name));
  res.json({ skills });
});

router.get('/employees', (req, res) => {
  const { storeId } = req.query;
  
  let employees = [...db.employees];
  
  if (storeId) {
    employees = employees.filter(e => e.original_store_id === parseInt(storeId));
  }
  
  employees = employees.sort((a, b) => a.name.localeCompare(b.name));
  
  employees.forEach(emp => {
    const store = db.stores.find(s => s.id === emp.original_store_id);
    emp.original_store_name = store?.name;
    
    emp.skills = db.employeeSkills
      .filter(es => es.employee_id === emp.id)
      .map(es => {
        const skill = db.skills.find(s => s.id === es.skill_id);
        return {
          id: es.skill_id,
          name: skill?.name,
          proficiency_level: es.proficiency_level
        };
      });
  });
  
  res.json({ employees });
});

router.get('/schedules', (req, res) => {
  const { startDate, endDate, storeId } = req.query;
  
  let schedules = [...db.schedules];
  
  if (startDate && endDate) {
    schedules = schedules.filter(s => s.date >= startDate && s.date <= endDate);
  }
  if (storeId) {
    schedules = schedules.filter(s => s.store_id === parseInt(storeId));
  }
  
  schedules = schedules.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start_time.localeCompare(b.start_time);
  });
  
  schedules = schedules.map(s => {
    const employee = db.employees.find(e => e.id === s.employee_id);
    const store = db.stores.find(st => st.id === s.store_id);
    const originalStore = db.stores.find(os => os.id === employee?.original_store_id);
    
    return {
      ...s,
      employee_name: employee?.name,
      store_name: store?.name,
      original_store_id: employee?.original_store_id,
      original_store_name: originalStore?.name
    };
  });
  
  res.json({ schedules });
});

router.get('/transfer-requests', (req, res) => {
  const { status, startDate, endDate, employeeId } = req.query;
  
  let requests = [...db.transferRequests];
  
  if (status) {
    requests = requests.filter(r => r.status === status);
  }
  if (startDate && endDate) {
    requests = requests.filter(r => r.date >= startDate && r.date <= endDate);
  }
  if (employeeId) {
    requests = requests.filter(r => r.employee_id === parseInt(employeeId));
  }
  
  requests = requests.sort((a, b) => {
    if (b.created_at && a.created_at) {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return b.id - a.id;
  });
  
  requests = requests.map(r => {
    const employee = db.employees.find(e => e.id === r.employee_id);
    const fromStore = db.stores.find(s => s.id === r.from_store_id);
    const toStore = db.stores.find(s => s.id === r.to_store_id);
    const skill = db.skills.find(s => s.id === r.skill_required);
    const originalStore = db.stores.find(s => s.id === employee?.original_store_id);
    
    return {
      ...r,
      employee_name: employee?.name,
      from_store_name: fromStore?.name,
      to_store_name: toStore?.name,
      skill_name: skill?.name,
      original_store_name: originalStore?.name
    };
  });
  
  res.json({ requests });
});

router.post('/transfer-requests/validate', (req, res) => {
  const validation = validateTransferRequest(req.body);
  res.json(validation);
});

router.post('/transfer-requests', (req, res) => {
  const validation = validateTransferRequest(req.body);
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: '验证失败',
      errors: validation.errors,
      warnings: validation.warnings
    });
  }
  
  const allowance = calculateTransportAllowance(
    req.body.from_store_id,
    req.body.to_store_id,
    req.body.date,
    req.body.start_time,
    req.body.end_time
  );
  
  const transferRequest = {
    employee_id: req.body.employee_id,
    from_store_id: req.body.from_store_id,
    to_store_id: req.body.to_store_id,
    date: req.body.date,
    start_time: req.body.start_time,
    end_time: req.body.end_time,
    skill_required: req.body.skill_required || null,
    reason: req.body.reason,
    status: 'pending',
    transport_allowance: allowance.total,
    approver: null,
    approval_comment: null,
    approved_at: null
  };
  
  const result = prepare('transferRequests').insert(transferRequest);
  
  res.json({
    success: true,
    id: result.lastInsertRowid,
    allowance,
    warnings: validation.warnings
  });
});

router.put('/transfer-requests/:id/approve', (req, res) => {
  const { id } = req.params;
  const { approver, comment } = req.body;
  
  const existing = db.transferRequests.find(r => r.id === parseInt(id));
  if (!existing) {
    return res.status(404).json({ success: false, message: '申请不存在' });
  }
  
  if (existing.status !== 'pending') {
    return res.status(400).json({ success: false, message: '只有待审批的申请可以审批' });
  }
  
  const validation = validateTransferRequest({
    employee_id: existing.employee_id,
    from_store_id: existing.from_store_id,
    to_store_id: existing.to_store_id,
    date: existing.date,
    start_time: existing.start_time,
    end_time: existing.end_time,
    skill_required: existing.skill_required
  }, parseInt(id));
  
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: '审批失败，存在冲突',
      errors: validation.errors
    });
  }
  
  prepare('transferRequests').update(parseInt(id), {
    status: 'approved',
    approver: approver || '系统管理员',
    approval_comment: comment || '',
    approved_at: new Date().toISOString()
  });
  
  prepare('schedules').insert({
    employee_id: existing.employee_id,
    store_id: existing.to_store_id,
    date: existing.date,
    start_time: existing.start_time,
    end_time: existing.end_time,
    shift_type: 'transfer',
    status: 'active'
  });
  
  res.json({ success: true, message: '审批通过' });
});

router.put('/transfer-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { approver, comment } = req.body;
  
  const existing = db.transferRequests.find(r => r.id === parseInt(id));
  if (!existing) {
    return res.status(404).json({ success: false, message: '申请不存在' });
  }
  
  prepare('transferRequests').update(parseInt(id), {
    status: 'rejected',
    approver: approver || '系统管理员',
    approval_comment: comment || '',
    approved_at: new Date().toISOString()
  });
  
  res.json({ success: true, message: '已拒绝' });
});

router.post('/allowance/calculate', (req, res) => {
  const { from_store_id, to_store_id, date, start_time, end_time } = req.body;
  
  const allowance = calculateTransportAllowance(
    from_store_id,
    to_store_id,
    date,
    start_time,
    end_time
  );
  
  res.json(allowance);
});

router.get('/export', (req, res) => {
  const { startDate, endDate, status } = req.query;
  
  let data = [...db.transferRequests];
  
  if (status) {
    data = data.filter(r => r.status === status);
  }
  if (startDate && endDate) {
    data = data.filter(r => r.date >= startDate && r.date <= endDate);
  }
  
  data = data.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.id - b.id;
  });
  
  const exportData = data.map(row => {
    const employee = db.employees.find(e => e.id === row.employee_id);
    const originalStore = db.stores.find(s => s.id === employee?.original_store_id);
    const toStore = db.stores.find(s => s.id === row.to_store_id);
    const skill = db.skills.find(s => s.id === row.skill_required);
    
    return {
      '申请ID': row.id,
      '员工姓名': employee?.name || '',
      '原门店': originalStore?.name || '',
      '借调门店': toStore?.name || '',
      '日期': row.date,
      '开始时间': row.start_time,
      '结束时间': row.end_time,
      '所需技能': skill?.name || '无',
      '借调原因': row.reason || '',
      '状态': row.status === 'pending' ? '待审批' : row.status === 'approved' ? '已通过' : '已拒绝',
      '交通补贴(元)': row.transport_allowance,
      '审批人': row.approver || '',
      '审批意见': row.approval_comment || '',
      '申请时间': row.created_at || '',
      '审批时间': row.approved_at || ''
    };
  });
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  const colWidths = [
    { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
  ];
  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, '借调排班明细');
  
  const totals = {
    total: exportData.length,
    totalAllowance: exportData.reduce((sum, row) => sum + (row['交通补贴(元)'] || 0), 0)
  };
  
  const summaryData = [
    { '统计项': '借调申请总数', '数值': totals.total },
    { '统计项': '交通补贴总额(元)', '数值': totals.totalAllowance }
  ];
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=借调排班表_${new Date().toISOString().split('T')[0]}.xlsx`);
  res.send(buffer);
});

module.exports = router;
