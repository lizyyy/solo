const express = require('express');
const router = express.Router();
const db = require('../config/dbUtils');
const dayjs = require('dayjs');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

router.get('/export', async (req, res) => {
  try {
    const { handler, startTime, endTime } = req.query;
    
    let exceptionsSql = `
      SELECT e.*, m.name as matter_name, a.name as attachment_name
      FROM exceptions e
      LEFT JOIN business_matters m ON e.matter_id = m.id
      LEFT JOIN attachments a ON e.attachment_id = a.id
      WHERE 1=1
    `;
    let gapsSql = `
      SELECT g.*, m.name as matter_name, it.name as identity_name, a.name as attachment_name
      FROM material_gaps g
      LEFT JOIN business_matters m ON g.matter_id = m.id
      LEFT JOIN identity_types it ON g.identity_type_id = it.id
      LEFT JOIN attachments a ON g.attachment_id = a.id
      WHERE 1=1
    `;
    let historySql = `
      SELECT h.*
      FROM change_history h
      WHERE 1=1
    `;

    const params = [];
    const gapsParams = [];
    const historyParams = [];

    if (handler) {
      exceptionsSql += ' AND e.handler LIKE ?';
      gapsSql += ' AND g.resolved_by LIKE ?';
      historySql += ' AND h.changed_by LIKE ?';
      params.push(`%${handler}%`);
      gapsParams.push(`%${handler}%`);
      historyParams.push(`%${handler}%`);
    }

    if (startTime) {
      exceptionsSql += ' AND e.created_at >= ?';
      gapsSql += ' AND g.created_at >= ?';
      historySql += ' AND h.changed_at >= ?';
      params.push(startTime);
      gapsParams.push(startTime);
      historyParams.push(startTime);
    }

    if (endTime) {
      exceptionsSql += ' AND e.created_at <= ?';
      gapsSql += ' AND g.created_at <= ?';
      historySql += ' AND h.changed_at <= ?';
      params.push(endTime);
      gapsParams.push(endTime);
      historyParams.push(endTime);
    }

    const exceptions = await db.all(exceptionsSql, params);
    const gaps = await db.all(gapsSql, gapsParams);
    const history = await db.all(historySql, historyParams);

    const fileName = `预审补正报表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(exportsDir, fileName);

    const wb = xlsx.utils.book_new();
    
    const exceptionsWS = xlsx.utils.json_to_sheet(exceptions);
    xlsx.utils.book_append_sheet(wb, exceptionsWS, '异常记录');
    
    const gapsWS = xlsx.utils.json_to_sheet(gaps);
    xlsx.utils.book_append_sheet(wb, gapsWS, '材料缺口');
    
    const historyWS = xlsx.utils.json_to_sheet(history);
    xlsx.utils.book_append_sheet(wb, historyWS, '变更历史');

    xlsx.writeFile(wb, filePath);

    res.json({
      success: true,
      data: {
        downloadUrl: `/exports/${fileName}`,
        fileName,
        exceptionsCount: exceptions.length,
        gapsCount: gaps.length,
        historyCount: history.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startTime && endTime) {
      dateFilter = ' AND created_at BETWEEN ? AND ?';
      params.push(startTime, endTime);
    }

    const gapStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END), 0) as resolved,
        COALESCE(SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END), 0) as unresolved
      FROM material_gaps
      WHERE 1=1 ${dateFilter}
    `, params);

    const exceptionStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN is_fixed = 1 THEN 1 ELSE 0 END), 0) as fixed,
        COALESCE(SUM(CASE WHEN is_fixed = 0 THEN 1 ELSE 0 END), 0) as unfixed
      FROM exceptions
      WHERE 1=1 ${dateFilter}
    `, params);

    const handlers = await db.all(`
      SELECT handler as name, COUNT(*) as count
      FROM exceptions
      WHERE handler IS NOT NULL
      GROUP BY handler
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        gapStats,
        exceptionStats,
        handlers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
