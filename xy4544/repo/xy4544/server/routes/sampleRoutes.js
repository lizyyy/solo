const express = require('express');
const router = express.Router();
const db = require('../database');

router.post('/import', (req, res) => {
  try {
    const sampleData = generateSampleData();
    importSampleData(sampleData)
      .then(result => {
        res.json({
          success: true,
          message: '示例数据导入成功',
          ...result
        });
      })
      .catch(error => {
        console.error('导入示例数据失败:', error);
        res.status(500).json({ error: '导入示例数据失败: ' + error.message });
      });
  } catch (error) {
    console.error('生成示例数据失败:', error);
    res.status(500).json({ error: '生成示例数据失败: ' + error.message });
  }
});

function generateSampleData() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const formatDateTime = (date) => {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  };
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const cabins = [];
  const sensorData = [];
  const inspections = [];
  const alarms = [];
  const complaints = [];
  
  const decks = ['3', '4', '5', '6', '7', '8'];
  const cabinTypes = ['内舱房', '海景房', '阳台房', '套房'];
  
  const cabinNumbers = [];
  decks.forEach(deck => {
    for (let i = 1; i <= 10; i++) {
      const cabinNumber = `${deck}${String(i).padStart(3, '0')}`;
      cabinNumbers.push(cabinNumber);
      
      cabins.push({
        cabin_number: cabinNumber,
        deck: deck,
        type: cabinTypes[Math.floor(Math.random() * cabinTypes.length)]
      });
    }
  });
  
  const highPriorityCabins = ['5003', '6005', '7008'];
  const mediumPriorityCabins = ['4002', '5006', '8003'];
  const falseAlarmCabins = ['3001', '6009'];
  
  cabinNumbers.forEach((cabinNumber, cabinIndex) => {
    const deck = cabinNumber.charAt(0);
    
    let baseTemp = 24;
    let baseHumidity = 55;
    
    if (highPriorityCabins.includes(cabinNumber)) {
      baseTemp = 28;
      baseHumidity = 75;
    } else if (mediumPriorityCabins.includes(cabinNumber)) {
      baseTemp = 25.5;
      baseHumidity = 65;
    } else if (falseAlarmCabins.includes(cabinNumber)) {
      baseTemp = 24;
      baseHumidity = 55;
    }
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timestamp = new Date(yesterday);
        timestamp.setHours(hour, minute, 0, 0);
        
        let tempVariation = (Math.random() - 0.5) * 2;
        let humVariation = (Math.random() - 0.5) * 5;
        
        if (falseAlarmCabins.includes(cabinNumber) && hour >= 14 && hour < 15) {
          tempVariation = -5 - Math.random() * 3;
        }
        
        sensorData.push({
          cabin_number: cabinNumber,
          timestamp: formatDateTime(timestamp),
          temperature: baseTemp + tempVariation,
          humidity: baseHumidity + humVariation,
          source: '示例数据'
        });
      }
    }
  });
  
  const inspectionDates = [twoDaysAgo, yesterday, today];
  cabinNumbers.forEach(cabinNumber => {
    const inspectionDate = inspectionDates[Math.floor(Math.random() * inspectionDates.length)];
    
    let fanCoilStatus = '正常';
    let filterStatus = '干净';
    let condensatePipeStatus = '通畅';
    
    if (highPriorityCabins.includes(cabinNumber)) {
      fanCoilStatus = '故障';
      filterStatus = '脏污';
      condensatePipeStatus = '堵塞';
    } else if (mediumPriorityCabins.includes(cabinNumber)) {
      fanCoilStatus = '异常';
      filterStatus = '需要更换';
    }
    
    inspections.push({
      cabin_number: cabinNumber,
      inspection_date: formatDate(inspectionDate),
      inspector: ['张三', '李四', '王五'][Math.floor(Math.random() * 3)],
      fan_coil_status: fanCoilStatus,
      filter_status: filterStatus,
      condensate_pipe_status: condensatePipeStatus,
      temperature_setpoint: 24,
      actual_temperature: 24 + Math.random() * 2,
      actual_humidity: 55 + Math.random() * 10,
      notes: highPriorityCabins.includes(cabinNumber) ? '风机盘管异响，需要检修' : ''
    });
  });
  
  highPriorityCabins.forEach(cabinNumber => {
    const alarmTime = new Date(yesterday);
    alarmTime.setHours(15, 30, 0);
    
    alarms.push({
      cabin_number: cabinNumber,
      alarm_type: '冷凝水报警',
      alarm_time: formatDateTime(alarmTime),
      alarm_level: '高',
      description: '冷凝水管温度异常，可能存在堵塞',
      status: '未确认'
    });
    
    const alarmTime2 = new Date(yesterday);
    alarmTime2.setHours(18, 45, 0);
    
    alarms.push({
      cabin_number: cabinNumber,
      alarm_type: '温度异常',
      alarm_time: formatDateTime(alarmTime2),
      alarm_level: '中',
      description: '舱房温度超过设定值5°C',
      status: '未确认'
    });
  });
  
  mediumPriorityCabins.forEach((cabinNumber, index) => {
    const alarmTime = new Date(yesterday);
    alarmTime.setHours(10 + index * 2, 15, 0);
    
    alarms.push({
      cabin_number: cabinNumber,
      alarm_type: '湿度异常',
      alarm_time: formatDateTime(alarmTime),
      alarm_level: '中',
      description: '舱房湿度过高',
      status: '已确认'
    });
  });
  
  falseAlarmCabins.forEach((cabinNumber, index) => {
    const alarmTime = new Date(yesterday);
    alarmTime.setHours(14, 15 + index * 5, 0);
    
    alarms.push({
      cabin_number: cabinNumber,
      alarm_type: '温度骤降',
      alarm_time: formatDateTime(alarmTime),
      alarm_level: '低',
      description: '舱房温度短时间内下降超过3°C',
      status: '未确认'
    });
  });
  
  highPriorityCabins.forEach((cabinNumber, index) => {
    const complaintTime = new Date(yesterday);
    complaintTime.setHours(16 + index, 0, 0);
    
    complaints.push({
      cabin_number: cabinNumber,
      complaint_time: formatDateTime(complaintTime),
      complainant: `乘客${String.fromCharCode(65 + index)}先生/女士`,
      type: '空调问题',
      description: '舱房温度过高，空调不制冷，晚上无法入睡',
      status: '待处理',
      priority: '高',
      assigned_to: null
    });
  });
  
  mediumPriorityCabins.forEach((cabinNumber, index) => {
    const complaintTime = new Date(twoDaysAgo);
    complaintTime.setHours(9 + index, 30, 0);
    
    complaints.push({
      cabin_number: cabinNumber,
      complaint_time: formatDateTime(complaintTime),
      complainant: `乘客${String.fromCharCode(68 + index)}先生/女士`,
      type: '湿度问题',
      description: '舱房感觉比较潮湿，被子有点黏',
      status: '处理中',
      priority: '中',
      assigned_to: '李四'
    });
  });
  
  return {
    cabins,
    sensorData,
    inspections,
    alarms,
    complaints
  };
}

