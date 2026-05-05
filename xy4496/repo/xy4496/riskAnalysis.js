const db = require('./database');

const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const THRESHOLDS = {
  EDGE_CRUSH_RATIO: 0.85,
  EDGE_CRUSH_CRITICAL: 0.7,
  BURST_RATIO: 0.85,
  BURST_CRITICAL: 0.7,
  HUMIDITY_HIGH: 70,
  HUMIDITY_CRITICAL: 80,
  STORAGE_DAYS_MAX: 30,
  STORAGE_DAYS_WARNING: 15,
  STACK_LAYERS_SAFE: 5,
  STACK_LAYERS_WARNING: 7,
  TEMPERATURE_HIGH: 35
};

function analyzePressureRisk(orderNumber) {
  const testResult = db.get(`
    SELECT tr.*, cb.corrugated_type, cb.paper_grade
    FROM test_results tr
    LEFT JOIN cardboard_batches cb ON tr.batch_number = cb.batch_number
    WHERE tr.order_number = ?
    ORDER BY tr.test_date DESC
    LIMIT 1
  `, [orderNumber]);

  if (!testResult) {
    return {
      risk: RISK_LEVELS.MEDIUM,
      reason: '无测试数据，无法评估抗压风险'
    };
  }

  const reasons = [];
  let riskLevel = RISK_LEVELS.LOW;

  if (testResult.edge_crush !== null && testResult.edge_crush !== undefined) {
    const edgeCrushMin = testResult.edge_crush_min || 100;
    const edgeRatio = testResult.edge_crush / edgeCrushMin;
    
    if (edgeRatio < THRESHOLDS.EDGE_CRUSH_CRITICAL) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`边压强度严重不足: ${testResult.edge_crush.toFixed(1)} N/m (标准: ${edgeCrushMin}, 比值: ${(edgeRatio * 100).toFixed(1)}%)`);
    } else if (edgeRatio < THRESHOLDS.EDGE_CRUSH_RATIO) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`边压强度偏低: ${testResult.edge_crush.toFixed(1)} N/m (标准: ${edgeCrushMin}, 比值: ${(edgeRatio * 100).toFixed(1)}%)`);
    }
  } else {
    if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
    reasons.push('边压测试数据缺失');
  }

  if (testResult.burst_strength !== null && testResult.burst_strength !== undefined) {
    const burstMin = testResult.burst_strength_min || 100;
    const burstRatio = testResult.burst_strength / burstMin;
    
    if (burstRatio < THRESHOLDS.BURST_CRITICAL) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`耐破强度严重不足: ${testResult.burst_strength.toFixed(1)} kPa (标准: ${burstMin}, 比值: ${(burstRatio * 100).toFixed(1)}%)`);
    } else if (burstRatio < THRESHOLDS.BURST_RATIO) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`耐破强度偏低: ${testResult.burst_strength.toFixed(1)} kPa (标准: ${burstMin}, 比值: ${(burstRatio * 100).toFixed(1)}%)`);
    }
  } else {
    if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
    reasons.push('耐破测试数据缺失');
  }

  if (reasons.length === 0) {
    reasons.push('边压和耐破强度均符合标准要求');
  }

  return {
    risk: riskLevel,
    reason: reasons.join('; ')
  };
}

