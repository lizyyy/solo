const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('./database');

const THICKNESS_THRESHOLD = 1.0;
const CAPACITY_FACTOR = 0.5;
const SAFE_HEATING_FACTOR = 0.8;
const SAFE_COOLING_FACTOR = 0.7;

function calculateStageDuration(stage, kiln, pieces) {
  let duration = 0;
  const stageCopy = { ...stage };

  switch (stage.stage_type) {
    case 'heating':
      const tempDiff = stage.target_temp - stage.start_temp;
      if (stage.heating_rate > 0 && tempDiff > 0) {
        const baseDuration = tempDiff / stage.heating_rate;
        const weightFactor = 1 + (getTotalWeight(pieces) * 0.1);
        const capacityFactor = 1 + (calculateCapacityUtilization(kiln, pieces) * 0.2);
        duration = baseDuration * weightFactor * capacityFactor;
      }
      stageCopy.estimated_duration = duration;
      break;

    case 'holding':
      duration = stage.hold_duration || 0;
      stageCopy.estimated_duration = duration;
      break;

    case 'cooling':
      const coolDiff = stage.start_temp - stage.target_temp;
      if (stage.cooling_rate > 0 && coolDiff > 0) {
        duration = coolDiff / stage.cooling_rate;
      }
      stageCopy.estimated_duration = duration;
      break;
  }

  return { stage: stageCopy, duration };
}

function calculateTotalDuration(stages, kiln, pieces) {
  let totalDuration = 0;
  const detailedStages = [];

  for (const stage of stages) {
    const result = calculateStageDuration(stage, kiln, pieces);
    totalDuration += result.duration;
    detailedStages.push(result.stage);
  }

  return { totalDuration, detailedStages };
}

function calculateCost(durationHours, kiln, electricityPrice) {
  return durationHours * kiln.power * electricityPrice;
}

function getTotalWeight(pieces) {
  return pieces.reduce((sum, p) => sum + (p.weight || 0), 0);
}

function calculateCapacityUtilization(kiln, pieces) {
  if (!kiln || !kiln.capacity || kiln.capacity <= 0) return 0;
  const totalWeight = getTotalWeight(pieces);
  const estimatedVolume = totalWeight * 0.002;
  return Math.min(estimatedVolume / kiln.capacity, 1.5);
}

function checkHeatingRisk(stage, piece, body) {
  const risks = [];
  const thickness = piece.thickness || 0;

  if (stage.stage_type === 'heating' && stage.heating_rate > 0) {
    const safeRate = thickness >= THICKNESS_THRESHOLD
      ? body.safe_heating_rate_for_thick
      : body.max_heating_rate;

    const adjustedSafeRate = safeRate * SAFE_HEATING_FACTOR;

    if (stage.heating_rate > adjustedSafeRate) {
      risks.push({
        risk_type: 'heating_too_fast',
        risk_level: thickness >= THICKNESS_THRESHOLD ? 'high' : 'medium',
        message: `作品「${piece.name}」升温速率可能过快`,
        details: `当前升温速率: ${stage.heating_rate}°C/小时, 安全速率: ${Math.round(adjustedSafeRate)}°C/小时, 作品厚度: ${thickness}cm, 坯体类型: ${body.name}`
      });
    }
  }

  return risks;
}

function checkCoolingRisk(stage, piece, body, glaze) {
  const risks = [];
  const thickness = piece.thickness || 0;

  if (stage.stage_type === 'cooling' && stage.cooling_rate > 0) {
    const safeRate = body.max_cooling_rate * SAFE_COOLING_FACTOR;

    if (stage.cooling_rate > safeRate) {
      const sensitivityLevel = glaze?.cooling_sensitivity || 'low';
      const riskLevel = sensitivityLevel === 'high' ? 'high' : 
                        sensitivityLevel === 'medium' ? 'medium' : 'low';

      risks.push({
        risk_type: 'cooling_too_fast',
        risk_level: riskLevel,
        message: `作品「${piece.name}」降温速率可能过快`,
        details: `当前降温速率: ${stage.cooling_rate}°C/小时, 安全速率: ${Math.round(safeRate)}°C/小时, 坯体类型: ${body.name}, 釉料敏感度: ${sensitivityLevel}`
      });
    }
  }

  return risks;
}

