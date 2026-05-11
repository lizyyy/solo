const express = require('express');
const router = express.Router();
const db = require('../models/database');
const dayjs = require('dayjs');

const getLatestOrder = (problemId) => {
  return db.get(`
    SELECT w.*, c.name as contractor_name
    FROM work_orders w
    LEFT JOIN contractors c ON w.contractor_id = c.id
    WHERE w.problem_id = ?
    ORDER BY w.id DESC
    LIMIT 1
  `, [problemId]);
};

const getLatestRecheck = (problemId) => {
  return db.get(`
    SELECT * FROM rechecks WHERE problem_id = ? ORDER BY id DESC LIMIT 1
  `, [problemId]);
};

router.get('/', (req, res) => {
  const { building_id, status, problem_type, owner_confirmed } = req.query;
  let sql = `
    SELECT p.*, 
      b.building_no, b.unit_no, b.room_no, b.owner_name, b.owner_phone
    FROM inspection_problems p
    LEFT JOIN buildings b ON p.building_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (building_id) {
    sql += ' AND p.building_id = ?';
    params.push(building_id);
  }
  if (status) {
    sql += ' AND p.status = ?';
    params.push(status);
  }
  if (problem_type) {
    sql += ' AND p.problem_type = ?';
    params.push(problem_type);
  }
  if (owner_confirmed !== undefined) {
    sql += ' AND p.owner_confirmed = ?';
    params.push(owner_confirmed === '1' ? 1 : 0);
  }
  sql += ' ORDER BY p.id DESC';

  const problems = db.all(sql, params);
  
  const today = dayjs();
  const processed = problems.map(p => {
    const latestOrder = getLatestOrder(p.id);
    const latestRecheck = getLatestRecheck(p.id);
    
    if (latestOrder) {
      const deadline = dayjs(latestOrder.deadline);
      const isOverdue = p.status !== '已完成' && today.isAfter(deadline);
      p.latest_order = {
        ...latestOrder,
        is_overdue: isOverdue,
        overdue_days: isOverdue ? today.diff(deadline, 'day') : 0
      };
    }
    if (latestRecheck) {
      p.latest_recheck = latestRecheck;
    }
    p.order_count = db.all('SELECT id FROM work_orders WHERE problem_id = ?', [p.id]).length;
    return p;
  });

  res.json({ code: 0, data: processed });
});

router.get('/:id', (req, res) => {
  const problem = db.get(`
    SELECT p.*, b.building_no, b.unit_no, b.room_no, b.owner_name, b.owner_phone
    FROM inspection_problems p
    LEFT JOIN buildings b ON p.building_id = b.id
    WHERE p.id = ?
  `, [req.params.id]);
  
  if (!problem) {
    return res.status(404).json({ code: 1, message: '问题不存在' });
  }

  const workOrders = db.all(`
    SELECT w.*, c.name as contractor_name, c.contact_person, c.phone
    FROM work_orders w
    LEFT JOIN contractors c ON w.contractor_id = c.id
    WHERE w.problem_id = ?
    ORDER BY w.id DESC
  `, [req.params.id]);

  const rechecks = db.all(
    'SELECT * FROM rechecks WHERE problem_id = ? ORDER BY id DESC',
    [req.params.id]
  );

  const compensations = db.all(
    'SELECT * FROM compensations WHERE problem_id = ? ORDER BY id DESC',
    [req.params.id]
  );

  const today = dayjs();
  const processedOrders = workOrders.map(o => {
    const deadline = dayjs(o.deadline);
    const isOverdue = o.status !== '已完成' && today.isAfter(deadline);
    return {
      ...o,
      is_overdue: isOverdue,
      overdue_days: isOverdue ? today.diff(deadline, 'day') : 0
    };
  });

  res.json({ 
    code: 0, 
    data: { 
      ...problem, 
      work_orders: processedOrders, 
      rechecks, 
      compensations 
    } 
  });
});

router.post('/', (req, res) => {
  const { building_id, problem_type, problem_category, description, location, inspection_date, photos } = req.body;
  
  if (!building_id || !problem_type || !description || !inspection_date) {
    return res.status(400).json({ code: 1, message: '房号、问题类型、问题描述、验房日期不能为空' });
  }

  const building = db.get('SELECT * FROM buildings WHERE id = ?', [building_id]);
  if (!building) {
    return res.status(404).json({ code: 1, message: '房号不存在' });
  }

  const result = db.prepare(`
    INSERT INTO inspection_problems 
    (building_id, problem_type, problem_category, description, location, inspection_date, photos, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '待派单', ?)
  `).run(building_id, problem_type, problem_category || '其他', description, location, inspection_date, photos, dayjs().format('YYYY-MM-DD HH:mm:ss'));

  res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const problem = db.get('SELECT * FROM inspection_problems WHERE id = ?', [req.params.id]);
  if (!problem) {
    return res.status(404).json({ code: 1, message: '问题不存在' });
  }

  if (problem.owner_confirmed === 1) {
    return res.status(400).json({ code: 1, message: '业主已确认的问题不能修改，请先联系业主撤销确认' });
  }

  const { problem_type, problem_category, description, location, inspection_date, photos } = req.body;

  db.prepare(`
    UPDATE inspection_problems SET 
      problem_type = ?, problem_category = ?, description = ?, location = ?, 
      inspection_date = ?, photos = ?, updated_at = ?
    WHERE id = ?
  `).run(problem_type, problem_category, description, location, inspection_date, photos, dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);

  res.json({ code: 0, message: '更新成功' });
});

router.post('/:id/assign', (req, res) => {
  const { contractor_id, deadline } = req.body;
  
  if (!contractor_id || !deadline) {
    return res.status(400).json({ code: 1, message: '施工方和截止日期不能为空' });
  }

  const problem = db.get('SELECT * FROM inspection_problems WHERE id = ?', [req.params.id]);
  if (!problem) {
    return res.status(404).json({ code: 1, message: '问题不存在' });
  }

  if (problem.owner_confirmed === 1) {
    return res.status(400).json({ code: 1, message: '业主已确认的问题不能重新派单' });
  }

  const contractor = db.get('SELECT * FROM contractors WHERE id = ?', [contractor_id]);
  if (!contractor) {
    return res.status(404).json({ code: 1, message: '施工方不存在' });
  }

  const activeOrders = db.all(
    `SELECT * FROM work_orders WHERE problem_id = ? AND status IN ('待整改', '待复验')`,
    [req.params.id]
  );

  if (activeOrders.length > 0) {
    return res.status(400).json({ code: 1, message: '该问题已有进行中的派单，不能重复派单' });
  }

  const existingOrders = db.all('SELECT id FROM work_orders WHERE problem_id = ?', [req.params.id]);
  const reworkCount = existingOrders.length;

  const result = db.prepare(`
    INSERT INTO work_orders (problem_id, contractor_id, assigned_date, deadline, status, rework_count)
    VALUES (?, ?, ?, ?, '待整改', ?)
  `).run(req.params.id, contractor_id, dayjs().format('YYYY-MM-DD'), deadline, reworkCount);

  db.prepare(
    `UPDATE inspection_problems SET status = '待整改', updated_at = ? WHERE id = ?`
  ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);

  res.json({ code: 0, data: { id: result.lastInsertRowid }, message: '派单成功' });
});

router.post('/:id/recheck', (req, res) => {
  const { work_order_id, result, recheck_date, photos, remarks } = req.body;
  
  if (!work_order_id || !result || !recheck_date) {
    return res.status(400).json({ code: 1, message: '派单ID、复验结果、复验日期不能为空' });
  }

  const problem = db.get('SELECT * FROM inspection_problems WHERE id = ?', [req.params.id]);
  if (!problem) {
    return res.status(404).json({ code: 1, message: '问题不存在' });
  }

  if (problem.status === '待派单') {
    return res.status(400).json({ code: 1, message: '未派单的问题不能进行复验' });
  }

  if (problem.owner_confirmed === 1) {
    return res.status(400).json({ code: 1, message: '业主已确认的问题不能复验' });
  }

  const workOrder = db.get(
    'SELECT * FROM work_orders WHERE id = ? AND problem_id = ?',
    [work_order_id, req.params.id]
  );

  if (!workOrder) {
    return res.status(404).json({ code: 1, message: '派单记录不存在' });
  }

  if (workOrder.status === '已完成') {
    return res.status(400).json({ code: 1, message: '该派单已完成复验' });
  }

  db.prepare(`
    INSERT INTO rechecks (problem_id, work_order_id, recheck_date, result, photos, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, work_order_id, recheck_date, result, photos, remarks);

  if (result === '通过') {
    db.prepare(
      `UPDATE work_orders SET status = '已完成', updated_at = ? WHERE id = ?`
    ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), work_order_id);

    db.prepare(
      `UPDATE inspection_problems SET status = '已完成', updated_at = ? WHERE id = ?`
    ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);
  } else {
    db.prepare(
      `UPDATE work_orders SET status = '整改不通过', updated_at = ? WHERE id = ?`
    ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), work_order_id);

    db.prepare(
      `UPDATE inspection_problems SET status = '待整改', updated_at = ? WHERE id = ?`
    ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);
  }

  res.json({ code: 0, message: '复验记录已保存' });
});

