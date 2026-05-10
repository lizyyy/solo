const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { spawn } = require('child_process');
const { openDatabase, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

let db;

const TASK_STATUS = {
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  INSPECTED: 'inspected',
  REDO_NEEDED: 'redo_needed',
  REDO_IN_PROGRESS: 'redo_in_progress',
  REDO_COMPLETED: 'redo_completed',
  CLOSED: 'closed'
};

const isValidStatusTransition = (oldStatus, newStatus) => {
  const validTransitions = {
    [TASK_STATUS.ASSIGNED]: [TASK_STATUS.IN_PROGRESS],
    [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED],
    [TASK_STATUS.COMPLETED]: [TASK_STATUS.INSPECTED, TASK_STATUS.REDO_NEEDED],
    [TASK_STATUS.INSPECTED]: [TASK_STATUS.REDO_NEEDED, TASK_STATUS.CLOSED],
    [TASK_STATUS.REDO_NEEDED]: [TASK_STATUS.REDO_IN_PROGRESS],
    [TASK_STATUS.REDO_IN_PROGRESS]: [TASK_STATUS.REDO_COMPLETED],
    [TASK_STATUS.REDO_COMPLETED]: [TASK_STATUS.INSPECTED, TASK_STATUS.CLOSED],
    [TASK_STATUS.CLOSED]: []
  };
  return validTransitions[oldStatus]?.includes(newStatus) || false;
};

const canModifyTask = (task) => {
  return task.is_settled !== 1 && task.status !== TASK_STATUS.CLOSED;
};

const addHistory = async (taskId, action, oldStatus, newStatus, changedBy, details) => {
  await db.prepare(`
    INSERT INTO task_history (task_id, action, old_status, new_status, changed_by, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, action, oldStatus, newStatus, changedBy, details);
};

const updateCleanerStats = async (cleanerId) => {
  if (!cleanerId) return;
  
  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('redo_needed', 'redo_in_progress', 'redo_completed') OR redo_count > 0 THEN 1 ELSE 0 END) as redo_count
    FROM tasks 
    WHERE cleaner_id = ?
  `).get(cleanerId);
  
  const penaltySum = await db.prepare(`
    SELECT COALESCE(SUM(penalty_amount), 0) as total_penalty
    FROM inspections 
    WHERE task_id IN (SELECT id FROM tasks WHERE cleaner_id = ?)
  `).get(cleanerId);
  
  const avgRating = await db.prepare(`
    SELECT AVG(rating) as avg_rating
    FROM feedbacks
    WHERE task_id IN (SELECT id FROM tasks WHERE cleaner_id = ?)
  `).get(cleanerId);
  
  let rating = 5.0;
  if (avgRating.avg_rating) {
    rating = Math.min(5.0, Math.max(1.0, avgRating.avg_rating - (stats.redo_count * 0.1) - (penaltySum.total_penalty / 100)));
  }
  
  await db.prepare(`
    UPDATE cleaners 
    SET total_tasks = ?, redo_tasks = ?, rating = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(stats.total || 0, stats.redo_count || 0, rating, cleanerId);
};

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/properties', async (req, res) => {
  try {
    const properties = await db.prepare('SELECT * FROM properties ORDER BY name').all();
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    const { name, address, rooms, area } = req.body;
    const result = await db.prepare(`
      INSERT INTO properties (name, address, rooms, area)
      VALUES (?, ?, ?, ?)
    `).run(name, address, rooms || null, area || null);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  try {
    const { name, address, rooms, area, status } = req.body;
    await db.prepare(`
      UPDATE properties 
      SET name = ?, address = ?, rooms = ?, area = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name, address, rooms || null, area || null, status || 'active', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cleaners', async (req, res) => {
  try {
    const cleaners = await db.prepare('SELECT * FROM cleaners ORDER BY name').all();
    res.json(cleaners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cleaners', async (req, res) => {
  try {
    const { name, phone } = req.body;
    const result = await db.prepare(`
      INSERT INTO cleaners (name, phone)
      VALUES (?, ?)
    `).run(name, phone);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cleaners/:id', async (req, res) => {
  try {
    const { name, phone, status } = req.body;
    await db.prepare(`
      UPDATE cleaners 
      SET name = ?, phone = ?, status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(name, phone, status || 'active', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const { status, property_id, cleaner_id, start_date, end_date, booking_id } = req.query;
    
    let sql = `
      SELECT t.*, 
             p.name as property_name, p.address as property_address,
             c.name as cleaner_name, c.phone as cleaner_phone,
             (SELECT COUNT(*) FROM inspections WHERE task_id = t.id) as inspection_count,
             (SELECT COUNT(*) FROM feedbacks WHERE task_id = t.id) as feedback_count,
             (SELECT COUNT(*) FROM compensations WHERE task_id = t.id) as compensation_count
      FROM tasks t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN cleaners c ON t.cleaner_id = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (property_id) {
      sql += ' AND t.property_id = ?';
      params.push(property_id);
    }
    if (cleaner_id) {
      sql += ' AND t.cleaner_id = ?';
      params.push(cleaner_id);
    }
    if (start_date) {
      sql += ' AND date(t.assigned_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date(t.assigned_at) <= date(?)';
      params.push(end_date);
    }
    if (booking_id) {
      sql += ' AND t.booking_id LIKE ?';
      params.push('%' + booking_id + '%');
    }
    
    sql += ' ORDER BY t.created_at DESC';
    
    const tasks = await db.prepare(sql).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await db.prepare(`
      SELECT t.*, 
             p.name as property_name, p.address as property_address,
             c.name as cleaner_name, c.phone as cleaner_phone
      FROM tasks t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN cleaners c ON t.cleaner_id = c.id
      WHERE t.id = ?
    `).get(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const inspections = await db.prepare('SELECT * FROM inspections WHERE task_id = ? ORDER BY inspection_time DESC').all(req.params.id);
    const feedbacks = await db.prepare('SELECT * FROM feedbacks WHERE task_id = ? ORDER BY feedback_time DESC').all(req.params.id);
    const compensations = await db.prepare('SELECT * FROM compensations WHERE task_id = ? ORDER BY created_at DESC').all(req.params.id);
    const history = await db.prepare('SELECT * FROM task_history WHERE task_id = ? ORDER BY timestamp DESC').all(req.params.id);
    
    res.json({
      task,
      inspections,
      feedbacks,
      compensations,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, notes } = req.body;
    
    if (booking_id) {
      const existing = await db.prepare('SELECT id FROM tasks WHERE booking_id = ?').get(booking_id);
      if (existing) {
        return res.status(400).json({ error: '该入住单号已存在，不允许重复创建任务' });
      }
    }
    
    const result = await db.prepare(`
      INSERT INTO tasks (property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(property_id, cleaner_id || null, booking_id, guest_name, checkin_date, checkout_date, priority || 'normal', notes);
    
    await addHistory(result.lastInsertRowid, '创建任务', null, TASK_STATUS.ASSIGNED, '系统', `创建保洁任务`);
    
    if (cleaner_id) {
      await updateCleanerStats(cleaner_id);
    }
    
    res.json({ id: result.lastInsertRowid, status: TASK_STATUS.ASSIGNED });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/action', async (req, res) => {
  try {
    const { action, changedBy, ...data } = req.body;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    if (action !== 'view' && !canModifyTask(task)) {
      return res.status(400).json({ error: '任务已结算或已关闭，不允许修改' });
    }
    
    const updateTask = async (updates) => {
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), req.params.id];
      await db.prepare(`UPDATE tasks SET ${fields}, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(...values);
    };
    
    const oldStatus = task.status;
    let newStatus = task.status;
    
    const now = await db.prepare("SELECT datetime('now', 'localtime') as now").get();
    
    switch (action) {
      case 'start':
        if (task.status === TASK_STATUS.ASSIGNED) {
          newStatus = TASK_STATUS.IN_PROGRESS;
          await updateTask({ status: newStatus, started_at: now.now });
          await addHistory(task.id, '开始保洁', oldStatus, newStatus, changedBy || '系统', '保洁员开始工作');
        }
        break;
        
      case 'complete':
        if ([TASK_STATUS.IN_PROGRESS, TASK_STATUS.REDO_IN_PROGRESS].includes(task.status)) {
          newStatus = task.status === TASK_STATUS.IN_PROGRESS ? TASK_STATUS.COMPLETED : TASK_STATUS.REDO_COMPLETED;
          await updateTask({ status: newStatus, completed_at: now.now });
          await addHistory(task.id, '完成保洁', oldStatus, newStatus, changedBy || '系统', '保洁完成，等待检查');
        }
        break;
        
      case 'reassign':
        if ([TASK_STATUS.ASSIGNED, TASK_STATUS.REDO_NEEDED].includes(task.status)) {
          const oldCleaner = task.cleaner_name || '未分配';
          await updateTask({ cleaner_id: data.cleaner_id || null });
          const newCleaner = data.cleaner_id ? await db.prepare('SELECT name FROM cleaners WHERE id = ?').get(data.cleaner_id) : null;
          await addHistory(task.id, '重新指派', oldStatus, newStatus, changedBy || '系统', `保洁员从 ${oldCleaner} 变更为 ${newCleaner?.name || '未分配'}`);
          if (task.cleaner_id) await updateCleanerStats(task.cleaner_id);
          if (data.cleaner_id) await updateCleanerStats(data.cleaner_id);
        }
        break;
        
      case 'inspect':
        if ([TASK_STATUS.COMPLETED, TASK_STATUS.REDO_COMPLETED, TASK_STATUS.INSPECTED].includes(task.status)) {
          const { result, issues, penalty_points, penalty_amount, needs_redo, inspector, notes } = data;
          
          await db.prepare(`
            INSERT INTO inspections (task_id, inspector, result, issues, penalty_points, penalty_amount, needs_redo, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(task.id, inspector || '管理员', result, issues, penalty_points || 0, penalty_amount || 0, needs_redo ? 1 : 0, notes);
          
          if (penalty_amount > 0) {
            const newPenalty = (task.total_penalty || 0) + penalty_amount;
            await updateTask({ total_penalty: newPenalty });
          }
          
          if (needs_redo) {
            const existingRedo = await db.prepare('SELECT * FROM tasks WHERE id = ? AND redo_count > 0').get(task.id);
            if (existingRedo && task.status === TASK_STATUS.REDO_NEEDED) {
              return res.status(400).json({ error: '该任务已存在返工记录，不允许重复创建返工' });
            }
            newStatus = TASK_STATUS.REDO_NEEDED;
            const newRedoCount = (task.redo_count || 0) + 1;
            await updateTask({ status: newStatus, redo_count: newRedoCount });
            await addHistory(task.id, '检查不通过', oldStatus, newStatus, changedBy || '系统', `发现问题: ${issues || '无详细说明'}，扣分: ${penalty_points || 0}，处罚: ¥${penalty_amount || 0}`);
          } else {
            newStatus = TASK_STATUS.INSPECTED;
            await updateTask({ status: newStatus, inspected_at: now.now });
            await addHistory(task.id, '检查通过', oldStatus, newStatus, changedBy || '系统', `检查结果: ${result}，扣分: ${penalty_points || 0}，处罚: ¥${penalty_amount || 0}`);
          }
          
          if (task.cleaner_id) await updateCleanerStats(task.cleaner_id);
        }
        break;
        
      case 'start_redo':
        if (task.status === TASK_STATUS.REDO_NEEDED) {
          newStatus = TASK_STATUS.REDO_IN_PROGRESS;
          await updateTask({ status: newStatus });
          await addHistory(task.id, '开始返工', oldStatus, newStatus, changedBy || '系统', '保洁员开始返工');
        }
        break;
        
      case 'submit_feedback':
        const { guest_name, rating, issues, severity, needs_redo, compensation_request, feedback_notes } = data;
        
        await db.prepare(`
          INSERT INTO feedbacks (task_id, guest_name, rating, issues, severity, needs_redo, compensation_request, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(task.id, guest_name, rating, issues, severity || 'medium', needs_redo ? 1 : 0, compensation_request ? 1 : 0, feedback_notes);
        
        if (needs_redo && !canModifyTask(task)) {
          return res.status(400).json({ error: '任务已结算或已关闭，无法创建返工' });
        }
        
        if (needs_redo && canModifyTask(task)) {
          const newRedoCount = (task.redo_count || 0) + 1;
          newStatus = TASK_STATUS.REDO_NEEDED;
          await updateTask({ status: newStatus, redo_count: newRedoCount });
          await addHistory(task.id, '住客反馈触发返工', oldStatus, newStatus, changedBy || '系统', `住客反馈问题: ${issues || '无详细说明'}`);
        } else {
          await addHistory(task.id, '住客反馈', oldStatus, newStatus, changedBy || '系统', `住客评分: ${rating}分，问题: ${issues || '无'}`);
        }
        
        if (task.cleaner_id) await updateCleanerStats(task.cleaner_id);
        break;
        
      case 'compensate':
        if (!canModifyTask(task)) {
          return res.status(400).json({ error: '任务已结算或已关闭，无法处理赔付' });
        }
        const { reason, amount, feedback_id, settled_from_cleaner, comp_notes } = data;
        
        await db.prepare(`
          INSERT INTO compensations (task_id, feedback_id, reason, amount, settled_from_cleaner, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(task.id, feedback_id || null, reason, amount, settled_from_cleaner ? 1 : 0, comp_notes);
        
        const newCompensation = (task.total_compensation || 0) + amount;
        await updateTask({ total_compensation: newCompensation });
        await addHistory(task.id, '赔付处理', oldStatus, newStatus, changedBy || '系统', `赔付原因: ${reason}，金额: ¥${amount}`);
        
        if (task.cleaner_id) await updateCleanerStats(task.cleaner_id);
        break;
        
      case 'close':
        if (!canModifyTask(task)) {
          return res.status(400).json({ error: '任务已结算或已关闭' });
        }
        if (![TASK_STATUS.INSPECTED, TASK_STATUS.REDO_COMPLETED, TASK_STATUS.COMPLETED].includes(task.status)) {
          return res.status(400).json({ error: '任务未完成检查，无法关闭' });
        }
        newStatus = TASK_STATUS.CLOSED;
        await updateTask({ status: newStatus, is_settled: 1, closed_at: now.now });
        await addHistory(task.id, '关闭并结算', oldStatus, newStatus, changedBy || '系统', '任务已关闭并完成结算');
        break;
        
      case 'view':
        break;
        
      default:
        return res.status(400).json({ error: '未知操作' });
    }
    
    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tasks/:id/history', async (req, res) => {
  try {
    const history = await db.prepare('SELECT * FROM task_history WHERE task_id = ? ORDER BY timestamp DESC').all(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '1=1';
    const params = [];
    if (start_date) {
      dateFilter += ' AND date(t.created_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND date(t.created_at) <= date(?)';
      params.push(end_date);
    }
    
    const taskStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'inspected' THEN 1 ELSE 0 END) as inspected,
        SUM(CASE WHEN status LIKE 'redo_%' THEN 1 ELSE 0 END) as redo,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(redo_count) as total_redos,
        SUM(total_penalty) as total_penalty,
        SUM(total_compensation) as total_compensation
      FROM tasks t
      WHERE ${dateFilter}
    `).get(...params);
    
    const propertyStats = await db.prepare(`
      SELECT 
        p.id, p.name,
        COUNT(t.id) as task_count,
        SUM(CASE WHEN t.redo_count > 0 THEN 1 ELSE 0 END) as redo_count,
        SUM(t.total_penalty) as total_penalty,
        SUM(t.total_compensation) as total_compensation
      FROM properties p
      LEFT JOIN tasks t ON p.id = t.property_id
      WHERE ${dateFilter}
      GROUP BY p.id, p.name
      ORDER BY task_count DESC
    `).all(...params);
    
    const cleanerStats = await db.prepare(`
      SELECT 
        c.id, c.name, c.rating, c.total_tasks, c.redo_tasks,
        (SELECT COALESCE(SUM(penalty_amount), 0) FROM inspections WHERE task_id IN (SELECT id FROM tasks WHERE cleaner_id = c.id)) as total_penalty,
        (SELECT COALESCE(SUM(amount), 0) FROM compensations WHERE task_id IN (SELECT id FROM tasks WHERE cleaner_id = c.id)) as total_compensation
      FROM cleaners c
      ORDER BY c.rating DESC
    `).all();
    
    const issueStats = await db.prepare(`
      SELECT 
        issues,
        COUNT(*) as count
      FROM inspections
      WHERE issues IS NOT NULL AND issues != ''
      GROUP BY issues
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    res.json({
      taskStats: taskStats || { total: 0 },
      propertyStats,
      cleanerStats,
      issueStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const { start_date, end_date, status, property_id, cleaner_id } = req.query;
    
    let sql = `
      SELECT 
        t.id as task_id,
        t.booking_id,
        t.guest_name,
        p.name as property_name,
        p.address as property_address,
        c.name as cleaner_name,
        t.status,
        t.priority,
        t.redo_count,
        t.total_penalty,
        t.total_compensation,
        t.assigned_at,
        t.started_at,
        t.completed_at,
        t.inspected_at,
        t.closed_at,
        i.issues as inspection_issues,
        i.penalty_points,
        f.issues as feedback_issues,
        f.rating as guest_rating,
        comp.reason as compensation_reason,
        comp.amount as compensation_amount
      FROM tasks t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN cleaners c ON t.cleaner_id = c.id
      LEFT JOIN (
        SELECT task_id, issues, penalty_points, inspection_time
        FROM inspections i1
        WHERE inspection_time = (SELECT MAX(inspection_time) FROM inspections i2 WHERE i2.task_id = i1.task_id)
      ) i ON t.id = i.task_id
      LEFT JOIN (
        SELECT task_id, issues, rating, feedback_time
        FROM feedbacks f1
        WHERE feedback_time = (SELECT MAX(feedback_time) FROM feedbacks f2 WHERE f2.task_id = f1.task_id)
      ) f ON t.id = f.task_id
      LEFT JOIN (
        SELECT task_id, reason, amount
        FROM compensations
      ) comp ON t.id = comp.task_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (property_id) {
      sql += ' AND t.property_id = ?';
      params.push(property_id);
    }
    if (cleaner_id) {
      sql += ' AND t.cleaner_id = ?';
      params.push(cleaner_id);
    }
    if (start_date) {
      sql += ' AND date(t.assigned_at) >= date(?)';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND date(t.assigned_at) <= date(?)';
      params.push(end_date);
    }
    
    sql += ' ORDER BY t.assigned_at DESC';
    
    const data = await db.prepare(sql).all(...params);
    
    const statusMap = {
      'assigned': '已指派',
      'in_progress': '进行中',
      'completed': '已完成',
      'inspected': '已检查',
      'redo_needed': '需返工',
      'redo_in_progress': '返工中',
      'redo_completed': '返工完成',
      'closed': '已关闭'
    };
    
    const calculateTime = (start, end) => {
      if (!start || !end) return '';
      const s = new Date(start);
      const e = new Date(end);
      const diff = e - s;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}小时${minutes}分钟`;
    };
    
    let csv = '\uFEFF任务编号,入住单号,房源,地址,保洁员,任务状态,优先级,返工次数,总处罚(元),总赔付(元),检查问题,扣分原因,扣分点数,住客反馈,住客评分,赔付原因,赔付金额,派单时间,开始时间,完成时间,检查时间,关闭时间,处理耗时\n';
    
    data.forEach(row => {
      const processingTime = calculateTime(row.assigned_at, row.closed_at || row.completed_at);
      
      csv += [
        row.task_id,
        `"${row.booking_id || ''}"`,
        `"${row.property_name || ''}"`,
        `"${row.property_address || ''}"`,
        `"${row.cleaner_name || ''}"`,
        statusMap[row.status] || row.status,
        row.priority === 'high' ? '紧急' : row.priority === 'low' ? '低' : '正常',
        row.redo_count || 0,
        row.total_penalty || 0,
        row.total_compensation || 0,
        `"${(row.inspection_issues || '').replace(/"/g, '""')}"`,
        `"${(row.inspection_issues || '').replace(/"/g, '""')}"`,
        row.penalty_points || 0,
        `"${(row.feedback_issues || '').replace(/"/g, '""')}"`,
        row.guest_rating || '',
        `"${(row.compensation_reason || '').replace(/"/g, '""')}"`,
        row.compensation_amount || 0,
        row.assigned_at || '',
        row.started_at || '',
        row.completed_at || '',
        row.inspected_at || '',
        row.closed_at || '',
        processingTime
      ].join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=cleaning_report_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/init-data', (req, res) => {
  const scriptPath = path.join(__dirname, 'scripts', 'init-data.js');
  const child = spawn('node', [scriptPath]);
  
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  
  child.on('close', (code) => {
    if (code === 0) {
      res.json({ success: true, output });
    } else {
      res.status(500).json({ error: '初始化失败', output });
    }
  });
});

async function startServer() {
  try {
    db = await initDatabase();
    app.listen(PORT, () => {
      console.log(`民宿保洁返工追踪台运行在 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();