function checkGlazeMaturity(stages, glaze, piece) {
  const risks = [];
  if (!glaze) return risks;

  let reachedOptimal = false;
  let holdAtOptimal = 0;

  for (const stage of stages) {
    if (stage.stage_type === 'heating' || stage.stage_type === 'cooling') {
      const tempRange = stage.stage_type === 'heating'
        ? [stage.start_temp, stage.target_temp]
        : [stage.target_temp, stage.start_temp];

      if (glaze.optimal_firing_temp >= tempRange[0] && glaze.optimal_firing_temp <= tempRange[1]) {
        reachedOptimal = true;
      }
    }

    if (stage.stage_type === 'holding') {
      if (stage.start_temp >= glaze.min_firing_temp && stage.start_temp <= glaze.max_firing_temp) {
        holdAtOptimal += stage.hold_duration || 0;
      }
    }
  }

  const maxTemp = Math.max(...stages.map(s => s.target_temp || s.start_temp));

  if (maxTemp < glaze.min_firing_temp) {
    risks.push({
      risk_type: 'glaze_temp_too_low',
      risk_level: 'high',
      message: `作品「${piece.name}」釉料「${glaze.name}」烧成温度过低`,
      details: `最高温度: ${maxTemp}°C, 釉料最低需要: ${glaze.min_firing_temp}°C, 建议: ${glaze.optimal_firing_temp}°C`
    });
  }

  if (maxTemp > glaze.max_firing_temp + 50) {
    risks.push({
      risk_type: 'glaze_temp_too_high',
      risk_level: 'medium',
      message: `作品「${piece.name}」釉料「${glaze.name}」烧成温度可能过高`,
      details: `最高温度: ${maxTemp}°C, 釉料最高建议: ${glaze.max_firing_temp}°C`
    });
  }

  if (holdAtOptimal < glaze.hold_time_required) {
    risks.push({
      risk_type: 'glaze_hold_insufficient',
      risk_level: 'medium',
      message: `作品「${piece.name}」釉料「${glaze.name}」保温时间可能不足`,
      details: `实际保温: ${holdAtOptimal}小时, 釉料需要: ${glaze.hold_time_required}小时`
    });
  }

  return risks;
}

function checkCapacityRisk(kiln, pieces) {
  const risks = [];
  const utilization = calculateCapacityUtilization(kiln, pieces);
  const totalWeight = getTotalWeight(pieces);

  if (utilization > 1.0) {
    risks.push({
      risk_type: 'capacity_overload',
      risk_level: 'high',
      message: `装窑容量可能超过窑炉负荷`,
      details: `估算容量利用率: ${Math.round(utilization * 100)}%, 总重量: ${totalWeight}kg, 窑炉容量: ${kiln.capacity}m³`
    });
  } else if (utilization > 0.8) {
    risks.push({
      risk_type: 'capacity_warning',
      risk_level: 'medium',
      message: `装窑容量接近上限`,
      details: `估算容量利用率: ${Math.round(utilization * 100)}%, 建议控制在80%以内以保证均匀受热`
    });
  }

  return risks;
}

function checkBodyHoldTime(stages, body, piece) {
  const risks = [];
  let totalHoldTime = 0;

  for (const stage of stages) {
    if (stage.stage_type === 'holding') {
      totalHoldTime += stage.hold_duration || 0;
    }
  }

  if (totalHoldTime < body.min_hold_time) {
    risks.push({
      risk_type: 'body_hold_insufficient',
      risk_level: 'medium',
      message: `作品「${piece.name}」坯体「${body.name}」保温时间可能不足`,
      details: `总保温时间: ${totalHoldTime}小时, 坯体建议最少: ${body.min_hold_time}小时`
    });
  }

  return risks;
}

function checkDurationAndCost(plan, estimatedDuration, estimatedCost) {
  const risks = [];

  if (plan.expected_max_duration && estimatedDuration > plan.expected_max_duration) {
    risks.push({
      risk_type: 'duration_exceeded',
      risk_level: 'medium',
      message: `预计烧成时间超过预期`,
      details: `预计时长: ${estimatedDuration.toFixed(1)}小时, 预期上限: ${plan.expected_max_duration}小时`
    });
  }

  if (plan.expected_max_cost && estimatedCost > plan.expected_max_cost) {
    risks.push({
      risk_type: 'cost_exceeded',
      risk_level: 'medium',
      message: `预计电费超过预期`,
      details: `预计电费: ¥${estimatedCost.toFixed(2)}, 预期上限: ¥${plan.expected_max_cost.toFixed(2)}`
    });
  }

  return risks;
}

