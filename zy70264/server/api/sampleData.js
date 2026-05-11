const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const CompensationEngine = require('../services/compensationEngine');

function generateTempRecords(normal = true, count = 20) {
  const records = [];
  const baseTime = dayjs();
  
  for (let i = 0; i < count; i++) {
    let temp;
    if (normal) {
      temp = 65 + Math.random() * 10;
    } else {
      temp = i > 8 ? 40 + Math.random() * 10 : 65 + Math.random() * 10;
    }
    records.push({
      time: baseTime.add(i * 3, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      temperature: temp
    });
  }
  return records;
}

router.post('/normal', async (req, res) => {
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');

  try {
    const batchId = uuidv4();
    const batchNo = `BATCH-${now.format('YYYYMMDD')}-N001`;

    db.prepare(`
      INSERT INTO delivery_batches (
        id, batch_no, delivery_date, meal_type, total_meals,
        distributor, vehicle_no, departure_time, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)
    `).run(
      batchId, batchNo, today, 'lunch', 10,
      '张配送员', '京A12345', now.subtract(30, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      now.format('YYYY-MM-DD HH:mm:ss'), now.format('YYYY-MM-DD HH:mm:ss')
    );

    const normalRecords = generateTempRecords(true, 20);
    const segmentId = uuidv4();
    db.prepare(`
      INSERT INTO temperature_segments (
        id, batch_id, segment_name, start_time, end_time,
        avg_temp, min_temp, max_temp, temp_records,
        is_normal, abnormal_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
    `).run(
      segmentId, batchId, '配送途中-正常',
      normalRecords[0].time, normalRecords[normalRecords.length - 1].time,
      70, 65, 75, JSON.stringify(normalRecords),
      now.format('YYYY-MM-DD HH:mm:ss')
    );

    const elders = [
      { id: 'E001', name: '王奶奶', address: '幸福小区1号楼101', phone: '13800138001' },
      { id: 'E002', name: '李爷爷', address: '幸福小区1号楼202', phone: '13800138002' },
      { id: 'E003', name: '张奶奶', address: '幸福小区2号楼301', phone: '13800138003' },
      { id: 'E004', name: '刘爷爷', address: '幸福小区2号楼402', phone: '13800138004' },
      { id: 'E005', name: '陈奶奶', address: '幸福小区3号楼101', phone: '13800138005' }
    ];

    elders.forEach((elder, idx) => {
      const receiptId = uuidv4();
      
      db.prepare(`
        INSERT INTO sign_receipts (
          id, batch_id, elderly_id, elderly_name, address, phone,
          sign_time, sign_type, meals_received, signer_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', 2, ?, ?)
      `).run(
        receiptId, batchId, elder.id, elder.name, elder.address, elder.phone,
        now.subtract(20 - idx * 2, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        elder.name, now.format('YYYY-MM-DD HH:mm:ss')
      );
    });

    db.prepare(`
      UPDATE delivery_batches 
      SET status = 'completed', delivered_meals = 10, updated_at = ? 
      WHERE id = ?
    `).run(now.format('YYYY-MM-DD HH:mm:ss'), batchId);

    CompensationEngine.autoGenerateCompensations(batchId);
    CompensationEngine.checkAndCreateSafetyIncidents(batchId);

    res.json({
      success: true,
      message: '顺利样例数据创建成功',
      data: {
        batch_id: batchId,
        batch_no: batchNo,
        segments: 1,
        receipts: 5,
        returns: 0,
        type: 'normal'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/abnormal', async (req, res) => {
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');

  try {
    const batchId = uuidv4();
    const batchNo = `BATCH-${now.format('YYYYMMDD')}-A001`;

    db.prepare(`
      INSERT INTO delivery_batches (
        id, batch_no, delivery_date, meal_type, total_meals,
        distributor, vehicle_no, departure_time, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)
    `).run(
      batchId, batchNo, today, 'dinner', 8,
      '李配送员', '京B67890', now.subtract(45, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      now.format('YYYY-MM-DD HH:mm:ss'), now.format('YYYY-MM-DD HH:mm:ss')
    );

    const normalRecords = generateTempRecords(true, 15);
    const abnormalRecords = generateTempRecords(false, 25);
    
    const segment1Id = uuidv4();
    db.prepare(`
      INSERT INTO temperature_segments (
        id, batch_id, segment_name, start_time, end_time,
        avg_temp, min_temp, max_temp, temp_records,
        is_normal, abnormal_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
    `).run(
      segment1Id, batchId, '出库保温',
      normalRecords[0].time, normalRecords[normalRecords.length - 1].time,
      70, 65, 75, JSON.stringify(normalRecords),
      now.format('YYYY-MM-DD HH:mm:ss')
    );

    const abTemps = abnormalRecords.map(r => r.temperature);
    const abAvg = abTemps.reduce((a, b) => a + b, 0) / abTemps.length;
    const abMin = Math.min(...abTemps);
    const abMax = Math.max(...abTemps);
    
    const segment2Id = uuidv4();
    db.prepare(`
      INSERT INTO temperature_segments (
        id, batch_id, segment_name, start_time, end_time,
        avg_temp, min_temp, max_temp, temp_records,
        is_normal, abnormal_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      segment2Id, batchId, '配送途中-异常',
      abnormalRecords[0].time, abnormalRecords[abnormalRecords.length - 1].time,
      abAvg, abMin, abMax, JSON.stringify(abnormalRecords),
      '温度异常: 异常比例60.0%, 连续异常15个点',
      now.format('YYYY-MM-DD HH:mm:ss')
    );

    const elders = [
      { id: 'E101', name: '赵奶奶', address: '阳光小区1号楼101', phone: '13900139001' },
      { id: 'E102', name: '钱爷爷', address: '阳光小区1号楼202', phone: '13900139002' },
      { id: 'E103', name: '孙奶奶', address: '阳光小区2号楼301', phone: '13900139003' },
      { id: 'E104', name: '周爷爷', address: '阳光小区2号楼402', phone: '13900139004' }
    ];

    elders.forEach((elder, idx) => {
      const receiptId = uuidv4();
      
      const signType = idx === 1 ? 'partial' : 'normal';
      db.prepare(`
        INSERT INTO sign_receipts (
          id, batch_id, elderly_id, elderly_name, address, phone,
          sign_time, sign_type, meals_received, signer_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?)
      `).run(
        receiptId, batchId, elder.id, elder.name, elder.address, elder.phone,
        now.subtract(30 - idx * 3, 'minute').format('YYYY-MM-DD HH:mm:ss'),
        signType,
        elder.name, now.format('YYYY-MM-DD HH:mm:ss')
      );

      if (idx === 1) {
        const returnId = uuidv4();
        db.prepare(`
          INSERT INTO return_reasons (
            id, receipt_id, return_type, reason_code, reason_detail,
            meals_returned, return_time, operator, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(
          returnId, receiptId, 'temperature', 'T001',
          '餐食温度过低，手感冰凉，老人无法食用',
          1, now.subtract(25, 'minute').format('YYYY-MM-DD HH:mm:ss'),
          '李配送员', now.format('YYYY-MM-DD HH:mm:ss')
        );
      }

      if (idx === 3) {
        const returnId = uuidv4();
        db.prepare(`
          INSERT INTO return_reasons (
            id, receipt_id, return_type, reason_code, reason_detail,
            meals_returned, return_time, operator, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(
          returnId, receiptId, 'food_safety', 'F002',
          '打开包装后发现有异味，疑似变质',
          2, now.subtract(15, 'minute').format('YYYY-MM-DD HH:mm:ss'),
          '李配送员', now.format('YYYY-MM-DD HH:mm:ss')
        );
      }
    });

    db.prepare(`
      UPDATE delivery_batches 
      SET status = 'completed', delivered_meals = 8, returned_meals = 0, updated_at = ? 
      WHERE id = ?
    `).run(now.format('YYYY-MM-DD HH:mm:ss'), batchId);

    CompensationEngine.autoGenerateCompensations(batchId);
    CompensationEngine.checkAndCreateSafetyIncidents(batchId);

    res.json({
      success: true,
      message: '异常拦截样例数据创建成功',
      data: {
        batch_id: batchId,
        batch_no: batchNo,
        segments: 2,
        receipts: 4,
        returns: 2,
        pending_approvals: 2,
        type: 'abnormal',
        warning: '请前往"退餐审核"和"补偿审核"处理待审批记录'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/init-rules', (req, res) => {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const existing = db.prepare('SELECT COUNT(*) as count FROM compensation_rules').get();
  if (existing && existing.count > 0) {
    return res.json({ success: true, message: '规则已存在，跳过初始化' });
  }

  const rules = [
    {
      id: uuidv4(),
      rule_name: '温度异常补偿-固定',
      trigger_type: 'temperature',
      trigger_condition: '温度异常比例>30%或连续异常>10个点',
      compensation_type: 'fixed',
      compensation_amount: 200,
      compensation_percent: 0
    },
    {
      id: uuidv4(),
      rule_name: '温度异常补偿-比例',
      trigger_type: 'temperature',
      trigger_condition: '温度异常严重（>60%）',
      compensation_type: 'percent',
      compensation_amount: 0,
      compensation_percent: 20
    },
    {
      id: uuidv4(),
      rule_name: '温度退餐补偿',
      trigger_type: 'return',
      trigger_condition: '退餐原因码为T001/T002',
      compensation_type: 'fixed',
      compensation_amount: 50,
      compensation_percent: 0
    },
    {
      id: uuidv4(),
      rule_name: '食品安全退餐补偿',
      trigger_type: 'return',
      trigger_condition: '退餐原因码为F001/F002',
      compensation_type: 'fixed',
      compensation_amount: 100,
      compensation_percent: 0
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO compensation_rules (
      id, rule_name, trigger_type, trigger_condition,
      compensation_type, compensation_amount, compensation_percent,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  rules.forEach(rule => {
    stmt.run(
      rule.id, rule.rule_name, rule.trigger_type, rule.trigger_condition,
      rule.compensation_type, rule.compensation_amount, rule.compensation_percent,
      now, now
    );
  });

  res.json({ success: true, message: '补偿规则初始化完成', data: { count: rules.length } });
});

module.exports = router;
