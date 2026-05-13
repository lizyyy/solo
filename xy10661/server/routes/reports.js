const express = require('express');
const router = express.Router();
const db = require('../database/db');
const ExcelJS = require('exceljs');
const moment = require('moment');

router.get('/export', async (req, res) => {
  const { responsible_party, start_date, end_date, status } = req.query;
  
  let query = `
    SELECT 
      p.id,
      p.waybill_no,
      p.status,
      p.weight,
      p.destination,
      p.receiver,
      p.created_at,
      mr.reviewer,
      mr.review_time,
      mr.review_result,
      mr.responsible_party,
      mr.review_notes,
      mr.before_data,
      mr.after_data
    FROM packages p
    LEFT JOIN manual_reviews mr ON p.id = mr.package_id
    WHERE 1=1
  `;
  const params = [];

  if (responsible_party) {
    query += ' AND mr.responsible_party = ?';
    params.push(responsible_party);
  }
  if (start_date) {
    query += ' AND mr.review_time >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND mr.review_time <= ?';
    params.push(end_date);
  }
  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }

  query += ' ORDER BY mr.review_time DESC';

  db.all(query, params, async (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('异常复核报告');

    worksheet.columns = [
      { header: '运单号', key: 'waybill_no', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '重量(kg)', key: 'weight', width: 12 },
      { header: '目的地', key: 'destination', width: 15 },
      { header: '收件人', key: 'receiver', width: 12 },
      { header: '复核人', key: 'reviewer', width: 12 },
      { header: '复核时间', key: 'review_time', width: 20 },
      { header: '复核结果', key: 'review_result', width: 12 },
      { header: '责任方', key: 'responsible_party', width: 15 },
      { header: '复核备注', key: 'review_notes', width: 30 },
      { header: '修改前数据', key: 'before_data', width: 30 },
      { header: '修改后数据', key: 'after_data', width: 30 },
      { header: '创建时间', key: 'created_at', width: 20 }
    ];

    const statusMap = {
      pending: '待处理',
      scanning: '扫码中',
      sorting: '分拣中',
      weighting: '称重中',
      exception: '异常',
      reviewing: '复核中',
      rethrowing: '重新投线',
      completed: '已完成'
    };

    const resultMap = {
      pass: '通过',
      reject: '驳回'
    };

    rows.forEach(row => {
      worksheet.addRow({
        waybill_no: row.waybill_no,
        status: statusMap[row.status] || row.status,
        weight: row.weight,
        destination: row.destination,
        receiver: row.receiver,
        reviewer: row.reviewer || '-',
        review_time: row.review_time || '-',
        review_result: resultMap[row.review_result] || row.review_result || '-',
        responsible_party: row.responsible_party || '-',
        review_notes: row.review_notes || '-',
        before_data: row.before_data || '-',
        after_data: row.after_data || '-',
        created_at: row.created_at
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
    res.setHeader('Content-Disposition', `attachment; filename=warehouse_review_report_${moment().format('YYYYMMDDHHmmss')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  });
});

router.get('/responsibility', (req, res) => {
  db.all(`
    SELECT 
      responsible_party,
      COUNT(*) as count,
      GROUP_CONCAT(DISTINCT review_result) as results
    FROM manual_reviews
    WHERE responsible_party IS NOT NULL
    GROUP BY responsible_party
    ORDER BY count DESC
  `, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

router.get('/list', (req, res) => {
  const { responsible_party, start_date, end_date, status, page = 1, limit = 20 } = req.query;
  
  let countQuery = `
    SELECT COUNT(*) as total
    FROM packages p
    LEFT JOIN manual_reviews mr ON p.id = mr.package_id
    WHERE 1=1
  `;
  
  let dataQuery = `
    SELECT 
      p.id,
      p.waybill_no,
      p.status,
      p.weight,
      p.destination,
      p.receiver,
      p.created_at,
      mr.reviewer,
      mr.review_time,
      mr.review_result,
      mr.responsible_party,
      mr.review_notes
    FROM packages p
    LEFT JOIN manual_reviews mr ON p.id = mr.package_id
    WHERE 1=1
  `;
  
  const params = [];
  const countParams = [];

  if (responsible_party) {
    dataQuery += ' AND mr.responsible_party = ?';
    countQuery += ' AND mr.responsible_party = ?';
    params.push(responsible_party);
    countParams.push(responsible_party);
  }
  if (start_date) {
    dataQuery += ' AND mr.review_time >= ?';
    countQuery += ' AND mr.review_time >= ?';
    params.push(start_date);
    countParams.push(start_date);
  }
  if (end_date) {
    dataQuery += ' AND mr.review_time <= ?';
    countQuery += ' AND mr.review_time <= ?';
    params.push(end_date);
    countParams.push(end_date);
  }
  if (status) {
    dataQuery += ' AND p.status = ?';
    countQuery += ' AND p.status = ?';
    params.push(status);
    countParams.push(status);
  }

  dataQuery += ' ORDER BY mr.review_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.get(countQuery, countParams, (err, countResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    db.all(dataQuery, params, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        data: rows,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  });
});

module.exports = router;
