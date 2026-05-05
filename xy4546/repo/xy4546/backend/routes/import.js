const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const moment = require('moment');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

async function ensureEscalatorExists(escalatorCode, stationName = '未知站点') {
  const existing = await db.get(
    'SELECT * FROM escalators WHERE escalator_code = ?',
    [escalatorCode]
  );
  
  if (!existing) {
    await db.run(
      'INSERT INTO escalators (station_name, escalator_code) VALUES (?, ?)',
      [stationName, escalatorCode]
    );
  }
}

router.post('/inspection', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const data = await parseCsvFile(req.file.path);
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'CSV文件为空' });
    }

    let importedCount = 0;
    
    for (const row of data) {
      const escalatorCode = row.escalator_code || row.扶梯编号 || row.code;
      const stationName = row.station_name || row.站点名称 || '未知站点';
      
      if (!escalatorCode) continue;
      
      await ensureEscalatorExists(escalatorCode, stationName);
      
      const inspectionDate = row.inspection_date || row.巡检日期 || row.date;
      const inspector = row.inspector || row.巡检员;
      const overallStatus = row.overall_status || row.整体状态;
      const issues = row.issues || row.问题;
      const safetyChainCheck = row.safety_chain_check || row.安全链检查;
      const emergencyStopCheck = row.emergency_stop_check || row.急停检查;
      const handrailCheck = row.handrail_check || row.扶手带检查;
      const stepCheck = row.step_check || row.梯级检查;
      const combPlateCheck = row.comb_plate_check || row.梳齿板检查;
      const lubricationCheck = row.lubrication_check || row.润滑检查;
      const noiseLevel = row.noise_level || row.噪音等级;
      const vibrationLevel = row.vibration_level || row.震动等级;
      const nextInspectionDate = row.next_inspection_date || row.下次巡检日期;
      const remarks = row.remarks || row.备注;

      await db.run(`
        INSERT INTO inspections (
          escalator_code, inspection_date, inspector, overall_status, issues,
          safety_chain_check, emergency_stop_check, handrail_check, step_check,
          comb_plate_check, lubrication_check, noise_level, vibration_level,
          next_inspection_date, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        escalatorCode, inspectionDate, inspector, overallStatus, issues,
        safetyChainCheck, emergencyStopCheck, handrailCheck, stepCheck,
        combPlateCheck, lubricationCheck, noiseLevel, vibrationLevel,
        nextInspectionDate, remarks
      ]);
      
      importedCount++;
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${importedCount} 条巡检记录`,
      count: importedCount
    });
  } catch (error) {
    console.error('导入巡检记录失败:', error);
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
});

router.post('/current-log', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const data = await parseCsvFile(req.file.path);
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'CSV文件为空' });
    }

    let importedCount = 0;
    
    for (const row of data) {
      const escalatorCode = row.escalator_code || row.扶梯编号 || row.code;
      const stationName = row.station_name || row.站点名称 || '未知站点';
      
      if (!escalatorCode) continue;
      
      await ensureEscalatorExists(escalatorCode, stationName);
      
      const logTime = row.log_time || row.记录时间 || row.time;
      const phaseACurrent = parseFloat(row.phase_a_current || row.A相电流 || 0);
      const phaseBCurrent = parseFloat(row.phase_b_current || row.B相电流 || 0);
      const phaseCCurrent = parseFloat(row.phase_c_current || row.C相电流 || 0);
      const averageCurrent = (phaseACurrent + phaseBCurrent + phaseCCurrent) / 3;
      
      const overloadThreshold = 15;
      const isOverload = averageCurrent > overloadThreshold ? 1 : 0;
      const status = isOverload ? 'overload' : 'normal';

      await db.run(`
        INSERT INTO current_logs (
          escalator_code, log_time, phase_a_current, phase_b_current,
          phase_c_current, average_current, status, is_overload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        escalatorCode, logTime, phaseACurrent, phaseBCurrent,
        phaseCCurrent, averageCurrent, status, isOverload
      ]);
      
      importedCount++;
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${importedCount} 条电流日志`,
      count: importedCount
    });
  } catch (error) {
    console.error('导入电流日志失败:', error);
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
});

