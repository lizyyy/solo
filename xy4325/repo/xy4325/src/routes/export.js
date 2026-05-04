const express = require('express');
const router = express.Router();
const db = require('../database');
const utils = require('../utils');
const { Parser } = require('json2csv');

router.get('/reminder-today', (req, res, next) => {
  try {
    const { format = 'json', project_group_id } = req.query;
    
    const today = new Date();
    const todayStr = utils.formatDate(today);
    
    let sql = `
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             d.model as device_model,
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
    
    if (project_group_id) {
      sql += ' AND br.project_group_id = ?';
      params.push(parseInt(project_group_id));
    }
    
    sql += ' ORDER BY br.due_date ASC';
    
    const records = db.prepare(sql).all(...params);
    
    const now = new Date();
    const reminderRecords = records.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date, now);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      const daysUntilDue = overdueDays <= 0 ? Math.abs(overdueDays) : -overdueDays;
      
      let reminderType = 'normal';
      if (overdueDays > 0) {
        reminderType = 'overdue';
      } else if (daysUntilDue <= 1) {
        reminderType = 'urgent';
      } else if (daysUntilDue <= 3) {
        reminderType = 'soon';
      }
      
      return {
        id: record.id,
        device_number: record.device_number,
        device_name: record.device_name,
        device_type: record.device_type,
        device_model: record.device_model,
        student_name: record.student_name,
        student_number: record.student_number,
        student_email: record.student_email,
        student_phone: record.student_phone,
        project_group_name: record.project_group_name || '未分组',
        borrow_date: utils.formatDate(record.borrow_date),
        due_date: utils.formatDate(record.due_date),
        overdue_days: overdueDays,
        is_overdue: overdueDays > 0,
        days_until_due: daysUntilDue,
        risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel),
        reminder_type: reminderType,
        export_date: todayStr
      };
    });
    
    const overdueRecords = reminderRecords.filter(r => r.is_overdue);
    const urgentRecords = reminderRecords.filter(r => r.reminder_type === 'urgent');
    const soonRecords = reminderRecords.filter(r => r.reminder_type === 'soon');
    
    const summary = {
      export_date: todayStr,
      total_active: reminderRecords.length,
      overdue_count: overdueRecords.length,
      urgent_count: urgentRecords.length,
      soon_due_count: soonRecords.length,
      by_risk_level: {
        normal: reminderRecords.filter(r => r.risk_level === 0).length,
        risk_level_1: reminderRecords.filter(r => r.risk_level === 1).length,
        risk_level_2: reminderRecords.filter(r => r.risk_level === 2).length,
        risk_level_3: reminderRecords.filter(r => r.risk_level === 3).length,
        risk_level_4: reminderRecords.filter(r => r.risk_level === 4).length
      }
    };
    
    if (format === 'csv') {
      const csvFields = [
        { label: '设备编号', value: 'device_number' },
        { label: '设备名称', value: 'device_name' },
        { label: '设备类型', value: 'device_type' },
        { label: '设备型号', value: 'device_model' },
        { label: '学生姓名', value: 'student_name' },
        { label: '学号', value: 'student_number' },
        { label: '联系邮箱', value: 'student_email' },
        { label: '联系电话', value: 'student_phone' },
        { label: '项目组', value: 'project_group_name' },
        { label: '借用日期', value: 'borrow_date' },
        { label: '应还日期', value: 'due_date' },
        { label: '超期天数', value: 'overdue_days' },
        { label: '是否超期', value: (row) => row.is_overdue ? '是' : '否' },
        { label: '距到期天数', value: 'days_until_due' },
        { label: '风险等级', value: 'risk_level' },
        { label: '风险描述', value: 'risk_level_description' },
        { label: '提醒类型', value: (row) => {
          const types = {
            'normal': '正常',
            'soon': '即将到期',
            'urgent': '紧急提醒',
            'overdue': '已超期'
          };
          return types[row.reminder_type] || row.reminder_type;
        }},
        { label: '导出日期', value: 'export_date' }
      ];
      
      const json2csvParser = new Parser({ fields: csvFields });
      const csv = json2csvParser.parse(reminderRecords);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=催还清单_${todayStr}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        message: `今日催还清单生成完成，共 ${reminderRecords.length} 条记录`,
        data: {
          summary,
          records: reminderRecords,
          overdue_records: overdueRecords,
          urgent_records: urgentRecords
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/overdue-csv', (req, res, next) => {
  try {
    const { project_group_id, min_risk_level = 0 } = req.query;
    const todayStr = utils.formatDate(new Date());
    
    let sql = `
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             d.model as device_model,
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
    `;
    const params = [parseInt(min_risk_level)];
    
    if (project_group_id) {
      sql += ' AND br.project_group_id = ?';
      params.push(parseInt(project_group_id));
    }
    
    sql += ' ORDER BY br.risk_level DESC, br.due_date ASC';
    
    const records = db.prepare(sql).all(...params);
    
    const now = new Date();
    const enrichedRecords = records.map(record => {
      const overdueDays = utils.calculateOverdueDays(record.due_date, now);
      const riskLevel = utils.calculateRiskLevel(overdueDays);
      
      return {
        id: record.id,
        device_number: record.device_number,
        device_name: record.device_name,
        device_type: record.device_type,
        device_model: record.device_model,
        student_name: record.student_name,
        student_number: record.student_number,
        student_email: record.student_email,
        student_phone: record.student_phone,
        project_group_name: record.project_group_name || '未分组',
        borrow_date: utils.formatDate(record.borrow_date),
        due_date: utils.formatDate(record.due_date),
        overdue_days: overdueDays,
        risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel),
        export_date: todayStr
      };
    });
    
    const csvFields = [
      { label: '风险等级', value: 'risk_level' },
      { label: '风险描述', value: 'risk_level_description' },
      { label: '超期天数', value: 'overdue_days' },
      { label: '设备编号', value: 'device_number' },
      { label: '设备名称', value: 'device_name' },
      { label: '设备类型', value: 'device_type' },
      { label: '学生姓名', value: 'student_name' },
      { label: '学号', value: 'student_number' },
      { label: '联系电话', value: 'student_phone' },
      { label: '联系邮箱', value: 'student_email' },
      { label: '项目组', value: 'project_group_name' },
      { label: '借用日期', value: 'borrow_date' },
      { label: '应还日期', value: 'due_date' },
      { label: '导出日期', value: 'export_date' }
    ];
    
    const json2csvParser = new Parser({ fields: csvFields });
    const csv = json2csvParser.parse(enrichedRecords);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=超期设备清单_${todayStr}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

router.get('/project-group/:groupId', (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { format = 'json' } = req.query;
    const todayStr = utils.formatDate(new Date());
    
    const group = db.prepare('SELECT * FROM project_groups WHERE id = ?').get(parseInt(groupId));
    if (!group) {
      const err = new Error('项目组不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const records = db.prepare(`
      SELECT br.*,
             d.device_id as device_number,
             d.name as device_name,
             d.type as device_type,
             s.name as student_name,
             s.student_id as student_number,
             s.email as student_email,
             s.phone as student_phone
      FROM borrow_records br
      LEFT JOIN devices d ON br.device_id = d.id
      LEFT JOIN students s ON br.student_id = s.id
      WHERE br.project_group_id = ?
      ORDER BY br.status DESC, br.due_date ASC
    `).all(parseInt(groupId));
    
    const now = new Date();
    const enrichedRecords = records.map(record => {
      const overdueDays = record.status === 'active' ? utils.calculateOverdueDays(record.due_date, now) : 0;
      const riskLevel = record.status === 'active' ? utils.calculateRiskLevel(overdueDays) : record.risk_level;
      
      return {
        id: record.id,
        device_number: record.device_number,
        device_name: record.device_name,
        device_type: record.device_type,
        student_name: record.student_name,
        student_number: record.student_number,
        student_email: record.student_email,
        student_phone: record.student_phone,
        status: record.status === 'active' ? '借用中' : '已归还',
        borrow_date: utils.formatDate(record.borrow_date),
        due_date: utils.formatDate(record.due_date),
        return_date: record.return_date ? utils.formatDate(record.return_date) : '',
        overdue_days: overdueDays,
        risk_level: riskLevel,
        risk_level_description: utils.getRiskLevelDescription(riskLevel),
        export_date: todayStr
      };
    });
    
    if (format === 'csv') {
      const csvFields = [
        { label: '设备编号', value: 'device_number' },
        { label: '设备名称', value: 'device_name' },
        { label: '设备类型', value: 'device_type' },
        { label: '学生姓名', value: 'student_name' },
        { label: '学号', value: 'student_number' },
        { label: '状态', value: 'status' },
        { label: '借用日期', value: 'borrow_date' },
        { label: '应还日期', value: 'due_date' },
        { label: '归还日期', value: 'return_date' },
        { label: '超期天数', value: 'overdue_days' },
        { label: '风险等级', value: 'risk_level' },
        { label: '风险描述', value: 'risk_level_description' },
        { label: '导出日期', value: 'export_date' }
      ];
      
      const json2csvParser = new Parser({ fields: csvFields });
      const csv = json2csvParser.parse(enrichedRecords);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${group.name}_借用记录_${todayStr}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      res.json({
        success: true,
        data: {
          project_group: group.name,
          total_records: enrichedRecords.length,
          active_count: enrichedRecords.filter(r => r.status === '借用中').length,
          returned_count: enrichedRecords.filter(r => r.status === '已归还').length,
          overdue_count: enrichedRecords.filter(r => r.overdue_days > 0).length,
          records: enrichedRecords
        }
      });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
