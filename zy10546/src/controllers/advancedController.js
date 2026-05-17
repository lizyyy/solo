const db = require('../config/database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const ALLOWED_FIELDS = ['check_content', 'rectifier', 'rectify_deadline', 'risk_level_id', 'source_type'];

exports.manualCorrection = (req, res, next) => {
  const { item_id, field_name, new_value, corrector, correction_reason } = req.body;

  if (!ALLOWED_FIELDS.includes(field_name)) {
    return res.status(400).json({ success: false, message: '不允许修改此字段' });
  }

  db.get(`SELECT ${field_name} as old_value FROM inspection_items WHERE id = ?`, [item_id], (err, item) => {
    if (err) return next(err);
    if (!item) {
      return res.status(404).json({ success: false, message: '检查项不存在' });
    }

    const oldValue = String(item.old_value || '');

    db.run(
      `UPDATE inspection_items SET ${field_name} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [new_value, item_id],
      function(updateErr) {
        if (updateErr) return next(updateErr);

        db.run(
          `INSERT INTO manual_corrections (item_id, field_name, old_value, new_value, corrector, correction_reason)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [item_id, field_name, oldValue, new_value, corrector, correction_reason],
          function(insertErr) {
            if (insertErr) return next(insertErr);

            res.json({ success: true, message: '人工修正成功' });
          }
        );
      }
    );
  });
};