function importSampleData(data) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      try {
        const cabinStmt = db.prepare(`
          INSERT OR IGNORE INTO cabins (cabin_number, deck, type)
          VALUES (?, ?, ?)
        `);
        
        data.cabins.forEach(cabin => {
          cabinStmt.run([cabin.cabin_number, cabin.deck, cabin.type]);
        });
        
        const sensorStmt = db.prepare(`
          INSERT INTO sensor_data (cabin_number, timestamp, temperature, humidity, source)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        data.sensorData.forEach(sensor => {
          sensorStmt.run([
            sensor.cabin_number,
            sensor.timestamp,
            sensor.temperature,
            sensor.humidity,
            sensor.source
          ]);
        });
        
        const inspectionStmt = db.prepare(`
          INSERT INTO inspection_data (
            cabin_number, inspection_date, inspector, fan_coil_status,
            filter_status, condensate_pipe_status, temperature_setpoint,
            actual_temperature, actual_humidity, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.inspections.forEach(inspection => {
          inspectionStmt.run([
            inspection.cabin_number,
            inspection.inspection_date,
            inspection.inspector,
            inspection.fan_coil_status,
            inspection.filter_status,
            inspection.condensate_pipe_status,
            inspection.temperature_setpoint,
            inspection.actual_temperature,
            inspection.actual_humidity,
            inspection.notes
          ]);
        });
        
        const alarmStmt = db.prepare(`
          INSERT INTO alarm_data (
            cabin_number, alarm_type, alarm_time, alarm_level,
            description, status
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        data.alarms.forEach(alarm => {
          alarmStmt.run([
            alarm.cabin_number,
            alarm.alarm_type,
            alarm.alarm_time,
            alarm.alarm_level,
            alarm.description,
            alarm.status
          ]);
        });
        
        const complaintStmt = db.prepare(`
          INSERT INTO complaints (
            cabin_number, complaint_time, complainant, type,
            description, status, priority, assigned_to
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.complaints.forEach(complaint => {
          complaintStmt.run([
            complaint.cabin_number,
            complaint.complaint_time,
            complaint.complainant,
            complaint.type,
            complaint.description,
            complaint.status,
            complaint.priority,
            complaint.assigned_to
          ]);
        });
        
        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve({
              cabins_count: data.cabins.length,
              sensor_data_count: data.sensorData.length,
              inspections_count: data.inspections.length,
              alarms_count: data.alarms.length,
              complaints_count: data.complaints.length
            });
          }
        });
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
}

router.get('/status', (req, res) => {
  const queries = [
    { key: 'cabins', query: 'SELECT COUNT(*) as count FROM cabins' },
    { key: 'sensor_data', query: 'SELECT COUNT(*) as count FROM sensor_data' },
    { key: 'inspections', query: 'SELECT COUNT(*) as count FROM inspection_data' },
    { key: 'alarms', query: 'SELECT COUNT(*) as count FROM alarm_data' },
    { key: 'complaints', query: 'SELECT COUNT(*) as count FROM complaints' },
    { key: 'analysis', query: 'SELECT COUNT(*) as count FROM cabin_analysis' }
  ];
  
  const results = {};
  let completed = 0;
  
  queries.forEach(({ key, query }) => {
    db.get(query, (err, row) => {
      if (err) {
        results[key] = { error: err.message };
      } else {
        results[key] = { count: row.count };
      }
      
      completed++;
      if (completed === queries.length) {
        res.json({
          success: true,
          data_status: results,
          has_sample_data: results.sensor_data.count > 0
        });
      }
    });
  });
});

router.post('/clear', (req, res) => {
  const tables = [
    'complaints',
    'alarm_data',
    'inspection_data',
    'sensor_data',
    'cabin_analysis',
    'cabins'
  ];
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    try {
      tables.forEach(table => {
        db.run(`DELETE FROM ${table}`);
      });
      
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
        } else {
          res.json({
            success: true,
            message: '所有数据已清除',
            tables_cleared: tables.length
          });
        }
      });
    } catch (error) {
      db.run('ROLLBACK');
      res.status(500).json({ error: error.message });
    }
  });
});

module.exports = router;
