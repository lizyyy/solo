const models = require('../models');
const dayjs = require('dayjs');

const { equipment, flightRequests, EQUIPMENT_STATUS } = models;

const REQUIRED_TYPES = ['canopy', 'reserve', 'helmet'];

function getAvailableEquipment(studentLevel, windSpeed, date, timeSlot) {
  const available = equipment.filter(eq => {
    if (eq.status !== EQUIPMENT_STATUS.AVAILABLE) return false;
    
    if (!eq.suitableLevels.includes(studentLevel)) return false;
    
    if (windSpeed > eq.maxWindSpeed) return false;
    
    const isInUse = flightRequests.some(fr =>
      fr.equipmentIds && fr.equipmentIds.includes(eq.id) &&
      fr.date === date && fr.timeSlot === timeSlot &&
      ['pending_approval', 'approved', 'in_progress'].includes(fr.status)
    );
    
    return !isInUse;
  });

  const grouped = {
    canopy: available.filter(e => e.type === 'canopy'),
    reserve: available.filter(e => e.type === 'reserve'),
    helmet: available.filter(e => e.type === 'helmet')
  };

  return {
    studentLevel,
    windSpeed,
    date,
    timeSlot,
    grouped,
    totalAvailable: available.length,
    hasAllRequired: REQUIRED_TYPES.every(type => grouped[type].length > 0)
  };
}

function checkEquipment(equipmentIds, studentLevel, windSpeed, date, timeSlot) {
  if (!equipmentIds || equipmentIds.length === 0) {
    return {
      success: false,
      error: '未选择装备',
      missingTypes: REQUIRED_TYPES,
      needsReview: false
    };
  }

  const selected = equipment.filter(eq => equipmentIds.includes(eq.id));
  
  if (selected.length !== equipmentIds.length) {
    return {
      success: false,
      error: '部分装备不存在',
      notFound: equipmentIds.filter(id => !selected.some(e => e.id === id)),
      needsReview: false
    };
  }

  const issues = [];
  const warnings = [];
  const selectedTypes = new Set(selected.map(e => e.type));
  
  const missingTypes = REQUIRED_TYPES.filter(type => !selectedTypes.has(type));
  if (missingTypes.length > 0) {
    issues.push(`缺少必备装备类型: ${missingTypes.join(', ')}`);
  }

  selected.forEach(eq => {
    if (eq.status !== EQUIPMENT_STATUS.AVAILABLE) {
      issues.push(`装备 ${eq.name} 状态为 ${eq.status}，不可使用`);
    }

    if (!eq.suitableLevels.includes(studentLevel)) {
      issues.push(`装备 ${eq.name} 不适合 ${studentLevel} 级别学员`);
    }

    if (windSpeed > eq.maxWindSpeed) {
      issues.push(`风速 ${windSpeed}m/s 超过装备 ${eq.name} 限制 ${eq.maxWindSpeed}m/s`);
    }

    const daysToNextCheck = dayjs(eq.nextCheckDate).diff(dayjs(), 'day');
    if (daysToNextCheck <= 0) {
      issues.push(`装备 ${eq.name} 已过检定期限`);
    } else if (daysToNextCheck <= 7) {
      warnings.push(`装备 ${eq.name} 将在 ${daysToNextCheck} 天后到期`);
    }

    const isInUse = flightRequests.some(fr =>
      fr.equipmentIds && fr.equipmentIds.includes(eq.id) &&
      fr.date === date && fr.timeSlot === timeSlot &&
      ['pending_approval', 'approved', 'in_progress'].includes(fr.status)
    );
    
    if (isInUse) {
      issues.push(`装备 ${eq.name} 该时段已被占用`);
    }
  });

  const canopyCount = selected.filter(e => e.type === 'canopy').length;
  const reserveCount = selected.filter(e => e.type === 'reserve').length;
  
  if (canopyCount > 1) {
    warnings.push('选择了多个主伞，请注意');
  }
  if (reserveCount > 1) {
    warnings.push('选择了多个备份伞，请注意');
  }

  if (issues.length > 0) {
    return {
      success: false,
      error: '装备检查未通过',
      issues,
      warnings,
      needsReview: issues.some(i => i.includes('已过检定期限'))
    };
  }

  return {
    success: true,
    equipment: selected,
    warnings,
    details: '装备检查通过'
  };
}

function checkEquipmentExpiration(equipmentId) {
  const eq = equipment.find(e => e.id === equipmentId);
  if (!eq) {
    return { success: false, error: '装备不存在' };
  }

  const daysToNextCheck = dayjs(eq.nextCheckDate).diff(dayjs(), 'day');
  
  if (daysToNextCheck <= 0) {
    return {
      success: false,
      isExpired: true,
      daysExpired: Math.abs(daysToNextCheck),
      error: '装备已过期'
    };
  }

  return {
    success: true,
    isExpired: false,
    daysRemaining: daysToNextCheck,
    details: daysToNextCheck <= 7 ? '即将到期' : '正常'
  };
}

function checkEquipmentSafety(equipmentIds) {
  const results = equipmentIds.map(id => {
    const eq = equipment.find(e => e.id === id);
    if (!eq) {
      return { equipmentId: id, status: 'not_found', risk: 'critical' };
    }

    const status = checkEquipmentExpiration(id);
    const risk = status.isExpired ? 'critical' :
                 status.daysRemaining <= 7 ? 'high' :
                 status.daysRemaining <= 30 ? 'medium' : 'low';

    return {
      equipmentId: id,
      name: eq.name,
      status: eq.status,
      lastCheckDate: eq.lastCheckDate,
      nextCheckDate: eq.nextCheckDate,
      daysRemaining: status.daysRemaining,
      risk
    };
  });

  const hasCritical = results.some(r => r.risk === 'critical');
  const hasHigh = results.some(r => r.risk === 'high');

  return {
    success: !hasCritical,
    overallRisk: hasCritical ? 'critical' : hasHigh ? 'high' : 'normal',
    results,
    needsReview: hasCritical || hasHigh
  };
}

module.exports = {
  getAvailableEquipment,
  checkEquipment,
  checkEquipmentExpiration,
  checkEquipmentSafety,
  REQUIRED_TYPES
};