function analyzeMoistureRisk(orderNumber) {
  const order = db.get(`
    SELECT * FROM orders WHERE order_number = ?
  `, [orderNumber]);

  if (!order) {
    return {
      risk: RISK_LEVELS.LOW,
      reason: '订单信息不存在'
    };
  }

  const reasons = [];
  let riskLevel = RISK_LEVELS.LOW;

  const envRecords = db.all(`
    SELECT * FROM warehouse_environment
    WHERE record_date >= DATE('now', '-30 days')
    ORDER BY record_date DESC
  `);

  if (envRecords.length > 0) {
    const highHumidityCount = envRecords.filter(r => r.humidity >= THRESHOLDS.HUMIDITY_HIGH).length;
    const criticalHumidityCount = envRecords.filter(r => r.humidity >= THRESHOLDS.HUMIDITY_CRITICAL).length;
    const highTempCount = envRecords.filter(r => r.temperature >= THRESHOLDS.TEMPERATURE_HIGH).length;

    if (criticalHumidityCount > 0) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`近30天有${criticalHumidityCount}天湿度超过${THRESHOLDS.HUMIDITY_CRITICAL}%，存在严重受潮风险`);
    } else if (highHumidityCount > 5) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`近30天有${highHumidityCount}天湿度超过${THRESHOLDS.HUMIDITY_HIGH}%，存在受潮风险`);
    }

    if (highTempCount > 0) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`近30天有${highTempCount}天温度超过${THRESHOLDS.TEMPERATURE_HIGH}°C，可能加速材料老化`);
    }
  }

  if (order.production_date) {
    const prodDate = new Date(order.production_date);
    const today = new Date();
    const storageDays = Math.floor((today - prodDate) / (1000 * 60 * 60 * 24));

    if (storageDays > THRESHOLDS.STORAGE_DAYS_MAX) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`库存超期: 已存放${storageDays}天 (最大允许${THRESHOLDS.STORAGE_DAYS_MAX}天)`);
    } else if (storageDays > THRESHOLDS.STORAGE_DAYS_WARNING) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`库存警告: 已存放${storageDays}天，接近超期阈值`);
    }
  }

  const batch = db.get(`
    SELECT cb.* FROM test_results tr
    LEFT JOIN cardboard_batches cb ON tr.batch_number = cb.batch_number
    WHERE tr.order_number = ?
    LIMIT 1
  `, [orderNumber]);

  if (batch && batch.expiration_date) {
    const expDate = new Date(batch.expiration_date);
    const today = new Date();
    const daysToExpire = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));

    if (daysToExpire < 0) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`纸板批次已过期: 过期${Math.abs(daysToExpire)}天`);
    } else if (daysToExpire < 7) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`纸板批次即将过期: 剩余${daysToExpire}天`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('温湿度正常，库存时间在安全范围内');
  }

  return {
    risk: riskLevel,
    reason: reasons.join('; ')
  };
}

function analyzeStackRisk(orderNumber) {
  const loading = db.get(`
    SELECT * FROM loading_list
    WHERE order_number = ?
    ORDER BY loading_date DESC
    LIMIT 1
  `, [orderNumber]);

  const testResult = db.get(`
    SELECT * FROM test_results
    WHERE order_number = ?
    ORDER BY test_date DESC
    LIMIT 1
  `, [orderNumber]);

  const reasons = [];
  let riskLevel = RISK_LEVELS.LOW;

  if (loading && loading.stack_layers) {
    if (loading.stack_layers > THRESHOLDS.STACK_LAYERS_WARNING) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`堆码层数过高: ${loading.stack_layers}层 (警告阈值: ${THRESHOLDS.STACK_LAYERS_WARNING}层)`);
    } else if (loading.stack_layers > THRESHOLDS.STACK_LAYERS_SAFE) {
      riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`堆码层数偏高: ${loading.stack_layers}层 (安全阈值: ${THRESHOLDS.STACK_LAYERS_SAFE}层)`);
    }
  }

  if (testResult && testResult.edge_crush) {
    const estimatedStackCapacity = calculateStackCapacity(testResult.edge_crush);
    if (loading && loading.stack_layers && loading.stack_layers > estimatedStackCapacity) {
      riskLevel = RISK_LEVELS.HIGH;
      reasons.push(`根据边压强度计算，安全堆码层数约为${estimatedStackCapacity}层，实际堆码${loading.stack_layers}层超出安全范围`);
    }
  }

  if (loading && loading.total_weight) {
    if (loading.total_weight > 2000) {
      if (riskLevel !== RISK_LEVELS.HIGH) riskLevel = RISK_LEVELS.MEDIUM;
      reasons.push(`总重量较大: ${loading.total_weight}kg，需注意堆码稳定性`);
    }
  }

  if (reasons.length === 0) {
    if (loading && loading.stack_layers) {
      reasons.push(`堆码层数${loading.stack_layers}层，在安全范围内`);
    } else {
      reasons.push('无装车堆码信息，默认低风险');
    }
  }

  return {
    risk: riskLevel,
    reason: reasons.join('; ')
  };
}

