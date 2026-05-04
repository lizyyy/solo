const express = require('express');
const router = express.Router();
const db = require('../database');
const utils = require('../utils');

router.get('/check', (req, res, next) => {
  try {
    const activeRecords = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             s.email as student_email,
             s.phone as student_phone,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.status = 'active'
      ORDER BY br.due_date ASC
    `).all();
    
    const now = new Date();
    let updatedCount = 0;
    const results = activeRecords.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date, now);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
      if (riskLevel !== record.risk_level) {
        db.prepare('UPDATE borrow_records SET risk_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(riskLevel, record.id);
        updatedCount++;
      }
      
      return {
        ...record,
        overdue_days: overdueDays,
        is_overdue: overdueDays > 0,
        current_risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel),
        days_until_due: overdueDays <= 0 ? Math.abs(overdueDays) : 0
      };
    });
    
    const overdueRecords = results.filter(r => r.is_overdue);
    const byRiskLevel = {
      0: results.filter(r => r.current_risk_level === 0).length,
      1: results.filter(r => r.current_risk_level === 1).length,
      2: results.filter(r => r.current_risk_level === 2).length,
      3: results.filter(r => r.current_risk_level === 3).length,
      4: results.filter(r => r.current_risk_level === 4).length
    };
    
    res.json({
      success: true,
      message: `超期检测完成，共检查 ${results.length} 条活跃记录，更新 ${updatedCount} 条风险等级`,
      data: {
        total_active: results.length,
        total_overdue: overdueRecords.length,
        by_risk_level: byRiskLevel,
        updated_count: updatedCount,
        overdue_records: overdueRecords,
        all_records: results
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/list', (req, res, next) => {
  try {
    const { risk_level, project_group_id, min_overdue_days } = req.query;
    
    let sql = `
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             s.email as student_email,
             s.phone as student_phone,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.status = 'active'
    `;
    const params = [];
    
    if (risk_level !== undefined) {
      sql += ' AND br.risk_level = ?';
      params.push(parseInt(risk_level));
    }
    
    if (project_group_id) {
      sql += ' AND br.project_group_id = ?';
      params.push(parseInt(project_group_id));
    }
    
    sql += ' ORDER BY br.due_date ASC';
    
    const records = db.prepare(sql).all(...params);
    
    const now = new Date();
    const results = records.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date, now);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
      return {
        ...record,
        overdue_days: overdueDays,
        is_overdue: overdueDays > 0,
        current_risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel)
      };
    });
    
    let filteredResults = results;
    if (min_overdue_days !== undefined) {
      const minDays = parseInt(min_overdue_days);
      filteredResults = results.filter(r => r.overdue_days >= minDays);
    }
    
    const overdueOnly = filteredResults.filter(r => r.is_overdue);
    
    res.json({
      success: true,
      data: {
        total_checked: results.length,
        total_overdue: overdueOnly.length,
        records: overdueOnly
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', (req, res, next) => {
  try {
    const activeRecords = db.prepare(`
      SELECT br.*,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.status = 'active'
    `).all();
    
    const now = new Date();
    let totalOverdue = 0;
    const byRiskLevel = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const byProjectGroup = {};
    const overdueByProjectGroup = {};
    
    for (const record of activeRecords) {
      const overdueDays = utils.calculateOverdueDays(record.due_date, now);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
      byRiskLevel[riskLevel]++;
      
      if (overdueDays > 0) {
        totalOverdue++;
      }
      
      const groupName = record.project_group_name || '未分组';
      if (!byProjectGroup[groupName]) {
        byProjectGroup[groupName] = 0;
        overdueByProjectGroup[groupName] = 0;
      }
      byProjectGroup[groupName]++;
      if (overdueDays > 0) {
        overdueByProjectGroup[groupName]++;
      }
    }
    
    res.json({
      success: true,
      data: {
        total_active: activeRecords.length,
        total_overdue: totalOverdue,
        overdue_rate: activeRecords.length > 0 ? (totalOverdue / activeRecords.length * 100).toFixed(2) : 0,
        by_risk_level: {
          normal: byRiskLevel[0],
          risk_level_1: byRiskLevel[1],
          risk_level_2: byRiskLevel[2],
          risk_level_3: byRiskLevel[3],
          risk_level_4: byRiskLevel[4]
        },
        by_project_group: byProjectGroup,
        overdue_by_project_group: overdueByProjectGroup,
        risk_level_descriptions: {
          0: utils.getRiskLevelDescription(0),
          1: utils.getRiskLevelDescription(1),
          2: utils.getRiskLevelDescription(2),
          3: utils.getRiskLevelDescription(3),
          4: utils.getRiskLevelDescription(4)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/high-risk', (req, res, next) => {
  try {
    const { min_risk_level = 3 } = req.query;
    
    const highRiskRecords = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             s.email as student_email,
             s.phone as student_phone,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.status = 'active' AND br.risk_level >= ?
      ORDER BY br.risk_level DESC, br.due_date ASC
    `).all(parseInt(min_risk_level));
    
    const now = new Date();
    const results = highRiskRecords.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date, now);
      
      return {
        ...record,
        overdue_days: overdueDays,
        risk_level_description: utils.getRiskLevelDescription(record.risk_level)
      };
    });
    
    res.json({
      success: true,
      data: {
        min_risk_level: parseInt(min_risk_level),
        count: results.length,
        records: results
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