router.post('/:id/owner-confirm', (req, res) => {
  const problem = db.get('SELECT * FROM inspection_problems WHERE id = ?', [req.params.id]);
  if (!problem) {
    return res.status(404).json({ code: 1, message: '问题不存在' });
  }

  if (problem.status !== '已完成') {
    return res.status(400).json({ code: 1, message: '只有已完成复验的问题才能进行业主确认' });
  }

  if (problem.owner_confirmed === 1) {
    return res.status(400).json({ code: 1, message: '该问题已业主确认，无需重复确认' });
  }

  db.prepare(
    `UPDATE inspection_problems SET owner_confirmed = 1, owner_confirm_time = ?, updated_at = ? WHERE id = ?`
  ).run(dayjs().format('YYYY-MM-DD HH:mm:ss'), dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);

  res.json({ code: 0, message: '业主确认成功' });
});

router.post('/:id/calculate-compensation', (req, res) => {
  const { work_order_id, daily_amount = 100 } = req.body;
  
  const workOrder = db.get(`
    SELECT w.*, p.problem_type
    FROM work_orders w
    LEFT JOIN inspection_problems p ON w.problem_id = p.id
    WHERE w.id = ? AND w.problem_id = ?
  `, [work_order_id, req.params.id]);

  if (!workOrder) {
    return res.status(404).json({ code: 1, message: '派单记录不存在' });
  }

  const today = dayjs();
  const deadline = dayjs(workOrder.deadline);
  
  if (!today.isAfter(deadline)) {
    return res.json({ 
      code: 0, 
      data: { 
        is_overdue: false, 
        delay_days: 0, 
        amount: 0,
        deadline: workOrder.deadline 
      } 
    });
  }

  const delayDays = today.diff(deadline, 'day');
  const amount = delayDays * daily_amount;

  const existingCompensation = db.get(
    'SELECT * FROM compensations WHERE work_order_id = ?',
    [work_order_id]
  );

  const calcBasis = `逾期${delayDays}天，每日赔付${daily_amount}元，问题类型：${workOrder.problem_type}`;
  let compensationId = null;
  
  if (!existingCompensation) {
    const result = db.prepare(`
      INSERT INTO compensations (problem_id, work_order_id, delay_days, amount, calculation_basis)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, work_order_id, delayDays, amount, calcBasis);
    compensationId = result.lastInsertRowid;
  } else {
    db.prepare(`
      UPDATE compensations SET delay_days = ?, amount = ?, calculation_basis = ?
      WHERE work_order_id = ?
    `).run(delayDays, amount, calcBasis, work_order_id);
    compensationId = existingCompensation.id;
  }

  res.json({ 
    code: 0, 
    data: { 
      id: compensationId,
      is_overdue: true, 
      delay_days: delayDays, 
      amount,
      daily_amount,
      deadline: workOrder.deadline,
      calculation_basis: `逾期${delayDays}天，每日赔付${daily_amount}元`
    } 
  });
});

router.delete('/:id', (req, res) => {
  const problem = db.get('SELECT * FROM inspection_problems WHERE id = ?', [req.params.id]);
  if (!problem) {
    return res.status(404).json({ code: 1, message: '问题不存在' });
  }

  if (problem.owner_confirmed === 1) {
    return res.status(400).json({ code: 1, message: '业主已确认的问题不能删除' });
  }

  db.run('DELETE FROM rechecks WHERE problem_id = ?', [req.params.id]);
  db.run('DELETE FROM compensations WHERE problem_id = ?', [req.params.id]);
  db.run('DELETE FROM work_orders WHERE problem_id = ?', [req.params.id]);
  db.run('DELETE FROM inspection_problems WHERE id = ?', [req.params.id]);

  res.json({ code: 0, message: '删除成功' });
});

module.exports = router;