function calculateStackCapacity(edgeCrush) {
  const safetyFactor = 0.7;
  const estimatedCapacity = Math.floor((edgeCrush / 100) * 5 * safetyFactor);
  return Math.max(1, estimatedCapacity);
}

function calculateOverallRisk(pressureRisk, moistureRisk, stackRisk) {
  const riskScores = {
    [RISK_LEVELS.HIGH]: 3,
    [RISK_LEVELS.MEDIUM]: 2,
    [RISK_LEVELS.LOW]: 1
  };

  const scores = [
    riskScores[pressureRisk],
    riskScores[moistureRisk],
    riskScores[stackRisk]
  ];

  const maxScore = Math.max(...scores);
  const highRiskCount = scores.filter(s => s === 3).length;
  const mediumRiskCount = scores.filter(s => s === 2).length;

  if (highRiskCount >= 2 || maxScore === 3) {
    return RISK_LEVELS.HIGH;
  } else if (mediumRiskCount >= 2 || maxScore === 2) {
    return RISK_LEVELS.MEDIUM;
  }

  return RISK_LEVELS.LOW;
}

function analyzeOrder(orderNumber) {
  const pressureResult = analyzePressureRisk(orderNumber);
  const moistureResult = analyzeMoistureRisk(orderNumber);
  const stackResult = analyzeStackRisk(orderNumber);

  const overallRisk = calculateOverallRisk(
    pressureResult.risk,
    moistureResult.risk,
    stackResult.risk
  );

  return {
    orderNumber,
    assessmentDate: new Date().toISOString().split('T')[0],
    pressureRisk: pressureResult.risk,
    pressureRiskReason: pressureResult.reason,
    moistureRisk: moistureResult.risk,
    moistureRiskReason: moistureResult.reason,
    stackRisk: stackResult.risk,
    stackRiskReason: stackResult.reason,
    overallRisk
  };
}

function saveRiskAssessment(assessment) {
  const existing = db.get(`
    SELECT id FROM risk_assessments 
    WHERE order_number = ? AND assessment_date = ?
  `, [assessment.orderNumber, assessment.assessmentDate]);

  if (existing) {
    db.run(`
      UPDATE risk_assessments SET
        pressure_risk = ?,
        pressure_risk_reason = ?,
        moisture_risk = ?,
        moisture_risk_reason = ?,
        stack_risk = ?,
        stack_risk_reason = ?,
        overall_risk = ?
      WHERE order_number = ? AND assessment_date = ?
    `, [
      assessment.pressureRisk,
      assessment.pressureRiskReason,
      assessment.moistureRisk,
      assessment.moistureRiskReason,
      assessment.stackRisk,
      assessment.stackRiskReason,
      assessment.overallRisk,
      assessment.orderNumber,
      assessment.assessmentDate
    ]);
    return { success: true, id: existing.id, updated: true };
  } else {
    const result = db.run(`
      INSERT INTO risk_assessments (
        order_number, assessment_date,
        pressure_risk, pressure_risk_reason,
        moisture_risk, moisture_risk_reason,
        stack_risk, stack_risk_reason,
        overall_risk
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      assessment.orderNumber,
      assessment.assessmentDate,
      assessment.pressureRisk,
      assessment.pressureRiskReason,
      assessment.moistureRisk,
      assessment.moistureRiskReason,
      assessment.stackRisk,
      assessment.stackRiskReason,
      assessment.overallRisk
    ]);
    return result;
  }
}

function analyzeAllOrders() {
  const orders = db.all('SELECT order_number FROM orders ORDER BY created_at DESC');
  const results = [];

  for (const order of orders) {
    const assessment = analyzeOrder(order.order_number);
    const saveResult = saveRiskAssessment(assessment);
    results.push({
      ...assessment,
      saveResult
    });
  }

  return results;
}

module.exports = {
  analyzePressureRisk,
  analyzeMoistureRisk,
  analyzeStackRisk,
  analyzeOrder,
  analyzeAllOrders,
  saveRiskAssessment,
  RISK_LEVELS,
  THRESHOLDS
};
