const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../utils/db');
const { Parser } = require('json2csv');

const VALID_DOMAINS = ['civil', 'criminal', 'commercial', 'labor', 'intellectual_property', 'family', 'administrative', 'bankruptcy'];
const VALID_STATUSES = ['pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled'];

const createCase = async (req, res) => {
  try {
    const { case_number, title, opposing_party, case_domain, priority, created_by } = req.body;

    if (!VALID_DOMAINS.includes(case_domain)) {
      return res.status(400).json({
        error: '无效的案件领域',
        message: `案件领域必须是以下值之一: ${VALID_DOMAINS.join(', ')}`
      });
    }

    const existingCase = await getQuery('SELECT id FROM cases WHERE case_number = ?', [case_number]);
    if (existingCase) {
      return res.status(409).json({
        error: '案件已存在',
        message: '案件编号已被使用'
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO cases (id, case_number, title, opposing_party, case_domain, status, priority, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [id, case_number, title, opposing_party, case_domain, priority || 'medium', created_by, now, now]
    );

    await runQuery(
      `INSERT INTO status_history (id, case_id, previous_status, new_status, changed_by, change_reason, created_at)
       VALUES (?, ?, NULL, 'pending', ?, '案件创建', ?)`,
      [uuidv4(), id, created_by, now]
    );

    await runQuery(
      `INSERT INTO lead_funnel (id, case_id, stage, entered_at, notes)
       VALUES (?, ?, 'lead', ?, '新案件线索')`,
      [uuidv4(), id, now]
    );

    const newCase = await getQuery('SELECT * FROM cases WHERE id = ?', [id]);
    res.status(201).json(newCase);
  } catch (err) {
    console.error('创建案件失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '创建案件失败'
    });
  }
};

const getCases = async (req, res) => {
  try {
    const { status, case_domain, assigned_lawyer_id, limit, offset } = req.query;
    
    let sql = `SELECT c.*, l.name as assigned_lawyer_name FROM cases c LEFT JOIN lawyers l ON c.assigned_lawyer_id = l.id`;
    let params = [];
    let conditions = [];

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }
    if (case_domain) {
      conditions.push('c.case_domain = ?');
      params.push(case_domain);
    }
    if (assigned_lawyer_id) {
      conditions.push('c.assigned_lawyer_id = ?');
      params.push(assigned_lawyer_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY c.created_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    if (offset) {
      sql += ' OFFSET ?';
      params.push(parseInt(offset));
    }

    const cases = await allQuery(sql, params);
    const total = await getQuery('SELECT COUNT(*) as count FROM cases');

    res.json({
      data: cases,
      total: total.count,
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : null
    });
  } catch (err) {
    console.error('获取案件列表失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '获取案件列表失败'
    });
  }
};

const getCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const caseData = await getQuery(
      `SELECT c.*, l.name as assigned_lawyer_name FROM cases c 
       LEFT JOIN lawyers l ON c.assigned_lawyer_id = l.id 
       WHERE c.id = ?`,
      [id]
    );

    if (!caseData) {
      return res.status(404).json({
        error: '未找到',
        message: '案件不存在'
      });
    }

    const statusHistory = await allQuery(
      'SELECT * FROM status_history WHERE case_id = ? ORDER BY created_at DESC',
      [id]
    );

    const modifications = await allQuery(
      'SELECT * FROM case_modifications WHERE case_id = ? ORDER BY created_at DESC',
      [id]
    );

    const conflictChecks = await allQuery(
      'SELECT * FROM conflict_checks WHERE case_id = ? ORDER BY created_at DESC',
      [id]
    );

    const reassignments = await allQuery(
      `SELECT r.*, l1.name as from_lawyer_name, l2.name as to_lawyer_name 
       FROM reassignment_records r 
       LEFT JOIN lawyers l1 ON r.from_lawyer_id = l1.id 
       LEFT JOIN lawyers l2 ON r.to_lawyer_id = l2.id 
       WHERE r.case_id = ? ORDER BY r.created_at DESC`,
      [id]
    );

    res.json({
      ...caseData,
      status_history: statusHistory,
      modifications: modifications,
      conflict_checks: conflictChecks,
      reassignments: reassignments
    });
  } catch (err) {
    console.error('获取案件详情失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '获取案件详情失败'
    });
  }
};

const updateCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, opposing_party, case_domain, priority, modified_by } = req.body;

    const existingCase = await getQuery('SELECT * FROM cases WHERE id = ?', [id]);
    if (!existingCase) {
      return res.status(404).json({
        error: '未找到',
        message: '案件不存在'
      });
    }

    if (case_domain && !VALID_DOMAINS.includes(case_domain)) {
      return res.status(400).json({
        error: '无效的案件领域',
        message: `案件领域必须是以下值之一: ${VALID_DOMAINS.join(', ')}`
      });
    }

    const updates = [];
    const params = [];
    const now = new Date().toISOString();

    const fieldsToCheck = [
      { field: 'title', value: title },
      { field: 'opposing_party', value: opposing_party },
      { field: 'case_domain', value: case_domain },
      { field: 'priority', value: priority }
    ];

    for (const { field, value } of fieldsToCheck) {
      if (value !== undefined && value !== existingCase[field]) {
        updates.push(`${field} = ?`);
        params.push(value);

        await runQuery(
          `INSERT INTO case_modifications (id, case_id, field_name, old_value, new_value, modified_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, field, existingCase[field], value, modified_by, now]
        );
      }
    }

    if (updates.length === 0) {
      return res.json(existingCase);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await runQuery(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`, params);

    const updatedCase = await getQuery('SELECT * FROM cases WHERE id = ?', [id]);
    res.json(updatedCase);
  } catch (err) {
    console.error('更新案件失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '更新案件失败'
    });
  }
};

const changeCaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_status, changed_by, change_reason } = req.body;

    if (!VALID_STATUSES.includes(new_status)) {
      return res.status(400).json({
        error: '无效的状态',
        message: `状态必须是以下值之一: ${VALID_STATUSES.join(', ')}`
      });
    }

    const existingCase = await getQuery('SELECT * FROM cases WHERE id = ?', [id]);
    if (!existingCase) {
      return res.status(404).json({
        error: '未找到',
        message: '案件不存在'
      });
    }

    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO status_history (id, case_id, previous_status, new_status, changed_by, change_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), id, existingCase.status, new_status, changed_by, change_reason || '状态变更', now]
    );

    await runQuery(
      'UPDATE cases SET status = ?, updated_at = ? WHERE id = ?',
      [new_status, now, id]
    );

    if (new_status === 'assigned') {
      await runQuery(
        `INSERT INTO lead_funnel (id, case_id, stage, entered_at, notes)
         VALUES (?, ?, 'qualified', ?, '案件已分派')`,
        [uuidv4(), id, now]
      );
    } else if (new_status === 'in_progress') {
      await runQuery(
        `INSERT INTO lead_funnel (id, case_id, stage, entered_at, notes)
         VALUES (?, ?, 'proposal', ?, '案件处理中')`,
        [uuidv4(), id, now]
      );
    } else if (new_status === 'completed') {
      await runQuery(
        `INSERT INTO lead_funnel (id, case_id, stage, entered_at, notes)
         VALUES (?, ?, 'closed', ?, '案件已完成')`,
        [uuidv4(), id, now]
      );
    }

    const updatedCase = await getQuery('SELECT * FROM cases WHERE id = ?', [id]);
    res.json(updatedCase);
  } catch (err) {
    console.error('变更案件状态失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '变更案件状态失败'
    });
  }
};

const checkConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const { opposing_party, checked_by } = req.body;

    const existingCase = await getQuery('SELECT * FROM cases WHERE id = ?', [id]);
    if (!existingCase) {
      return res.status(404).json({
        error: '未找到',
        message: '案件不存在'
      });
    }

    const similarCases = await allQuery(
      'SELECT * FROM cases WHERE opposing_party = ? AND id != ?',
      [opposing_party, id]
    );

    const hasConflict = similarCases.length > 0;
    const result = hasConflict ? 'conflict' : 'no_conflict';
    const details = hasConflict 
      ? `发现 ${similarCases.length} 个涉及相同对方主体的案件: ${similarCases.map(c => c.case_number).join(', ')}`
      : '未发现冲突';

    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO conflict_checks (id, case_id, opposing_party, check_result, conflict_details, checked_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), id, opposing_party, result, details, checked_by, now]
    );

    await runQuery(
      'UPDATE cases SET conflict_status = ?, updated_at = ? WHERE id = ?',
      [hasConflict ? 'has_conflict' : 'verified', now, id]
    );

    res.json({
      has_conflict: hasConflict,
      result: result,
      details: details,
      similar_cases: similarCases
    });
  } catch (err) {
    console.error('冲突检索失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '冲突检索失败'
    });
  }
};