function runRiskCheck(plan, kiln, pieces, stages, bodies, glazes) {
  const allRisks = [];

  allRisks.push(...checkCapacityRisk(kiln, pieces));

  for (const piece of pieces) {
    const body = bodies.find(b => b.id === piece.body_id);
    const glaze = glazes.find(g => g.id === piece.glaze_id);

    if (!body) continue;

    for (const stage of stages) {
      allRisks.push(...checkHeatingRisk(stage, piece, body));
      allRisks.push(...checkCoolingRisk(stage, piece, body, glaze));
    }

    if (glaze) {
      allRisks.push(...checkGlazeMaturity(stages, glaze, piece));
    }

    allRisks.push(...checkBodyHoldTime(stages, body, piece));
  }

  return allRisks;
}

function validateCurve(stages, kiln) {
  const errors = [];
  const warnings = [];

  if (!stages || stages.length === 0) {
    errors.push('烧成曲线不能为空');
    return { valid: false, errors, warnings };
  }

  let currentTemp = 25;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];

    if (!stage.stage_type) {
      errors.push(`第${i + 1}阶段缺少阶段类型`);
      continue;
    }

    switch (stage.stage_type) {
      case 'heating':
        if (stage.target_temp === undefined || stage.target_temp === null) {
          errors.push(`第${i + 1}升温阶段缺少目标温度`);
        }
        if (!stage.heating_rate || stage.heating_rate <= 0) {
          errors.push(`第${i + 1}升温阶段缺少有效的升温速率`);
        }
        if (stage.target_temp && stage.target_temp <= currentTemp) {
          errors.push(`第${i + 1}升温阶段目标温度(${stage.target_temp}°C)必须高于当前温度(${currentTemp}°C)`);
        }
        if (stage.target_temp > kiln.max_temperature) {
          warnings.push(`第${i + 1}升温阶段目标温度(${stage.target_temp}°C)接近或超过窑炉上限(${kiln.max_temperature}°C)`);
        }
        if (stage.heating_rate > 500) {
          warnings.push(`第${i + 1}升温阶段速率(${stage.heating_rate}°C/小时)过高，建议不超过300°C/小时`);
        }
        currentTemp = stage.target_temp || currentTemp;
        break;

      case 'holding':
        if (!stage.hold_duration || stage.hold_duration <= 0) {
          errors.push(`第${i + 1}保温阶段缺少有效的保温时长`);
        }
        if (stage.start_temp !== currentTemp) {
          warnings.push(`第${i + 1}保温阶段起始温度与前一阶段结束温度不一致`);
        }
        break;

      case 'cooling':
        if (stage.target_temp === undefined || stage.target_temp === null) {
          errors.push(`第${i + 1}降温阶段缺少目标温度`);
        }
        if (!stage.cooling_rate || stage.cooling_rate <= 0) {
          errors.push(`第${i + 1}降温阶段缺少有效的降温速率`);
        }
        if (stage.target_temp && stage.target_temp >= currentTemp) {
          errors.push(`第${i + 1}降温阶段目标温度(${stage.target_temp}°C)必须低于当前温度(${currentTemp}°C)`);
        }
        if (stage.cooling_rate > 300) {
          warnings.push(`第${i + 1}降温阶段速率(${stage.cooling_rate}°C/小时)过高，建议不超过200°C/小时`);
        }
        currentTemp = stage.target_temp || currentTemp;
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  calculateStageDuration,
  calculateTotalDuration,
  calculateCost,
  getTotalWeight,
  calculateCapacityUtilization,
  checkHeatingRisk,
  checkCoolingRisk,
  checkGlazeMaturity,
  checkCapacityRisk,
  checkBodyHoldTime,
  checkDurationAndCost,
  runRiskCheck,
  validateCurve,
  THICKNESS_THRESHOLD
};
