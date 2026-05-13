const express = require('express');
const db = require('../database');
const { Parser } = require('json2csv');
const router = express.Router();

router.get('/statistics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];
    if (start_date) {
      dateFilter += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND created_at <= ?';
      params.push(end_date);
    }

    const totalComplaints = await db.get(
      `SELECT COUNT(*) as count FROM complaints WHERE 1=1 ${dateFilter}`,
      params
    );

    const complaintsByStatus = await db.all(
      `SELECT current_status as status, COUNT(*) as count 
       FROM complaints 
       WHERE 1=1 ${dateFilter}
       GROUP BY current_status`,
      params
    );

    const totalAppeals = await db.get(
      `SELECT COUNT(*) as count FROM creator_appeals WHERE 1=1 ${dateFilter}`,
      params
    );

    const appealsByStatus = await db.all(
      `SELECT status, COUNT(*) as count 
       FROM creator_appeals 
       WHERE 1=1 ${dateFilter}
       GROUP BY status`,
      params
    );

    const complaintsByHandler = await db.all(
      `SELECT handler, COUNT(*) as count 
       FROM complaints 
       WHERE handler IS NOT NULL ${dateFilter}
       GROUP BY handler`,
      params
    );

    const takedownRate = totalComplaints.count > 0
      ? (complaintsByStatus.find(c => c.status === 'takedown')?.count || 0) / totalComplaints.count
      : 0;

    res.json({
      success: true,
      data: {
        totalComplaints: totalComplaints.count,
        complaintsByStatus,
        totalAppeals: totalAppeals.count,
        appealsByStatus,
        complaintsByHandler,
        takedownRate: Math.round(takedownRate * 100) + '%'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { handler, start_date, end_date, format = 'json' } = req.query;

    let sql = `
      SELECT 
        c.id,
        c.complaint_reason,
        c.complaint_details,
        c.current_status,
        c.handler,
        c.handled_at,
        c.created_at as complaint_created_at,
        ci.title as content_title,
        ci.creator_name,
        ci.creator_id,
        rh.name as holder_name,
        rh.contact_person as holder_contact,
        rh.phone as holder_phone,
        rh.email as holder_email
      FROM complaints c
      LEFT JOIN content_items ci ON c.content_id = ci.id
      LEFT JOIN rights_holders rh ON c.holder_id = rh.id
      WHERE 1=1
    `;
    const params = [];

    if (handler) {
      sql += ' AND c.handler = ?';
      params.push(handler);
    }
    if (start_date) {
      sql += ' AND c.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND c.created_at <= ?';
      params.push(end_date);
    }
    sql += ' ORDER BY c.created_at DESC';

    const reports = await db.all(sql, params);

    for (const report of reports) {
      const appeals = await db.all(
        `SELECT appeal_reason, appeal_details, status as appeal_status, reviewer, review_notes, reviewed_at
         FROM creator_appeals
         WHERE complaint_id = ?`,
        [report.id]
      );
      report.appeals = appeals;
    }

    if (format === 'csv') {
      const flatReports = reports.map(r => ({
        ...r,
        appeals_count: r.appeals.length,
        latest_appeal_status: r.appeals[0]?.appeal_status || null
      }));

      const fields = [
        'id', 'complaint_reason', 'complaint_details', 'current_status',
        'handler', 'handled_at', 'complaint_created_at',
        'content_title', 'creator_name', 'creator_id',
        'holder_name', 'holder_contact', 'holder_phone', 'holder_email',
        'appeals_count', 'latest_appeal_status'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(flatReports);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=complaints_report.csv');
      res.send('\uFEFF' + csv);
    } else {
      res.json({ success: true, data: reports });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