const exportCases = async (req, res) => {
  try {
    const { responsible_person, start_date, end_date, case_domain, status } = req.query;

    let sql = `
      SELECT 
        c.case_number,
        c.title,
        c.opposing_party,
        c.case_domain,
        c.status,
        c.priority,
        l.name as assigned_lawyer,
        c.created_by,
        c.created_at,
        c.updated_at
      FROM cases c 
      LEFT JOIN lawyers l ON c.assigned_lawyer_id = l.id
      WHERE 1=1
    `;
    let params = [];

    if (responsible_person) {
      sql += ' AND c.created_by = ?';
      params.push(responsible_person);
    }

    if (start_date) {
      sql += ' AND c.created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND c.created_at <= ?';
      params.push(end_date);
    }

    if (case_domain) {
      sql += ' AND c.case_domain = ?';
      params.push(case_domain);
    }

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.created_at DESC';

    const cases = await allQuery(sql, params);

    const domainMap = {
      civil: '民事',
      criminal: '刑事',
      commercial: '商事',
      labor: '劳动',
      intellectual_property: '知识产权',
      family: '家事',
      administrative: '行政',
      bankruptcy: '破产'
    };

    const statusMap = {
      pending: '待处理',
      assigned: '已分派',
      in_progress: '处理中',
      review: '复核中',
      completed: '已完成',
      cancelled: '已取消'
    };

    const formattedCases = cases.map(c => ({
      '案件编号': c.case_number,
      '案件标题': c.title,
      '对方主体': c.opposing_party,
      '案件领域': domainMap[c.case_domain] || c.case_domain,
      '状态': statusMap[c.status] || c.status,
      '优先级': c.priority,
      '指派律师': c.assigned_lawyer || '未指派',
      '创建人': c.created_by,
      '创建时间': c.created_at,
      '更新时间': c.updated_at
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(formattedCases);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cases_export_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('导出案件失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '导出案件失败'
    });
  }
};

const getLeadFunnel = async (req, res) => {
  try {
    const stages = await allQuery(`
      SELECT 
        stage,
        COUNT(DISTINCT case_id) as count,
        MIN(entered_at) as earliest_date,
        MAX(entered_at) as latest_date
      FROM lead_funnel
      GROUP BY stage
      ORDER BY 
        CASE stage
          WHEN 'lead' THEN 1
          WHEN 'qualified' THEN 2
          WHEN 'proposal' THEN 3
          WHEN 'negotiation' THEN 4
          WHEN 'closed' THEN 5
          ELSE 6
        END
    `);

    const stageNames = {
      lead: '线索',
      qualified: '已确认',
      proposal: '方案中',
      negotiation: '协商中',
      closed: '已结案'
    };

    const funnel = stages.map(s => ({
      stage: s.stage,
      stage_name: stageNames[s.stage] || s.stage,
      count: s.count,
      percentage: 0
    }));

    const total = funnel.reduce((acc, f) => acc + f.count, 0);
    if (total > 0) {
      funnel.forEach(f => {
        f.percentage = Math.round((f.count / total) * 100);
      });
    }

    res.json({
      funnel: funnel,
      total: total
    });
  } catch (err) {
    console.error('获取线索漏斗失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '获取线索漏斗失败'
    });
  }
};

const getStatistics = async (req, res) => {
  try {
    const totalCases = await getQuery('SELECT COUNT(*) as count FROM cases');
    const pendingCases = await getQuery("SELECT COUNT(*) as count FROM cases WHERE status = 'pending'");
    const inProgressCases = await getQuery("SELECT COUNT(*) as count FROM cases WHERE status = 'in_progress'");
    const completedCases = await getQuery("SELECT COUNT(*) as count FROM cases WHERE status = 'completed'");
    const hasConflictCases = await getQuery("SELECT COUNT(*) as count FROM cases WHERE conflict_status = 'has_conflict'");

    const casesByDomain = await allQuery(`
      SELECT case_domain, COUNT(*) as count 
      FROM cases 
      GROUP BY case_domain
    `);

    const domainMap = {
      civil: '民事',
      criminal: '刑事',
      commercial: '商事',
      labor: '劳动',
      intellectual_property: '知识产权',
      family: '家事',
      administrative: '行政',
      bankruptcy: '破产'
    };

    const formattedByDomain = casesByDomain.map(d => ({
      domain: d.case_domain,
      domain_name: domainMap[d.case_domain] || d.case_domain,
      count: d.count
    }));

    res.json({
      total_cases: totalCases.count,
      pending_cases: pendingCases.count,
      in_progress_cases: inProgressCases.count,
      completed_cases: completedCases.count,
      has_conflict_cases: hasConflictCases.count,
      cases_by_domain: formattedByDomain
    });
  } catch (err) {
    console.error('获取统计数据失败:', err);
    res.status(500).json({
      error: '服务器错误',
      message: '获取统计数据失败'
    });
  }
};

module.exports = {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  changeCaseStatus,
  checkConflict,
  exportCases,
  getLeadFunnel,
  getStatistics,
  VALID_DOMAINS
};
