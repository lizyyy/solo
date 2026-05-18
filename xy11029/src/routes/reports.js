const express = require('express');
const router = express.Router();
const { runQuery, getQuery, allQuery } = require('../database/db');

const REQUIRED_FIELDS = [
  'report_no', 'report_date', 'reporter_name', 'reporter_phone',
  'accident_time', 'accident_location', 'accident_type',
  'policy_no', 'insurance_company'
];

function validateReport(data, isUpdate = false) {
  const errors = [];
  
  if (!isUpdate) {
    for (const field of REQUIRED_FIELDS) {
      if (!data[field]) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }
  }
  
  if (data.report_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)) {
    errors.push('报案日期格式错误，应为 YYYY-MM-DD');
  }
  
  if (data.reporter_phone && !/^1[3-9]\d{9}$/.test(data.reporter_phone)) {
    errors.push('手机号格式错误');
  }
  
  const validStatuses = ['pending', 'reviewing', 'approved', 'rejected', 'paid'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`状态值无效，有效值为: ${validStatuses.join(', ')}`);
  }
  
  return errors;
}

router.get('/', async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      status,
      responsible_person,
      store_name,
      accident_type,
      insurance_company,
      claim_package_no,
      page = 1,
      page_size = 20
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
    
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await getQuery(countSql, params);
    const total = countResult.total;
    
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(page_size);
    const offset = (pageNum - 1) * pageSizeNum;
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSizeNum, offset);
    
    const reports = await allQuery(sql, params);
    
    res.json({
      success: true,
      data: {
        list: reports,
        pagination: {
          page: pageNum,
          page_size: pageSizeNum,
          total,
          total_pages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await getQuery('SELECT * FROM insurance_reports WHERE id = ?', [id]);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: '报案记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const errors = validateReport(req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    const existing = await getQuery(
      'SELECT id FROM insurance_reports WHERE report_no = ?',
      [req.body.report_no]
    );
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '报案编号已存在'
      });
    }
    
    const data = { ...req.body };
    data.created_at = new Date().toISOString();
    data.updated_at = new Date().toISOString();
    
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    const result = await runQuery(
      `INSERT INTO insurance_reports (${columns}) VALUES (${placeholders})`,
      values
    );
    
    const newReport = await getQuery(
      'SELECT * FROM insurance_reports WHERE id = ?',
      [result.lastID]
    );
    
    res.status(201).json({
      success: true,
      data: newReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getQuery(
      'SELECT * FROM insurance_reports WHERE id = ?',
      [id]
    );
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '报案记录不存在'
      });
    }
    
    const errors = validateReport(req.body, true);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    const data = { ...req.body };
    delete data.id;
    delete data.created_at;
    data.updated_at = new Date().toISOString();
    
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    await runQuery(
      `UPDATE insurance_reports SET ${setClause} WHERE id = ?`,
      values
    );
    
    const updatedReport = await getQuery(
      'SELECT * FROM insurance_reports WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: updatedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await getQuery(
      'SELECT id FROM insurance_reports WHERE id = ?',
      [id]
    );
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '报案记录不存在'
      });
    }
    
    await runQuery('DELETE FROM insurance_reports WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
