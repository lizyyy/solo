const moment = require('moment');
const db = require('../database/database');

const PROCESS_ORDER = ['灰胎', '底漆', '髹涂', '打磨', '描金'];
const DRYING_HOURS = {
  '灰胎': 48,
  '底漆': 24,
  '髹涂': 36,
  '打磨': 0,
  '描金': 0
};

const WETROOM_LIMITS = {
  minHumidity: 60,
  maxHumidity: 85,
  minTemperature: 18,
  maxTemperature: 28
};

async function checkAllViolations() {
  const violations = [];
  
  const notDryViolations = await checkNotDryBeforeNextLayer();
  violations.push(...notDryViolations);
  
  const humidityViolations = await checkHumidityOutOfWindow();
  violations.push(...humidityViolations);
  
  const signatureViolations = await checkMissingMasterSignature();
  violations.push(...signatureViolations);
  
  const sandingViolations = await checkSandingBeforeGilding();
  violations.push(...sandingViolations);
  
  return violations;
}

async function checkNotDryBeforeNextLayer() {
  const violations = [];
  
  const layersWithProcesses = await db.all(`
    SELECT 
      l.id as layer_id,
      l.artwork_id,
      l.layer_number,
      a.artwork_name,
      a.order_number
    FROM layers l
    JOIN artworks a ON l.artwork_id = a.id
    ORDER BY a.id, l.layer_number
  `);

  for (const layer of layersWithProcesses) {
    const processes = await db.all(`
      SELECT 
        process_type,
        start_time,
        end_time,
        status
      FROM processes
      WHERE layer_id = ?
      ORDER BY start_time
    `, [layer.layer_id]);

    for (let i = 0; i < processes.length - 1; i++) {
      const currentProcess = processes[i];
      const nextProcess = processes[i + 1];
      
      const dryingHours = DRYING_HOURS[currentProcess.process_type] || 0;
      
      if (dryingHours > 0 && currentProcess.end_time && nextProcess.start_time) {
        const endTime = moment(currentProcess.end_time);
        const nextStartTime = moment(nextProcess.start_time);
        const actualDryingHours = nextStartTime.diff(endTime, 'hours', true);
        
        if (actualDryingHours < dryingHours) {
          violations.push({
            type: '未干透进入下一层',
            severity: 'critical',
            description: `作品"${layer.artwork_name}" (订单: ${layer.order_number}) 第${layer.layer_number}层 - ${currentProcess.process_type}完成后仅干燥${actualDryingHours.toFixed(1)}小时，要求${dryingHours}小时后才能进行${nextProcess.process_type}`,
            artwork_id: layer.artwork_id,
            layer_id: layer.layer_id,
            process_type: currentProcess.process_type,
            detected_at: moment().toISOString()
          });
        }
      }
    }
  }

  return violations;
}

async function checkHumidityOutOfWindow() {
  const violations = [];
  
  const readings = await db.all(`
    SELECT 
      id,
      cabinet_id,
      reading_time,
      temperature,
      humidity,
      recorded_by
    FROM wetroom_readings
    ORDER BY cabinet_id, reading_time
  `);

  for (const reading of readings) {
    const humidityIssues = [];
    const temperatureIssues = [];
    
    if (reading.humidity < WETROOM_LIMITS.minHumidity) {
      humidityIssues.push(`湿度过低: ${reading.humidity}% (最低要求: ${WETROOM_LIMITS.minHumidity}%)`);
    }
    if (reading.humidity > WETROOM_LIMITS.maxHumidity) {
      humidityIssues.push(`湿度过高: ${reading.humidity}% (最高要求: ${WETROOM_LIMITS.maxHumidity}%)`);
    }
    if (reading.temperature < WETROOM_LIMITS.minTemperature) {
      temperatureIssues.push(`温度过低: ${reading.temperature}°C (最低要求: ${WETROOM_LIMITS.minTemperature}°C)`);
    }
    if (reading.temperature > WETROOM_LIMITS.maxTemperature) {
      temperatureIssues.push(`温度过高: ${reading.temperature}°C (最高要求: ${WETROOM_LIMITS.maxTemperature}°C)`);
    }
    
    if (humidityIssues.length > 0 || temperatureIssues.length > 0) {
      violations.push({
        type: '湿房温湿度超窗',
        severity: 'warning',
        description: `柜号${reading.cabinet_id} 在 ${reading.reading_time} 检测异常: ${[...humidityIssues, ...temperatureIssues].join('; ')}`,
        cabinet_id: reading.cabinet_id,
        reading_id: reading.id,
        detected_at: moment().toISOString()
      });
    }
  }

  return violations;
}