router.post('/repair', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const data = await parseCsvFile(req.file.path);
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'CSV文件为空' });
    }

    let importedCount = 0;
    
    for (const row of data) {
      const escalatorCode = row.escalator_code || row.扶梯编号 || row.code;
      const stationName = row.station_name || row.站点名称 || '未知站点';
      
      if (!escalatorCode) continue;
      
      await ensureEscalatorExists(escalatorCode, stationName);
      
      const reportTime = row.report_time || row.报修时间 || row.time;
      const reporterName = row.reporter_name || row.报修人;
      const reporterPhone = row.reporter_phone || row.联系电话;
      const faultDescription = row.fault_description || row.故障描述 || row.description;
      const faultType = row.fault_type || row.故障类型;
      const severity = row.severity || row.严重程度;
      const handleStatus = row.handle_status || row.处理状态 || 'pending';
      const handleTime = row.handle_time || row.处理时间;
      const handler = row.handler || row.处理人;
      const handleResult = row.handle_result || row.处理结果;
      const isFalseAlarm = (row.is_false_alarm || row.是否误报 || '0') === '1' ? 1 : 0;
      const remarks = row.remarks || row.备注;

      await db.run(`
        INSERT INTO repair_records (
          escalator_code, report_time, reporter_name, reporter_phone,
          fault_description, fault_type, severity, handle_status,
          handle_time, handler, handle_result, is_false_alarm, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        escalatorCode, reportTime, reporterName, reporterPhone,
        faultDescription, faultType, severity, handleStatus,
        handleTime, handler, handleResult, isFalseAlarm, remarks
      ]);
      
      importedCount++;
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${importedCount} 条报修记录`,
      count: importedCount
    });
  } catch (error) {
    console.error('导入报修记录失败:', error);
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
});

router.post('/maintenance', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const data = await parseCsvFile(req.file.path);
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'CSV文件为空' });
    }

    let importedCount = 0;
    
    for (const row of data) {
      const escalatorCode = row.escalator_code || row.扶梯编号 || row.code;
      const stationName = row.station_name || row.站点名称 || '未知站点';
      
      if (!escalatorCode) continue;
      
      await ensureEscalatorExists(escalatorCode, stationName);
      
      const callTime = row.call_time || row.召修时间 || row.time;
      const arrivalTime = row.arrival_time || row.到达时间;
      const departureTime = row.departure_time || row.离开时间;
      const maintenanceType = row.maintenance_type || row.维保类型;
      const faultDescription = row.fault_description || row.故障描述 || row.description;
      const maintenanceContent = row.maintenance_content || row.维保内容;
      const partsReplaced = row.parts_replaced || row.更换配件;
      const technicianName = row.technician_name || row.技术人员;
      const technicianPhone = row.technician_phone || row.联系电话;
      const maintenanceResult = row.maintenance_result || row.维保结果;
      const isResolved = (row.is_resolved || row.是否解决 || '0') === '1' ? 1 : 0;
      const nextMaintenanceDate = row.next_maintenance_date || row.下次维保日期;
      const remarks = row.remarks || row.备注;

      await db.run(`
        INSERT INTO maintenance_records (
          escalator_code, call_time, arrival_time, departure_time,
          maintenance_type, fault_description, maintenance_content,
          parts_replaced, technician_name, technician_phone,
          maintenance_result, is_resolved, next_maintenance_date, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        escalatorCode, callTime, arrivalTime, departureTime,
        maintenanceType, faultDescription, maintenanceContent,
        partsReplaced, technicianName, technicianPhone,
        maintenanceResult, isResolved, nextMaintenanceDate, remarks
      ]);
      
      importedCount++;
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `成功导入 ${importedCount} 条维保记录`,
      count: importedCount
    });
  } catch (error) {
    console.error('导入维保记录失败:', error);
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
});

module.exports = router;
