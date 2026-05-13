const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../utils/db');

const createLawyer = async (req, res) => {
  try {
    const { name, specialty, capacity } = req.body;

    const id = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO lawyers (id, name, specialty, capacity, current_load, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 'active', ?, ?)`,
      [id, name, specialty, capacity || 5, now, now]
    );

    const newLawyer = await getQuery('SELECT * FROM lawyers WHERE id = ?', [id]);
    res.status(201).json(newLawyer);
  } catch (err) {
    console.error('创建律师失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '创建律师失败'
    });
  }
};

const getLawyers = async (req, res) => {
  try {
    const { status, specialty } = req.query;
    
    let sql = 'SELECT * FROM lawyers';
    let params = [];
    let conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (specialty) {
      conditions.push('specialty = ?');
      params.push(specialty);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY name';

    const lawyers = await allQuery(sql, params);
    res.json(lawyers);
  } catch (err) {
    console.error('获取律师列表失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '获取律师列表失败'
    });
  }
};

const assignCase = async (req, res) => {
  try {
    const { case_id, lawyer_id, assigned_by } = req.body;

    const caseData = await getQuery('SELECT * FROM cases WHERE id = ?', [case_id]);
    if (!caseData) {
      return res.status(404).json({
        error: '未找到',
        message: '案件不存在'
      });
    }

    const lawyer = await getQuery('SELECT * FROM lawyers WHERE id = ?', [lawyer_id]);
    if (!lawyer) {
      return res.status(404).json({
        error: '未找到',
        message: '律师不存在'
      });
    }

    if (lawyer.current_load >= lawyer.capacity) {
      return res.status(400).json({
        error: '容量不足',
        message: '该律师已达到最大案件容量'
      });
    }

    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO assignments (id, case_id, lawyer_id, assigned_by, assigned_at, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [uuidv4(), case_id, lawyer_id, assigned_by, now]
    );

    await runQuery(
      'UPDATE cases SET assigned_lawyer_id = ?, status = ?, updated_at = ? WHERE id = ?',
      [lawyer_id, 'assigned', now, case_id]
    );

    await runQuery(
      'UPDATE lawyers SET current_load = current_load + 1, updated_at = ? WHERE id = ?',
      [now, lawyer_id]
    );

    await runQuery(
      `INSERT INTO status_history (id, case_id, previous_status, new_status, changed_by, change_reason, created_at)
       VALUES (?, ?, ?, 'assigned', ?, '案件分派给律师', ?)`,
      [uuidv4(), case_id, caseData.status, assigned_by, now]
    );

    const updatedCase = await getQuery(
      `SELECT c.*, l.name as assigned_lawyer_name FROM cases c 
       LEFT JOIN lawyers l ON c.assigned_lawyer_id = l.id 
       WHERE c.id = ?`,
      [case_id]
    );

    res.json(updatedCase);
  } catch (err) {
    console.error('分派案件失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '分派案件失败'
    });
  }
};

const reassignCase = async (req, res) => {
  try {
    const { case_id, to_lawyer_id, reason, reassigned_by, follow_up_required } = req.body;

    const caseData = await getQuery('SELECT * FROM cases WHERE id = ?', [case_id]);
    if (!caseData) {
      return res.status(404).json({
        error: '未找到',
        message: '案件不存在'
      });
    }

    const fromLawyerId = caseData.assigned_lawyer_id;

    const toLawyer = await getQuery('SELECT * FROM lawyers WHERE id = ?', [to_lawyer_id]);
    if (!toLawyer) {
      return res.status(404).json({
        error: '未找到',
        message: '目标律师不存在'
      });
    }

    if (toLawyer.current_load >= toLawyer.capacity) {
      return res.status(400).json({
        error: '容量不足',
        message: '目标律师已达到最大案件容量'
      });
    }

    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO reassignment_records 
       (id, case_id, from_lawyer_id, to_lawyer_id, reason, reassigned_by, follow_up_required, follow_up_completed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [uuidv4(), case_id, fromLawyerId, to_lawyer_id, reason, reassigned_by, follow_up_required ? 1 : 0, now]
    );

    if (fromLawyerId) {
      await runQuery(
        'UPDATE lawyers SET current_load = current_load - 1, updated_at = ? WHERE id = ?',
        [now, fromLawyerId]
      );
    }

    await runQuery(
      'UPDATE lawyers SET current_load = current_load + 1, updated_at = ? WHERE id = ?',
      [now, to_lawyer_id]
    );

    await runQuery(
      'UPDATE cases SET assigned_lawyer_id = ?, status = ?, updated_at = ? WHERE id = ?',
      [to_lawyer_id, 'assigned', now, case_id]
    );

    await runQuery(
      `INSERT INTO status_history (id, case_id, previous_status, new_status, changed_by, change_reason, created_at)
       VALUES (?, ?, ?, 'assigned', ?, '案件转派', ?)`,
      [uuidv4(), case_id, caseData.status, reassigned_by, now]
    );

    const updatedCase = await getQuery(
      `SELECT c.*, l.name as assigned_lawyer_name FROM cases c 
       LEFT JOIN lawyers l ON c.assigned_lawyer_id = l.id 
       WHERE c.id = ?`,
      [case_id]
    );

    res.json(updatedCase);
  } catch (err) {
    console.error('转派案件失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '转派案件失败'
    });
  }
};

const completeFollowUp = async (req, res) => {
  try {
    const { reassignment_id } = req.params;
    const { follow_up_note, completed_by } = req.body;

    const reassignment = await getQuery('SELECT * FROM reassignment_records WHERE id = ?', [reassignment_id]);
    if (!reassignment) {
      return res.status(404).json({
        error: '未找到',
        message: '转派记录不存在'
      });
    }

    const now = new Date().toISOString();

    await runQuery(
      `UPDATE reassignment_records 
       SET follow_up_completed = 1, follow_up_note = ?, follow_up_by = ?, follow_up_at = ?
       WHERE id = ?`,
      [follow_up_note, completed_by, now, reassignment_id]
    );

    const updatedRecord = await getQuery('SELECT * FROM reassignment_records WHERE id = ?', [reassignment_id]);
    res.json(updatedRecord);
  } catch (err) {
    console.error('完成回访失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '完成回访失败'
    });
  }
};

const getReassignments = async (req, res) => {
  try {
    const { case_id, follow_up_required } = req.query;
    
    let sql = `
      SELECT r.*, l1.name as from_lawyer_name, l2.name as to_lawyer_name 
      FROM reassignment_records r 
      LEFT JOIN lawyers l1 ON r.from_lawyer_id = l1.id 
      LEFT JOIN lawyers l2 ON r.to_lawyer_id = l2.id 
      WHERE 1=1
    `;
    let params = [];

    if (case_id) {
      sql += ' AND r.case_id = ?';
      params.push(case_id);
    }

    if (follow_up_required === 'true') {
      sql += ' AND r.follow_up_required = 1';
    }

    sql += ' ORDER BY r.created_at DESC';

    const reassignments = await allQuery(sql, params);
    res.json(reassignments);
  } catch (err) {
    console.error('获取转派记录失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '获取转派记录失败'
    });
  }
};

module.exports = {
  createLawyer,
  getLawyers,
  assignCase,
  reassignCase,
  completeFollowUp,
  getReassignments
};