exports.getExceptions = (req, res, next) => {
  const { status, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT * FROM exception_logs WHERE 1=1`;
  const params = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(pageSize), (page - 1) * pageSize);

  db.all(sql, params, (err, exceptions) => {
    if (err) return next(err);

    db.get(`SELECT COUNT(*) as total FROM exception_logs`, (countErr, result) => {
      if (countErr) return next(countErr);
      res.json({
        success: true,
        data: exceptions,
        pagination: { total: result.total, page: Number(page), pageSize: Number(pageSize) }
      });
    });
  });
};

exports.handleException = (req, res, next) => {
  const { id } = req.params;
  const { handler, handling_basis, status } = req.body;

  db.get(`SELECT * FROM exception_logs WHERE id = ?`, [id], (err, exception) => {
    if (err) return next(err);
    if (!exception) {
      return res.status(404).json({ success: false, message: '异常记录不存在' });
    }

    db.run(
      `UPDATE exception_logs 
       SET handler = ?, handling_basis = ?, handled_at = CURRENT_TIMESTAMP, status = ?
       WHERE id = ?`,
      [handler, handling_basis, status, id],
      function(updateErr) {
        if (updateErr) return next(updateErr);
        res.json({ success: true, message: '异常处理完成' });
      }
    );
  });
};

exports.getOverdueReminders = (req, res, next) => {
  const { days = 3 } = req.query;

  db.all(`
    SELECT i.*, r.level_name, r.severity, b.batch_name,
           julianday(i.rectify_deadline) - julianday('now') as days_remaining
    FROM inspection_items i
    JOIN risk_levels r ON i.risk_level_id = r.id
    JOIN inspection_batches b ON i.batch_id = b.id
    WHERE i.current_status != 'closed'
      AND julianday(i.rectify_deadline) - julianday('now') <= ?
    ORDER BY r.severity DESC, i.rectify_deadline ASC
  `, [Number(days)], (err, items) => {
    if (err) return next(err);

    const grouped = {};
    items.forEach(item => {
      const rectifier = item.rectifier || '未分配';
      if (!grouped[rectifier]) grouped[rectifier] = [];
      grouped[rectifier].push(item);
    });

    res.json({
      success: true,
      data: {
        total_overdue: items.filter(i => i.days_remaining < 0).length,
        total_near_deadline: items.filter(i => i.days_remaining >= 0).length,
        by_rectifier: grouped
      }
    });
  });
};

exports.exportToCsv = async (req, res, next) => {
  const { batch_id } = req.query;

  try {
    let sql = `
      SELECT i.item_no, b.batch_name, i.check_content, r.level_name as risk_level,
             i.current_status, i.rectifier, i.rectify_deadline, i.source_type,
             i.created_at, i.updated_at
      FROM inspection_items i
      JOIN risk_levels r ON i.risk_level_id = r.id
      JOIN inspection_batches b ON i.batch_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (batch_id) {
      sql += ` AND i.batch_id = ?`;
      params.push(batch_id);
    }
    sql += ` ORDER BY r.severity DESC`;

    const items = await new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = `inspection-export-${moment().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'item_no', title: '检查项编号' },
        { id: 'batch_name', title: '所属批次' },
        { id: 'check_content', title: '检查内容' },
        { id: 'risk_level', title: '风险等级' },
        { id: 'current_status', title: '当前状态' },
        { id: 'rectifier', title: '整改人' },
        { id: 'rectify_deadline', title: '整改截止日期' },
        { id: 'source_type', title: '来源类型' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' }
      ]
    });

    await csvWriter.writeRecords(items);

    res.download(filePath, filename, (downloadErr) => {
      if (downloadErr) {
        console.error('下载失败:', downloadErr);
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getStatistics = (req, res, next) => {
  db.all(`
    SELECT r.level_name, COUNT(*) as count
    FROM inspection_items i
    JOIN risk_levels r ON i.risk_level_id = r.id
    WHERE i.current_status != 'closed'
    GROUP BY r.id
    ORDER BY r.severity DESC
  `, (riskErr, riskDistribution) => {
    if (riskErr) return next(riskErr);

    db.all(`
      SELECT current_status, COUNT(*) as count
      FROM inspection_items
      GROUP BY current_status
    `, (statusErr, statusDistribution) => {
      if (statusErr) return next(statusErr);

      db.get(`
        SELECT COUNT(*) as overdue_count
        FROM inspection_items
        WHERE current_status != 'closed'
          AND rectify_deadline < DATE('now')
      `, (overdueErr, overdueResult) => {
        if (overdueErr) return next(overdueErr);

        db.all(`
          SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
          FROM inspection_items
          WHERE created_at >= DATE('now', '-6 months')
          GROUP BY month
          ORDER BY month
        `, (trendErr, trendData) => {
          if (trendErr) return next(trendErr);

          res.json({
            success: true,
            data: {
              risk_distribution: riskDistribution,
              status_distribution: statusDistribution,
              overdue_count: overdueResult.overdue_count,
              monthly_trend: trendData
            }
          });
        });
      });
    });
  });
};

exports.generateReport = (req, res, next) => {
  const { batch_id, report_type, generated_by } = req.body;

  db.get(`SELECT * FROM inspection_batches WHERE id = ?`, [batch_id], (err, batch) => {
    if (err) return next(err);
    if (!batch) {
      return res.status(404).json({ success: false, message: '批次不存在' });
    }

    db.all(`
      SELECT r.level_code, COUNT(*) as count
      FROM inspection_items i
      JOIN risk_levels r ON i.risk_level_id = r.id
      WHERE i.batch_id = ?
      GROUP BY r.id
    `, [batch_id], (riskErr, riskData) => {
      if (riskErr) return next(riskErr);

      db.all(`
        SELECT current_status, COUNT(*) as count
        FROM inspection_items
        WHERE batch_id = ?
        GROUP BY current_status
      `, [batch_id], (statusErr, statusData) => {
        if (statusErr) return next(statusErr);

        const reportNo = `RPT-${moment().format('YYYYMMDD')}-B${batch_id}`;
        const reportData = JSON.stringify({
          batch,
          risk_distribution: riskData,
          status_distribution: statusData,
          generated_at: new Date().toISOString()
        });

        db.run(
          `INSERT INTO inspection_reports (report_no, batch_id, report_type, generated_by, report_data, content_summary)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [reportNo, batch_id, report_type || 'summary', generated_by || 'system', reportData, `${batch.batch_name} 巡检报告`],
          function(insertErr) {
            if (insertErr) return next(insertErr);

            res.status(201).json({
              success: true,
              message: '报告生成成功',
              data: { id: this.lastID, report_no: reportNo }
            });
          }
        );
      });
    });
  });
};
