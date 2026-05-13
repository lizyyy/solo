const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const ExcelJS = require('exceljs');
const db = require('./database');

const router = express.Router();

const STATUS_FLOW = {
  pending: ['inspecting', 'cancelled'],
  inspecting: ['qualified', 'unqualified', 'rechecking'],
  qualified: ['installing', 'rework'],
  installing: ['installed', 'installation_failed'],
  installed: ['completed', 'rework'],
  unqualified: ['rework', 'scrap'],
  rework: ['rework_completed', 'scrap'],
  rework_completed: ['inspecting', 'scrap'],
  rechecking: ['qualified', 'unqualified'],
  installation_failed: ['rework', 'scrap'],
  completed: [],
  scrapped: [],
  cancelled: []
};

const validateStatusTransition = (oldStatus, newStatus) => {
  const allowedTransitions = STATUS_FLOW[oldStatus] || [];
  return allowedTransitions.includes(newStatus);
};

const validatePrototypeVersion = (version) => {
  const pattern = /^V\d+(\.\d+)*$/;
  return pattern.test(version);
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const runRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

router.get('/parts', async (req, res) => {
  try {
    const { part_number, status, page = 1, pageSize = 20 } = req.query;
    let sql = 'SELECT * FROM parts WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM parts WHERE 1=1';
    let params = [];

    if (part_number) {
      sql += ' AND part_number LIKE ?';
      countSql += ' AND part_number LIKE ?';
      params.push(`%${part_number}%`);
    }
    if (status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * pageSize;
    params.push(parseInt(pageSize), offset);

    const [parts, countResult] = await Promise.all([
      runQuery(sql, params),
      runGet(countSql, params.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: parts,
      total: countResult.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const part = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    if (!part) {
      return res.status(404).json({ success: false, error: '零件不存在' });
    }

    const [inspectionReports, installationRecords, reworkProcesses, scrapRecords, statusHistory, modificationHistory] = await Promise.all([
      runQuery('SELECT * FROM inspection_reports WHERE part_id = ? ORDER BY created_at DESC', [id]),
      runQuery('SELECT * FROM installation_records WHERE part_id = ? ORDER BY created_at DESC', [id]),
      runQuery('SELECT * FROM rework_processes WHERE part_id = ? ORDER BY created_at DESC', [id]),
      runQuery('SELECT * FROM scrap_records WHERE part_id = ? ORDER BY created_at DESC', [id]),
      runQuery('SELECT * FROM status_history WHERE part_id = ? ORDER BY changed_at DESC', [id]),
      runQuery('SELECT * FROM modification_history WHERE part_id = ? ORDER BY modified_at DESC', [id])
    ]);

    res.json({
      success: true,
      data: {
        ...part,
        inspectionReports,
        installationRecords,
        reworkProcesses,
        scrapRecords,
        statusHistory,
        modificationHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parts', async (req, res) => {
  try {
    const { part_number, prototype_version, part_name, request_id } = req.body;

    if (!part_number || !prototype_version) {
      return res.status(400).json({ success: false, error: '零件图号和试制版本不能为空' });
    }

    if (!validatePrototypeVersion(prototype_version)) {
      return res.status(400).json({ success: false, error: '试制版本格式不正确，应为V1.0、V2.1等格式' });
    }

    if (request_id) {
      const existing = await runGet(
        'SELECT * FROM parts WHERE part_number = ? AND prototype_version = ?',
        [part_number, prototype_version]
      );
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          idempotent: true,
          message: '幂等返回：该零件已存在'
        });
      }
    }

    const id = uuidv4();
    await runRun(
      'INSERT INTO parts (id, part_number, prototype_version, part_name, status) VALUES (?, ?, ?, ?, ?)',
      [id, part_number, prototype_version, part_name || '', 'pending']
    );

    await runRun(
      'INSERT INTO status_history (id, part_id, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, 'pending', 'system', '零件创建']
    );

    const part = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    res.json({ success: true, data: part });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: '该零件图号和试制版本组合已存在' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { part_number, prototype_version, part_name, modified_by } = req.body;

    const part = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    if (!part) {
      return res.status(404).json({ success: false, error: '零件不存在' });
    }

    if (prototype_version && !validatePrototypeVersion(prototype_version)) {
      return res.status(400).json({ success: false, error: '试制版本格式不正确' });
    }

    const modifications = [];
    if (part_number && part_number !== part.part_number) {
      modifications.push({ field: 'part_number', old: part.part_number, new: part_number });
    }
    if (prototype_version && prototype_version !== part.prototype_version) {
      modifications.push({ field: 'prototype_version', old: part.prototype_version, new: prototype_version });
    }
    if (part_name !== undefined && part_name !== part.part_name) {
      modifications.push({ field: 'part_name', old: part.part_name, new: part_name });
    }

    for (const mod of modifications) {
      await runRun(
        'INSERT INTO modification_history (id, part_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, mod.field, mod.old, mod.new, modified_by || 'system']
      );
    }

    await runRun(
      'UPDATE parts SET part_number = COALESCE(?, part_number), prototype_version = COALESCE(?, prototype_version), part_name = COALESCE(?, part_name), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [part_number, prototype_version, part_name, id]
    );

    const updatedPart = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    res.json({ success: true, data: updatedPart, modifications });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: '该零件图号和试制版本组合已存在' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_status, changed_by, change_reason } = req.body;

    if (!new_status) {
      return res.status(400).json({ success: false, error: '新状态不能为空' });
    }

    const part = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    if (!part) {
      return res.status(404).json({ success: false, error: '零件不存在' });
    }

    if (part.status === new_status) {
      return res.json({
        success: true,
        data: part,
        idempotent: true,
        message: '幂等返回：状态未改变'
      });
    }

    if (!validateStatusTransition(part.status, new_status)) {
      return res.status(400).json({
        success: false,
        error: `不允许从 ${part.status} 状态转换到 ${new_status} 状态`
      });
    }

    await runRun(
      'UPDATE parts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [new_status, id]
    );

    await runRun(
      'INSERT INTO status_history (id, part_id, old_status, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, part.status, new_status, changed_by || 'system', change_reason || '']
    );

    const updatedPart = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    res.json({ success: true, data: updatedPart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parts/:id/inspection', async (req, res) => {
  try {
    const { id } = req.params;
    const { report_number, inspector, inspection_date, result, remarks, request_id } = req.body;

    if (!report_number) {
      return res.status(400).json({ success: false, error: '报告编号不能为空' });
    }

    if (request_id) {
      const existing = await runGet(
        'SELECT * FROM inspection_reports WHERE part_id = ? AND report_number = ?',
        [id, report_number]
      );
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          idempotent: true,
          message: '幂等返回：检测报告已存在'
        });
      }
    }

    const reportId = uuidv4();
    await runRun(
      'INSERT INTO inspection_reports (id, part_id, report_number, inspector, inspection_date, result, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [reportId, id, report_number, inspector || '', inspection_date || null, result || '', remarks || '']
    );

    await runRun(
      'INSERT INTO modification_history (id, part_id, field_name, old_value, new_value, modified_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), id, 'inspection_report', '', report_number, inspector || 'system']
    );

    const report = await runGet('SELECT * FROM inspection_reports WHERE id = ?', [reportId]);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parts/:id/installation', async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_number, installation_date, installer, location, remarks, request_id } = req.body;

    if (request_id && vehicle_number) {
      const existing = await runGet(
        'SELECT * FROM installation_records WHERE part_id = ? AND vehicle_number = ?',
        [id, vehicle_number]
      );
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          idempotent: true,
          message: '幂等返回：装车记录已存在'
        });
      }
    }

    const recordId = uuidv4();
    await runRun(
      'INSERT INTO installation_records (id, part_id, vehicle_number, installation_date, installer, location, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [recordId, id, vehicle_number || '', installation_date || null, installer || '', location || '', remarks || '']
    );

    const record = await runGet('SELECT * FROM installation_records WHERE id = ?', [recordId]);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parts/:id/rework', async (req, res) => {
  try {
    const { id } = req.params;
    const { process_name, operator, start_time, end_time, result, remarks } = req.body;

    if (!process_name) {
      return res.status(400).json({ success: false, error: '工序名称不能为空' });
    }

    const processId = uuidv4();
    await runRun(
      'INSERT INTO rework_processes (id, part_id, process_name, operator, start_time, end_time, result, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [processId, id, process_name, operator || '', start_time || null, end_time || null, result || 'pending', remarks || '']
    );

    const process = await runGet('SELECT * FROM rework_processes WHERE id = ?', [processId]);
    res.json({ success: true, data: process });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parts/:id/scrap', async (req, res) => {
  try {
    const { id } = req.params;
    const { scrap_date, reason, responsible_person, disposal_location, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: '报废原因不能为空' });
    }

    const scrapId = uuidv4();
    await runRun(
      'INSERT INTO scrap_records (id, part_id, scrap_date, reason, responsible_person, disposal_location, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [scrapId, id, scrap_date || null, reason, responsible_person || '', disposal_location || '', remarks || '']
    );

    await runRun(
      'UPDATE parts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['scrapped', id]
    );

    const part = await runGet('SELECT * FROM parts WHERE id = ?', [id]);
    const scrap = await runGet('SELECT * FROM scrap_records WHERE id = ?', [scrapId]);

    res.json({ success: true, data: { part, scrap } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scrap-records', async (req, res) => {
  try {
    const { part_id, responsible_person, start_date, end_date } = req.query;
    let sql = `
      SELECT sr.*, p.part_number, p.prototype_version, p.part_name 
      FROM scrap_records sr 
      LEFT JOIN parts p ON sr.part_id = p.id 
      WHERE 1=1
    `;
    let params = [];

    if (part_id) {
      sql += ' AND sr.part_id = ?';
      params.push(part_id);
    }
    if (responsible_person) {
      sql += ' AND sr.responsible_person LIKE ?';
      params.push(`%${responsible_person}%`);
    }
    if (start_date) {
      sql += ' AND sr.scrap_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND sr.scrap_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY sr.scrap_date DESC';
    const records = await runQuery(sql, params);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const [totalResult, statusResult] = await Promise.all([
      runGet('SELECT COUNT(*) as total FROM parts'),
      runQuery('SELECT status, COUNT(*) as count FROM parts GROUP BY status')
    ]);

    const statusStats = {};
    statusResult.forEach(item => {
      statusStats[item.status] = item.count;
    });

    res.json({
      success: true,
      data: {
        total: totalResult.total,
        by_status: statusStats,
        pending: statusStats.pending || 0,
        inspecting: statusStats.inspecting || 0,
        qualified: statusStats.qualified || 0,
        installed: statusStats.installed || 0,
        rework: statusStats.rework || 0,
        scrapped: statusStats.scrapped || 0,
        completed: statusStats.completed || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { responsible_person, start_date, end_date, format = 'excel' } = req.query;

    let partsSql = `
      SELECT p.*,
        (SELECT GROUP_CONCAT(process_name, ', ') FROM rework_processes WHERE part_id = p.id) as rework_processes,
        (SELECT reason FROM scrap_records WHERE part_id = p.id LIMIT 1) as scrap_reason,
        (SELECT responsible_person FROM scrap_records WHERE part_id = p.id LIMIT 1) as scrap_responsible,
        (SELECT disposal_location FROM scrap_records WHERE part_id = p.id LIMIT 1) as scrap_location,
        (SELECT MAX(changed_at) FROM status_history WHERE part_id = p.id) as last_status_change
      FROM parts p
      WHERE 1=1
    `;
    let params = [];

    if (start_date) {
      partsSql += ' AND p.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      partsSql += ' AND p.created_at <= ?';
      params.push(end_date);
    }

    const parts = await runQuery(partsSql, params);

    const statusLabels = {
      pending: '待处理',
      inspecting: '检测中',
      qualified: '合格',
      unqualified: '不合格',
      installing: '装车中',
      installed: '已装车',
      installation_failed: '装车失败',
      rework: '返工中',
      rework_completed: '返工完成',
      rechecking: '复核中',
      completed: '完成',
      scrapped: '已报废',
      cancelled: '已取消'
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '试制件版本装车追踪系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('零件追踪记录');

    worksheet.columns = [
      { header: '零件图号', key: 'part_number', width: 20 },
      { header: '试制版本', key: 'prototype_version', width: 15 },
      { header: '零件名称', key: 'part_name', width: 25 },
      { header: '状态', key: 'status', width: 15 },
      { header: '返工工序', key: 'rework_processes', width: 30 },
      { header: '报废原因', key: 'scrap_reason', width: 30 },
      { header: '责任人', key: 'scrap_responsible', width: 15 },
      { header: '报废去向', key: 'scrap_location', width: 25 },
      { header: '创建时间', key: 'created_at', width: 20 },
      { header: '最后状态变更', key: 'last_status_change', width: 20 }
    ];

    parts.forEach(part => {
      worksheet.addRow({
        ...part,
        status: statusLabels[part.status] || part.status
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=试制件追踪报告_${moment().format('YYYYMMDDHHmmss')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status-flow', (req, res) => {
  res.json({ success: true, data: STATUS_FLOW });
});

module.exports = router;
