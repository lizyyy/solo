const db = require('../database/init');
const { validateRecord, validateStatusTransition } = require('../utils/validator');
const { STATUS_FLOW, STATUS_LABELS } = require('../utils/constants');
const { calculateRecordDetail, calculateCompensationSummary } = require('../utils/calculator');

function getRecords(req, res) {
  const { page = 1, limit = 20, status, pool_type, start_date, end_date } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM water_temp_records WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (pool_type) {
    query += ' AND pool_type = ?';
    params.push(pool_type);
  }
  if (start_date) {
    query += ' AND record_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND record_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY record_date DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const records = rows.map(calculateRecordDetail);

    db.get('SELECT COUNT(*) as total FROM water_temp_records', [], (err, countRow) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      res.json({
        success: true,
        data: records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countRow.total
        }
      });
    });
  });
}

function getRecordById(req, res) {
  const { id } = req.params;
  db.get('SELECT * FROM water_temp_records WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    res.json({
      success: true,
      data: calculateRecordDetail(row)
    });
  });
}

function createRecord(req, res) {
  const validation = validateRecord(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: validation.errors
    });
  }

  db.get('SELECT id FROM water_temp_records WHERE record_no = ?', [validation.data.record_no], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (row) {
      return res.status(400).json({
        success: false,
        message: '记录编号已存在'
      });
    }

    const data = validation.data;
    const status = (data.is_temp_compliant === 0 && data.is_compensation_consistent === 1) 
      ? 'manual_review' 
      : 'pending';
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO water_temp_records (
        record_no, pool_name, pool_no, pool_type, record_date, time_slot,
        time_slot_start, time_slot_end, standard_temp_min, standard_temp_max,
        actual_temp, measure_time, measure_person, is_temp_compliant, affected_periods,
        course_id, course_name, coach_name, registered_count, attended_count,
        need_compensation, compensation_type, compensation_amount, compensation_quantity,
        compensation_table_version, is_compensation_consistent, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.record_no, data.pool_name, data.pool_no, data.pool_type, data.record_date, data.time_slot,
        data.time_slot_start, data.time_slot_end, data.standard_temp_min, data.standard_temp_max,
        data.actual_temp, data.measure_time, data.measure_person, data.is_temp_compliant, data.affected_periods,
        data.course_id, data.course_name, data.coach_name, data.registered_count, data.attended_count,
        data.need_compensation, data.compensation_type, data.compensation_amount, data.compensation_quantity,
        data.compensation_table_version, data.is_compensation_consistent, status, now, now
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        res.json({
          success: true,
          message: '创建成功',
          id: this.lastID,
          status
        });
      }
    );
  });
}

function updateRecordStatus(req, res) {
  const { id } = req.params;
  const { new_status, operator, remark } = req.body;

  if (!new_status || !operator) {
    return res.status(400).json({
      success: false,
      message: '新状态和操作人是必填字段'
    });
  }

  db.get('SELECT status FROM water_temp_records WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    if (!validateStatusTransition(row.status, new_status, STATUS_FLOW)) {
      return res.status(400).json({
        success: false,
        message: `状态不允许从 ${STATUS_LABELS[row.status]} 直接变更为 ${STATUS_LABELS[new_status]}`,
        allowedNextStatuses: STATUS_FLOW[row.status].map(s => STATUS_LABELS[s])
      });
    }

    const now = new Date().toISOString();
    db.run(
      'UPDATE water_temp_records SET status = ?, reviewer = ?, review_time = ?, updated_at = ? WHERE id = ?',
      [new_status, operator, now, now, id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        db.run(
          'INSERT INTO status_logs (record_id, old_status, new_status, operator, remark, operation_time) VALUES (?, ?, ?, ?, ?, ?)',
          [id, row.status, new_status, operator, remark || '', now],
          function(logErr) {
            if (logErr) {
              console.error('状态日志写入失败:', logErr);
            }
          }
        );

        res.json({
          success: true,
          message: '状态更新成功',
          old_status: row.status,
          new_status
        });
      }
    );
  });
}

function manualReviewAndProceed(req, res) {
  const { id } = req.params;
  const { operator, manual_remark, new_status } = req.body;

  if (!operator || !manual_remark) {
    return res.status(400).json({
      success: false,
      message: '操作人和人工备注是必填字段'
    });
  }

  db.get('SELECT status, is_temp_compliant, is_compensation_consistent FROM water_temp_records WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    if (row.status !== 'manual_review') {
      return res.status(400).json({
        success: false,
        message: '只有待人工处理状态的记录才能进行人工审核'
      });
    }

    const targetStatus = new_status || 'confirmed';
    if (!['confirmed', 'cancelled', 'compensating'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: '人工审核后状态只能变更为已确认、补偿中或已取消'
      });
    }

    const now = new Date().toISOString();
    db.run(
      'UPDATE water_temp_records SET status = ?, manual_remark = ?, reviewer = ?, review_time = ?, updated_at = ? WHERE id = ?',
      [targetStatus, manual_remark, operator, now, now, id],
      function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        db.run(
          'INSERT INTO status_logs (record_id, old_status, new_status, operator, remark, operation_time) VALUES (?, ?, ?, ?, ?, ?)',
          [id, 'manual_review', targetStatus, operator, manual_remark, now],
          function(logErr) {
            if (logErr) {
              console.error('状态日志写入失败:', logErr);
            }
          }
        );

        res.json({
          success: true,
          message: '人工审核完成，记录已继续推进',
          id,
          old_status: 'manual_review',
          new_status: targetStatus,
          manual_remark
        });
      }
    );
  });
}

function getStatusLogs(req, res) {
  const { id } = req.params;
  db.all(
    'SELECT * FROM status_logs WHERE record_id = ? ORDER BY operation_time DESC',
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      const logs = rows.map(log => ({
        ...log,
        old_status_label: log.old_status ? STATUS_LABELS[log.old_status] : null,
        new_status_label: STATUS_LABELS[log.new_status]
      }));
      res.json({ success: true, data: logs });
    }
  );
}

function getSummary(req, res) {
  db.all('SELECT * FROM water_temp_records', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    const summary = calculateCompensationSummary(rows);
    res.json({ success: true, data: summary });
  });
}

module.exports = {
  getRecords,
  getRecordById,
  createRecord,
  updateRecordStatus,
  manualReviewAndProceed,
  getStatusLogs,
  getSummary
};