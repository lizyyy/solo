const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../models/database');

router.get('/export', (req, res) => {
  const { 
    processedBy, 
    startDate, 
    endDate, 
    debtType, 
    includeOverdue, 
    includeDamage, 
    includeLost,
    reportType = 'debts'
  } = req.query;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '图书馆赔偿系统';
  workbook.created = new Date();

  let query, params = [], sheetName;

  if (reportType === 'borrows') {
    sheetName = '借阅记录';
    query = `
      SELECT 
        r.name as 读者姓名,
        r.student_id as 学号,
        b.title as 图书名称,
        b.isbn,
        br.borrow_date as 借阅日期,
        br.due_date as 应还日期,
        br.return_date as 归还日期,
        CASE WHEN br.is_overdue = 1 THEN '是' ELSE '否' END as 是否逾期,
        br.overdue_days as 逾期天数,
        br.overdue_fine as 逾期费用,
        dl.level_name as 破损等级,
        br.damage_compensation as 破损赔偿,
        br.status as 状态,
        s.name as 处理人,
        br.created_at as 创建时间
      FROM borrow_records br
      LEFT JOIN readers r ON br.reader_id = r.id
      LEFT JOIN books b ON br.book_id = b.id
      LEFT JOIN damage_levels dl ON br.damage_level_id = dl.id
      LEFT JOIN staff s ON br.processed_by = s.id
      WHERE 1=1
    `;
    
    if (startDate) {
      query += ' AND br.borrow_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND br.borrow_date <= ?';
      params.push(endDate);
    }
    if (processedBy) {
      query += ' AND br.processed_by = ?';
      params.push(processedBy);
    }
  } else {
    sheetName = '欠费记录';
    query = `
      SELECT 
        r.name as 读者姓名,
        r.student_id as 学号,
        b.title as 图书名称,
        CASE rd.debt_type 
          WHEN 'overdue' THEN '逾期费用'
          WHEN 'damage' THEN '破损赔偿'
          WHEN 'lost' THEN '遗失赔偿'
          ELSE rd.debt_type 
        END as 费用类型,
        rd.original_amount as 原始金额,
        rd.reduction_amount as 减免金额,
        rd.final_amount as 最终金额,
        CASE WHEN rd.is_paid = 1 THEN '已缴' ELSE '未缴' END as 缴费状态,
        rd.paid_date as 缴费日期,
        s.name as 处理人,
        rd.remarks as 备注,
        rd.created_at as 创建时间
      FROM reader_debts rd
      LEFT JOIN readers r ON rd.reader_id = r.id
      LEFT JOIN borrow_records br ON rd.borrow_record_id = br.id
      LEFT JOIN books b ON br.book_id = b.id
      LEFT JOIN staff s ON rd.processed_by = s.id
      WHERE 1=1
    `;

    const typeConditions = [];
    if (includeOverdue === 'true') typeConditions.push("rd.debt_type = 'overdue'");
    if (includeDamage === 'true') typeConditions.push("rd.debt_type = 'damage'");
    if (includeLost === 'true') typeConditions.push("rd.debt_type = 'lost'");
    
    if (typeConditions.length > 0) {
      query += ' AND (' + typeConditions.join(' OR ') + ')';
    } else if (debtType) {
      query += ' AND rd.debt_type = ?';
      params.push(debtType);
    }

    if (startDate) {
      query += ' AND rd.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND rd.created_at <= ?';
      params.push(endDate);
    }
    if (processedBy) {
      query += ' AND rd.processed_by = ?';
      params.push(processedBy);
    }
  }

  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.json({ success: false, message: err.message });
    }

    const worksheet = workbook.addWorksheet(sheetName);
    
    if (rows.length > 0) {
      worksheet.columns = Object.keys(rows[0]).map(key => ({
        header: key,
        key: key,
        width: 15
      }));

      rows.forEach(row => {
        worksheet.addRow(row);
      });

      worksheet.getRow(1).font = { bold: true };
    }

    const fileName = `${sheetName}_${new Date().toISOString().slice(0,10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    workbook.xlsx.write(res).then(() => {
      res.end();
    }).catch(error => {
      res.json({ success: false, message: error.message });
    });
  });
});

router.get('/summary', (req, res) => {
  const { startDate, endDate } = req.query;
  const summary = {};

  db.get(`
    SELECT COUNT(*) as total, SUM(final_amount) as total_amount
    FROM reader_debts
    WHERE is_paid = 0
    ${startDate ? 'AND created_at >= ?' : ''}
    ${endDate ? 'AND created_at <= ?' : ''}
  `, [startDate, endDate].filter(Boolean), (err, row) => {
    summary.unpaid = { count: row.total || 0, amount: row.total_amount || 0 };

    db.get(`
      SELECT COUNT(*) as total, SUM(final_amount) as total_amount
      FROM reader_debts
      WHERE is_paid = 1
      ${startDate ? 'AND created_at >= ?' : ''}
      ${endDate ? 'AND created_at <= ?' : ''}
    `, [startDate, endDate].filter(Boolean), (err, row) => {
      summary.paid = { count: row.total || 0, amount: row.total_amount || 0 };

      db.get(`
        SELECT COUNT(*) as total, SUM(compensation_amount) as total_amount
        FROM lost_compensation
        WHERE is_paid = 0
      `, (err, row) => {
        summary.lost = { count: row.total || 0, amount: row.total_amount || 0 };

        db.get(`
          SELECT COUNT(*) as total
          FROM reduction_approvals
          WHERE approval_status = 'pending'
        `, (err, row) => {
          summary.pendingReduction = { count: row.total || 0 };

          db.all(`
            SELECT 
              debt_type,
              COUNT(*) as count,
              SUM(final_amount) as amount
            FROM reader_debts
            GROUP BY debt_type
          `, (err, rows) => {
            summary.byType = rows || [];
            res.json({ success: true, data: summary });
          });
        });
      });
    });
  });
});

module.exports = router;