async function checkMissingMasterSignature() {
  const violations = [];
  
  const completedLayers = await db.all(`
    SELECT 
      l.id as layer_id,
      l.artwork_id,
      l.layer_number,
      a.artwork_name,
      a.order_number
    FROM layers l
    JOIN artworks a ON l.artwork_id = a.id
    WHERE l.status = 'completed'
    ORDER BY a.id, l.layer_number
  `);

  for (const layer of completedLayers) {
    const reviews = await db.all(`
      SELECT 
        id,
        reviewer_name,
        signature,
        status,
        review_date
      FROM reviews
      WHERE layer_id = ?
    `, [layer.layer_id]);

    const hasMasterSignature = reviews.some(r => 
      r.signature && r.signature.trim() !== '' && r.status === 'approved'
    );

    if (!hasMasterSignature) {
      violations.push({
        type: '师傅签名缺失',
        severity: 'critical',
        description: `作品"${layer.artwork_name}" (订单: ${layer.order_number}) 第${layer.layer_number}层已标记完成，但缺少师傅复核签名`,
        artwork_id: layer.artwork_id,
        layer_id: layer.layer_id,
        detected_at: moment().toISOString()
      });
    }
  }

  return violations;
}

async function checkSandingBeforeGilding() {
  const violations = [];
  
  const gildingProcesses = await db.all(`
    SELECT 
      p.id as process_id,
      p.layer_id,
      p.process_type,
      p.start_time,
      p.status,
      l.artwork_id,
      l.layer_number,
      a.artwork_name,
      a.order_number
    FROM processes p
    JOIN layers l ON p.layer_id = l.id
    JOIN artworks a ON l.artwork_id = a.id
    WHERE p.process_type = '描金'
    ORDER BY a.id, l.layer_number
  `);

  for (const gilding of gildingProcesses) {
    const sandingProcess = await db.get(`
      SELECT 
        id,
        process_type,
        status,
        end_time
      FROM processes
      WHERE layer_id = ? AND process_type = '打磨'
    `, [gilding.layer_id]);

    if (!sandingProcess) {
      if (gilding.status === 'completed' || gilding.status === 'in_progress') {
        violations.push({
          type: '描金前打磨漏检',
          severity: 'critical',
          description: `作品"${gilding.artwork_name}" (订单: ${gilding.order_number}) 第${gilding.layer_number}层的描金工序已${gilding.status === 'completed' ? '完成' : '开始'}，但从未进行打磨工序`,
          artwork_id: gilding.artwork_id,
          layer_id: gilding.layer_id,
          process_type: '描金',
          detected_at: moment().toISOString()
        });
      }
    } else if (sandingProcess.status !== 'completed') {
      if (gilding.status === 'completed' || gilding.status === 'in_progress') {
        violations.push({
          type: '描金前打磨漏检',
          severity: 'critical',
          description: `作品"${gilding.artwork_name}" (订单: ${gilding.order_number}) 第${gilding.layer_number}层的描金工序已${gilding.status === 'completed' ? '完成' : '开始'}，但打磨工序状态为"${sandingProcess.status}"，未完成`,
          artwork_id: gilding.artwork_id,
          layer_id: gilding.layer_id,
          process_type: '描金',
          detected_at: moment().toISOString()
        });
      }
    }
  }

  return violations;
}

async function recordViolations(violations) {
  const results = [];
  
  for (const violation of violations) {
    const existing = await db.get(`
      SELECT id FROM violations 
      WHERE type = ? 
        AND artwork_id = ? 
        AND layer_id = ? 
        AND process_type = ?
        AND resolved = 0
    `, [violation.type, violation.artwork_id, violation.layer_id, violation.process_type]);

    if (!existing) {
      const result = await db.run(`
        INSERT INTO violations (
          type, severity, description, artwork_id, layer_id, 
          process_type, cabinet_id, reading_id, detected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        violation.type,
        violation.severity,
        violation.description,
        violation.artwork_id,
        violation.layer_id,
        violation.process_type,
        violation.cabinet_id,
        violation.reading_id,
        violation.detected_at
      ]);
      
      results.push({ ...violation, id: result.lastID });
    }
  }
  
  return results;
}

async function runFullCheckAndRecord() {
  const violations = await checkAllViolations();
  const recorded = await recordViolations(violations);
  return {
    total: violations.length,
    new_records: recorded.length,
    violations: recorded
  };
}

module.exports = {
  checkAllViolations,
  checkNotDryBeforeNextLayer,
  checkHumidityOutOfWindow,
  checkMissingMasterSignature,
  checkSandingBeforeGilding,
  recordViolations,
  runFullCheckAndRecord,
  PROCESS_ORDER,
  DRYING_HOURS,
  WETROOM_LIMITS
};
