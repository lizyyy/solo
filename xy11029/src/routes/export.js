const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const { allQuery } = require('../database/db');

const EXPORT_FIELDS = [
  'report_no', 'report_date', 'reporter_name', 'reporter_phone', 'reporter_id_card',
  'accident_time', 'accident_location', 'accident_type', 'accident_description',
  'cycling_route', 'cycling_distance', 'cycling_duration',
  'policy_no', 'insurance_company', 'insurance_amount',
  'injured_count', 'death_count',
  'vehicle_type', 'frame_no', 'vehicle_brand',
  'photo_source', 'photo_count', 'photo_urls',
  'claim_amount', 'claim_package_no',
  'status', 'responsible_person',
  'store_name', 'store_address', 'store_phone',
  'remarks', 'created_at', 'updated_at'
];

router.get('/csv', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      status,
      responsible_person,
      store_name,
      accident_type,
      insurance_company,
      claim_package_no
    } = req.query;
    
    let sql = 'SELECT * FROM insurance_reports WHERE 1=1';
    const params = [];
    
    if (start_date) {
      sql += ' AND report_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND report_date <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (responsible_person) {
      sql += ' AND responsible_person LIKE ?';
      params.push(`%${responsible_person}%`);
    }
    
    if (store_name) {
      sql += ' AND store_name LIKE ?';
      params.push(`%${store_name}%`);
    }
    
    if (accident_type) {
      sql += ' AND accident_type LIKE ?';
      params.push(`%${accident_type}%`);
    }
    
    if (insurance_company) {
      sql += ' AND insurance_company LIKE ?';
      params.push(`%${insurance_company}%`);
    }
    
    if (claim_package_no) {
      sql += ' AND claim_package_no = ?';
      params.push(claim_package_no);
    }
    
    sql += ' ORDER BY report_date DESC';
    
    const reports = await allQuery(sql, params);
    
    const json2csvParser = new Parser({ fields: EXPORT_FIELDS });
    const csv = json2csvParser.parse(reports);
    
    const filename = `insurance_reports_${new Date().toISOString().slice(0, 10)}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    res.write('\uFEFF');
    res.write(csv);
    res.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/json', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      status,
      responsible_person,
      store_name,
      accident_type,
      insurance_company,
      claim_package_no
    } = req.query;
    
    let sql = 'SELECT * FROM insurance_reports WHERE 1=1';
    const params = [];
    
    if (start_date) {
      sql += ' AND report_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND report_date <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (responsible_person) {
      sql += ' AND responsible_person LIKE ?';
      params.push(`%${responsible_person}%`);
    }
    
    if (store_name) {
      sql += ' AND store_name LIKE ?';
      params.push(`%${store_name}%`);
    }
    
    if (accident_type) {
      sql += ' AND accident_type LIKE ?';
      params.push(`%${accident_type}%`);
    }
    
    if (insurance_company) {
      sql += ' AND insurance_company LIKE ?';
      params.push(`%${insurance_company}%`);
    }
    
    if (claim_package_no) {
      sql += ' AND claim_package_no = ?';
      params.push(claim_package_no);
    }
    
    sql += ' ORDER BY report_date DESC';
    
    const reports = await allQuery(sql, params);
    
    const filename = `insurance_reports_${new Date().toISOString().slice(0, 10)}.json`;
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    res.json({
      success: true,
      export_time: new Date().toISOString(),
      total: reports.length,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
