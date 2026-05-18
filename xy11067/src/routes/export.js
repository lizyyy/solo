const express = require('express');
const router = express.Router();
const db = require('../database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const exportDir = path.join(__dirname, '..', '..', 'exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

router.get('/health-check/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    db.all(`
      SELECT 
        hcr.check_id as 晨检编号,
        c.child_id as 儿童编号,
        c.name as 儿童姓名,
        c.class_name as 班级,
        c.gender as 性别,
        hcr.check_date as 晨检日期,
        hcr.check_time as 晨检时间,
        hcr.checker_name as 晨检人员,
        hcr.body_temperature as 体温,
        CASE WHEN hcr.has_fever = 1 THEN '是' ELSE '否' END as 是否发热,
        CASE WHEN hcr.cough = 1 THEN '是' ELSE '否' END as 咳嗽,
        CASE WHEN hcr.runny_nose = 1 THEN '是' ELSE '否' END as 流涕,
        CASE WHEN hcr.sore_throat = 1 THEN '是' ELSE '否' END as 咽痛,
        CASE WHEN hcr.diarrhea = 1 THEN '是' ELSE '否' END as 腹泻,
        CASE WHEN hcr.vomiting = 1 THEN '是' ELSE '否' END as 呕吐,
        CASE WHEN hcr.rash = 1 THEN '是' ELSE '否' END as 皮疹,
        CASE WHEN hcr.conjunctivitis = 1 THEN '是' ELSE '否' END as 结膜炎,
        CASE WHEN hcr.hand_foot_mouth = 1 THEN '是' ELSE '否' END as 手足口,
        hcr.other_symptoms as 其他症状,
        hcr.spirit_status as 精神状态,
        hcr.appetite_status as 食欲状态,
        hcr.sleep_status as 睡眠状态,
        hcr.medication_name as 服药名称,
        hcr.medication_dosage as 服药剂量,
        hcr.medication_time as 服药时间,
        CASE WHEN hcr.is_allowed_entry = 1 THEN '是' ELSE '否' END as 允许入园,
        hcr.check_result as 晨检结果,
        hcr.remarks as 备注,
        CASE WHEN hcr.guardian_notified = 1 THEN '是' ELSE '否' END as 已通知家长,
        hcr.notification_time as 通知时间
      FROM health_check_records hcr
      JOIN children c ON hcr.child_id = c.child_id
      WHERE hcr.check_date = ?
      ORDER BY c.class_name, hcr.check_time
    `, [date], async (err, records) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      if (records.length === 0) {
        return res.status(404).json({ success: false, message: '该日期无晨检记录' });
      }

      const fileName = `晨检记录_${date}_${Date.now()}.csv`;
      const filePath = path.join(exportDir, fileName);

      const csvWriter = createCsvWriter({
        path: filePath,
        header: Object.keys(records[0]).map(key => ({ id: key, title: key })),
        encoding: 'utf8'
      });

      await csvWriter.writeRecords(records);

      res.json({
        success: true,
        message: '导出成功',
        data: {
          file_name: fileName,
          record_count: records.length,
          key_columns: ['儿童编号', '儿童姓名', '班级', '体温', '晨检结果']
        }
      });
    });
  } catch (error) {
    console.error('导出晨检记录失败:', error);
    res.status(500).json({ success: false, message: '导出失败', error: error.message });
  }
});

router.get('/isolation/:startDate?', async (req, res) => {
  try {
    const { startDate } = req.params;
    let query = `
      SELECT 
        ir.isolation_id as 隔离编号,
        c.child_id as 儿童编号,
        c.name as 儿童姓名,
        c.class_name as 班级,
        c.guardian_name as 监护人姓名,
        c.guardian_phone as 联系电话,
        ir.check_id as 关联晨检编号,
        ir.start_date as 隔离开始日期,
        ir.start_time as 隔离开始时间,
        ir.end_date as 隔离结束日期,
        ir.isolation_reason as 隔离原因,
        ir.isolation_type as 隔离类型,
        ir.isolation_location as 隔离地点,
        ir.symptoms as 症状,
        ir.diagnosis as 诊断,
        ir.hospital_name as 就诊医院,
        ir.body_temperature as 体温,
        CASE WHEN ir.has_close_contact = 1 THEN '是' ELSE '否' END as 有密切接触,
        ir.close_contact_details as 密切接触详情,
        CASE WHEN ir.guardian_notified = 1 THEN '是' ELSE '否' END as 已通知家长,
        ir.notification_method as 通知方式,
        ir.notification_time as 通知时间,
        CASE WHEN ir.is_ended = 1 THEN '已结束' ELSE '隔离中' END as 隔离状态,
        ir.end_reason as 结束原因,
        ir.checker_name as 记录人员,
        ir.remarks as 备注
      FROM isolation_records ir
      JOIN children c ON ir.child_id = c.child_id
    `;
    const params = [];
    
    if (startDate) {
      query += ' WHERE ir.start_date >= ?';
      params.push(startDate);
    }
    
    query += ' ORDER BY ir.start_date DESC, ir.start_time DESC';

    db.all(query, params, async (err, records) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      if (records.length === 0) {
        return res.status(404).json({ success: false, message: '无隔离记录' });
      }

      const fileName = `隔离记录_${startDate || '全部'}_${Date.now()}.csv`;
      const filePath = path.join(exportDir, fileName);

      const csvWriter = createCsvWriter({
        path: filePath,
        header: Object.keys(records[0]).map(key => ({ id: key, title: key })),
        encoding: 'utf8'
      });

      await csvWriter.writeRecords(records);

      res.json({
        success: true,
        message: '导出成功',
        data: {
          file_name: fileName,
          record_count: records.length,
          key_columns: ['儿童编号', '儿童姓名', '班级', '隔离原因', '隔离状态', '联系电话']
        }
      });
    });
  } catch (error) {
    console.error('导出隔离记录失败:', error);
    res.status(500).json({ success: false, message: '导出失败', error: error.message });
  }
});

router.get('/daily-report/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    db.get(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN has_fever = 1 THEN 1 ELSE 0 END) as fever_count,
        SUM(CASE WHEN check_result = '正常' THEN 1 ELSE 0 END) as normal_count,
        SUM(CASE WHEN check_result = '观察' THEN 1 ELSE 0 END) as observe_count,
        SUM(CASE WHEN check_result = '隔离' THEN 1 ELSE 0 END) as isolation_count,
        SUM(CASE WHEN check_result = '接回' THEN 1 ELSE 0 END) as take_home_count,
        SUM(CASE WHEN check_result = '送医' THEN 1 ELSE 0 END) as hospital_count
      FROM health_check_records
      WHERE check_date = ?
    `, [date], (err, stats) => {
      if (err) {
        return res.status(500).json({ success: false, message: '查询失败', error: err.message });
      }

      db.all(`
        SELECT 
          c.class_name,
          COUNT(*) as class_total,
          SUM(CASE WHEN hcr.has_fever = 1 THEN 1 ELSE 0 END) as class_fever
        FROM health_check_records hcr
        JOIN children c ON hcr.child_id = c.child_id
        WHERE hcr.check_date = ?
        GROUP BY c.class_name
        ORDER BY c.class_name
      `, [date], (err2, classStats) => {
          if (err2) {
            return res.status(500).json({ success: false, message: '查询失败', error: err2.message });
          }

          res.json({
            success: true,
            data: {
              date,
              overall_stats: stats,
              class_stats: classStats,
              abnormal_count: stats.fever_count + stats.isolation_count + stats.take_home_count + stats.hospital_count
            }
          });
        });
    });
  } catch (error) {
    console.error('获取日报失败:', error);
    res.status(500).json({ success: false, message: '获取日报失败', error: error.message });
  }
});

module.exports = router;
