const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database-json');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const validateEmployee = (employee) => {
  if (!employee.name || employee.name.trim() === '') {
    return { valid: false, message: '员工姓名不能为空' };
  }
  return { valid: true };
};

const validateSchedule = (schedule) => {
  if (!schedule.date) {
    return { valid: false, message: '日期不能为空' };
  }
  if (!schedule.shift_id) {
    return { valid: false, message: '班次不能为空' };
  }
  if (!schedule.employee_id) {
    return { valid: false, message: '员工不能为空' };
  }
  return { valid: true };
};

const validateExchangeRequest = (request) => {
  if (!request.from_employee_id) {
    return { valid: false, message: '申请人不能为空' };
  }
  if (!request.to_employee_id) {
    return { valid: false, message: '被交换人不能为空' };
  }
  if (request.from_employee_id === request.to_employee_id) {
    return { valid: false, message: '不能自己和自己换班' };
  }
  if (!request.schedule_id) {
    return { valid: false, message: '排班记录不能为空' };
  }
  return { valid: true };
};

app.get('/api/employees', (req, res) => {
  try {
    const employees = db.prepare('SELECT * FROM employees ORDER BY id').all();
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/employees', (req, res) => {
  try {
    const validation = validateEmployee(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { name, phone, email } = req.body;
    
    const existing = db.prepare('SELECT * FROM employees WHERE name = ?').get(name);
    if (existing) {
      return res.status(400).json({ success: false, message: '员工姓名已存在' });
    }

    const result = db.prepare(
      'INSERT INTO employees (name, phone, email) VALUES (?, ?, ?)'
    ).run(name, phone || null, email || null);

    res.json({ 
      success: true, 
      message: '员工添加成功',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  try {
    const validation = validateEmployee(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { name, phone, email } = req.body;
    const id = parseInt(req.params.id);
    
    const existing = db.prepare('SELECT * FROM employees WHERE name = ? AND id != ?').get(name, id);
    if (existing) {
      return res.status(400).json({ success: false, message: '员工姓名已存在' });
    }

    const result = db.prepare(
      'UPDATE employees SET name = ?, phone = ?, email = ? WHERE id = ?'
    ).run(name, phone || null, email || null, id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '员工不存在' });
    }

    res.json({ success: true, message: '员工更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/employees/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules WHERE employee_id = ?').get(id).count;
    if (scheduleCount > 0) {
      return res.status(400).json({ success: false, message: '该员工有排班记录，无法删除' });
    }

    const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '员工不存在' });
    }

    res.json({ success: true, message: '员工删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/shifts', (req, res) => {
  try {
    const shifts = db.prepare('SELECT * FROM shifts ORDER BY id').all();
    res.json({ success: true, data: shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/schedules', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT s.*, e.name as employee_name, sh.name as shift_name, sh.type as shift_type,
             sh.start_time, sh.end_time
      FROM schedules s
      JOIN employees e ON s.employee_id = e.id
      JOIN shifts sh ON s.shift_id = sh.id
    `;
    let params = [];

    if (start_date && end_date) {
      query += ' WHERE s.date >= ? AND s.date <= ?';
      params.push(start_date, end_date);
    }
    query += ' ORDER BY s.date, sh.id';

    const schedules = db.prepare(query).all(...params);
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/schedules', (req, res) => {
  try {
    const validation = validateSchedule(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { date, shift_id, employee_id } = req.body;
    
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
    if (!employee) {
      return res.status(400).json({ success: false, message: '员工不存在' });
    }

    const existing = db.prepare(
      'SELECT * FROM schedules WHERE date = ? AND shift_id = ? AND employee_id = ?'
    ).get(date, shift_id, employee_id);

    if (existing) {
      return res.status(400).json({ success: false, message: '该员工当天同一班次已排班' });
    }

    const result = db.prepare(
      'INSERT INTO schedules (date, shift_id, employee_id) VALUES (?, ?, ?)'
    ).run(date, shift_id, employee_id);

    res.json({ 
      success: true, 
      message: '排班成功',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/schedules/batch', (req, res) => {
  try {
    const { schedules } = req.body;
    
    if (!schedules || schedules.length === 0) {
      return res.status(400).json({ success: false, message: '没有排班数据' });
    }

    const insert = db.prepare(
      'INSERT INTO schedules (date, shift_id, employee_id) VALUES (?, ?, ?)'
    );

    const transaction = db.transaction((items) => {
      for (const item of items) {
        const { date, shift_id, employee_id } = item;
        
        const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
        if (!employee) {
          throw new Error(`员工 ID ${employee_id} 不存在`);
        }

        const existing = db.prepare(
          'SELECT * FROM schedules WHERE date = ? AND shift_id = ? AND employee_id = ?'
        ).get(date, shift_id, employee_id);

        if (existing) {
          throw new Error(`员工 ${employee.name} 在 ${date} 的该班次已排班`);
        }

        insert.run(date, shift_id, employee_id);
      }
    });

    transaction(schedules);

    res.json({ success: true, message: `成功添加 ${schedules.length} 条排班记录` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/schedules/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const pendingExchanges = db.prepare(
      'SELECT * FROM shift_exchanges WHERE schedule_id = ? AND status = "pending"'
    ).all(id);

    if (pendingExchanges.length > 0) {
      return res.status(400).json({ success: false, message: '该排班有未处理的换班申请，无法删除' });
    }

    const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '排班记录不存在' });
    }

    res.json({ success: true, message: '排班记录删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/shift-exchanges', (req, res) => {
  try {
    const { status, employee_id } = req.query;
    let query = `
      SELECT se.*, 
             e1.name as from_employee_name, 
             e2.name as to_employee_name,
             sh.name as shift_name,
             s.date
      FROM shift_exchanges se
      JOIN employees e1 ON se.from_employee_id = e1.id
      JOIN employees e2 ON se.to_employee_id = e2.id
      JOIN shifts sh ON se.shift_id = sh.id
    `;
    let conditions = [];
    let params = [];

    if (status) {
      conditions.push('se.status = ?');
      params.push(status);
    }

    if (employee_id) {
      conditions.push('(se.from_employee_id = ? OR se.to_employee_id = ?)');
      params.push(employee_id, employee_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY se.created_at DESC';

    const exchanges = db.prepare(query).all(...params);
    res.json({ success: true, data: exchanges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/shift-exchanges', (req, res) => {
  try {
    const validation = validateExchangeRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { from_employee_id, to_employee_id, schedule_id, reason } = req.body;
    
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule_id);
    if (!schedule) {
      return res.status(400).json({ success: false, message: '排班记录不存在' });
    }

    if (schedule.employee_id !== from_employee_id) {
      return res.status(400).json({ success: false, message: '该排班不属于申请人' });
    }

    const toEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(to_employee_id);
    if (!toEmployee) {
      return res.status(400).json({ success: false, message: '被交换员工不存在' });
    }

    const existingSchedule = db.prepare(
      'SELECT * FROM schedules WHERE date = ? AND shift_id = ? AND employee_id = ?'
    ).get(schedule.date, schedule.shift_id, to_employee_id);

    if (existingSchedule) {
      return res.status(400).json({ 
        success: false, 
        message: `被交换人 ${toEmployee.name} 在当天同一时段已经有班` 
      });
    }

    const pendingExchange = db.prepare(`
      SELECT * FROM shift_exchanges 
      WHERE schedule_id = ? AND status = 'pending'
    `).get(schedule_id);

    if (pendingExchange) {
      return res.status(400).json({ 
        success: false, 
        message: '该排班已有未处理的换班申请' 
      });
    }

    const result = db.prepare(`
      INSERT INTO shift_exchanges 
      (from_employee_id, to_employee_id, schedule_id, date, shift_id, reason) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(from_employee_id, to_employee_id, schedule_id, schedule.date, schedule.shift_id, reason);

    res.json({ 
      success: true, 
      message: '换班申请提交成功',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/shift-exchanges/:id/approve', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { processed_by } = req.body;

    const exchange = db.prepare('SELECT * FROM shift_exchanges WHERE id = ?').get(id);
    if (!exchange) {
      return res.status(404).json({ success: false, message: '换班申请不存在' });
    }

    if (exchange.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该申请已被处理' });
    }

    const existingSchedule = db.prepare(`
      SELECT * FROM schedules WHERE date = ? AND shift_id = ? AND employee_id = ?
    `).get(exchange.date, exchange.shift_id, exchange.to_employee_id);

    if (existingSchedule) {
      const toEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(exchange.to_employee_id);
      return res.status(400).json({ 
        success: false, 
        message: `被交换人 ${toEmployee.name} 在当天同一时段已经有班，无法同意换班` 
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE schedules SET employee_id = ? WHERE id = ?
      `).run(exchange.to_employee_id, exchange.schedule_id);

      db.prepare(`
        UPDATE shift_exchanges 
        SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ? 
        WHERE id = ?
      `).run(processed_by || exchange.to_employee_id, id);
    });

    transaction();

    res.json({ success: true, message: '换班申请已同意，排班已更新' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/shift-exchanges/:id/reject', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { processed_by, reason } = req.body;

    const exchange = db.prepare('SELECT * FROM shift_exchanges WHERE id = ?').get(id);
    if (!exchange) {
      return res.status(404).json({ success: false, message: '换班申请不存在' });
    }

    if (exchange.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该申请已被处理' });
    }

    db.prepare(`
      UPDATE shift_exchanges 
      SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, processed_by = ?, reason = ?
      WHERE id = ?
    `).run(processed_by || exchange.to_employee_id, reason || exchange.reason, id);

    res.json({ success: true, message: '换班申请已拒绝' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/export/schedules', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT s.date, sh.name as shift, e.name as employee, sh.start_time, sh.end_time
      FROM schedules s
      JOIN employees e ON s.employee_id = e.id
      JOIN shifts sh ON s.shift_id = sh.id
    `;
    let params = [];

    if (start_date && end_date) {
      query += ' WHERE s.date >= ? AND s.date <= ?';
      params.push(start_date, end_date);
    }
    query += ' ORDER BY s.date, sh.id';

    const schedules = db.prepare(query).all(...params);
    
    let csv = '日期,班次,员工,开始时间,结束时间\n';
    for (const s of schedules) {
      csv += `${s.date},${s.shift},${s.employee},${s.start_time},${s.end_time}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=schedules.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/export/exchanges', (req, res) => {
  try {
    const exchanges = db.prepare(`
      SELECT 
        se.date,
        sh.name as shift,
        e1.name as from_employee,
        e2.name as to_employee,
        se.status,
        se.reason,
        se.created_at as request_time,
        se.processed_at
      FROM shift_exchanges se
      JOIN employees e1 ON se.from_employee_id = e1.id
      JOIN employees e2 ON se.to_employee_id = e2.id
      JOIN shifts sh ON se.shift_id = sh.id
      ORDER BY se.created_at DESC
    `).all();
    
    let csv = '日期,班次,原员工,目标员工,状态,原因,申请时间,处理时间\n';
    const statusMap = { 'pending': '待处理', 'approved': '已同意', 'rejected': '已拒绝' };
    for (const e of exchanges) {
      csv += `${e.date},${e.shift},${e.from_employee},${e.to_employee},${statusMap[e.status] || e.status},${e.reason || ''},${e.request_time},${e.processed_at || ''}\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=shift_exchanges.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/import/schedules', (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || csvData.trim() === '') {
      return res.status(400).json({ success: false, message: 'CSV数据为空' });
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV格式错误，至少需要标题行和数据行' });
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const dateIdx = headers.indexOf('日期');
    const shiftIdx = headers.indexOf('班次');
    const employeeIdx = headers.indexOf('员工');

    if (dateIdx === -1 || shiftIdx === -1 || employeeIdx === -1) {
      return res.status(400).json({ 
        success: false, 
        message: 'CSV必须包含以下列：日期、班次、员工' 
      });
    }

    const shifts = db.prepare('SELECT * FROM shifts').all();
    const shiftMap = {};
    for (const s of shifts) {
      shiftMap[s.name] = s.id;
    }

    const schedules = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const date = values[dateIdx];
      const shiftName = values[shiftIdx];
      const employeeName = values[employeeIdx];

      if (!date || !shiftName || !employeeName) {
        errors.push(`第${i+1}行数据不完整`);
        continue;
      }

      const shiftId = shiftMap[shiftName];
      if (!shiftId) {
        errors.push(`第${i+1}行：班次"${shiftName}"不存在`);
        continue;
      }

      const employee = db.prepare('SELECT * FROM employees WHERE name = ?').get(employeeName);
      if (!employee) {
        errors.push(`第${i+1}行：员工"${employeeName}"不存在`);
        continue;
      }

      schedules.push({
        date,
        shift_id: shiftId,
        employee_id: employee.id
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '导入数据有错误',
        errors: errors
      });
    }

    if (schedules.length === 0) {
      return res.status(400).json({ success: false, message: '没有有效的排班数据' });
    }

    const insert = db.prepare(
      'INSERT INTO schedules (date, shift_id, employee_id) VALUES (?, ?, ?)'
    );

    const transaction = db.transaction((items) => {
      for (const item of items) {
        const existing = db.prepare(
          'SELECT * FROM schedules WHERE date = ? AND shift_id = ? AND employee_id = ?'
        ).get(item.date, item.shift_id, item.employee_id);

        if (!existing) {
          insert.run(item.date, item.shift_id, item.employee_id);
        }
      }
    });

    transaction(schedules);

    res.json({ success: true, message: `成功导入 ${schedules.length} 条排班记录` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`值班换班看板已启动: http://localhost:${PORT}`);
});
