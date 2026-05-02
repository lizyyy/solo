const moment = require('moment');

/**
 * 时间规则引擎
 * 处理时间重叠检查、夜间窗口、首班车时间等时间相关逻辑
 */

const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 检查两个时间段是否重叠
 * @param {Object} period1 - 第一个时间段 { start: string, end: string }
 * @param {Object} period2 - 第二个时间段 { start: string, end: string }
 * @returns {Object} { overlaps: boolean, overlap_minutes: number, overlap_start: string, overlap_end: string }
 */
function checkTimeOverlap(period1, period2) {
  const s1 = moment(period1.start);
  const e1 = moment(period1.end);
  const s2 = moment(period2.start);
  const e2 = moment(period2.end);
  
  // 验证时间有效性
  if (!s1.isValid() || !e1.isValid() || !s2.isValid() || !e2.isValid()) {
    throw new Error('无效的时间格式');
  }
  
  if (s1.isAfter(e1) || s2.isAfter(e2)) {
    throw new Error('开始时间不能晚于结束时间');
  }
  
  // 检查是否重叠
  // 不重叠的情况：period1 在 period2 之前，或 period1 在 period2 之后
  if (e1.isBefore(s2) || s1.isAfter(e2)) {
    return {
      overlaps: false,
      overlap_minutes: 0,
      overlap_start: null,
      overlap_end: null
    };
  }
  
  // 计算重叠部分
  const overlapStart = moment.max(s1, s2);
  const overlapEnd = moment.min(e1, e2);
  const overlapMinutes = overlapEnd.diff(overlapStart, 'minutes');
  
  return {
    overlaps: true,
    overlap_minutes: overlapMinutes,
    overlap_start: overlapStart.format(TIME_FORMAT),
    overlap_end: overlapEnd.format(TIME_FORMAT)
  };
}

/**
 * 检查多个时间段之间是否有重叠
 * @param {Array} periods - 时间段数组 [{ start: string, end: string, id: string }]
 * @returns {Array} 重叠对数组 [{ period1_id, period2_id, overlap_minutes, overlap_start, overlap_end }]
 */
function checkMultipleTimeOverlaps(periods) {
  const overlaps = [];
  
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const result = checkTimeOverlap(periods[i], periods[j]);
      if (result.overlaps) {
        overlaps.push({
          period1_id: periods[i].id || `period_${i}`,
          period2_id: periods[j].id || `period_${j}`,
          ...result
        });
      }
    }
  }
  
  return overlaps;
}

/**
 * 验证夜间施工窗口
 * 夜间窗口通常是指末班车后到首班车前的时间段
 * @param {Object} planTime - 计划时间 { start: string, end: string }
 * @param {Object} nightWindow - 夜间窗口配置 
 *   { 
 *     typical_start: string (如 '23:30'), 
 *     typical_end: string (如 '05:00'),
 *     first_train_time: string (如 '05:30')
 *   }
 * @returns {Object} { 
 *   is_valid: boolean, 
 *   warnings: Array,
 *   before_night_window: boolean,
 *   after_first_train: boolean,
 *   clearance_buffer_minutes: number
 * }
 */
function validateNightWindow(planTime, nightWindow = {}) {
  const warnings = [];
  
  const start = moment(planTime.start);
  const end = moment(planTime.end);
  
  // 默认夜间窗口配置
  const config = {
    typical_start: nightWindow.typical_start || '23:30',
    typical_end: nightWindow.typical_end || '05:00',
    first_train_time: nightWindow.first_train_time || '05:30',
    required_clearance_minutes: nightWindow.required_clearance_minutes || 30
  };
  
  // 解析首班车时间（假设是同一天或第二天凌晨）
  let firstTrainTime = moment(config.first_train_time, 'HH:mm');
  let nightEndTime = moment(config.typical_end, 'HH:mm');
  let nightStartTime = moment(config.typical_start, 'HH:mm');
  
  // 调整到正确的日期
  // 如果计划开始时间在凌晨（00:00-12:00），则夜间窗口可能是前一天开始的
  if (start.hour() < 12) {
    // 计划在凌晨，夜间开始时间应该是前一天
    nightStartTime = nightStartTime.subtract(1, 'day');
    nightEndTime = nightEndTime.add(1, 'day');
    firstTrainTime = firstTrainTime.add(1, 'day');
  } else {
    // 计划在夜间，夜间结束时间和首班车是第二天
    nightEndTime = nightEndTime.add(1, 'day');
    firstTrainTime = firstTrainTime.add(1, 'day');
  }
  
  // 检查开始时间是否在典型夜间窗口开始前
  const beforeNightWindow = start.isBefore(nightStartTime);
  if (beforeNightWindow) {
    const minutesBefore = nightStartTime.diff(start, 'minutes');
    warnings.push({
      type: 'early_start',
      message: `计划开始时间比典型夜间窗口早 ${minutesBefore} 分钟`,
      minutes_before: minutesBefore
    });
  }
  
  // 检查结束时间是否在首班车时间之后
  const afterFirstTrain = end.isAfter(firstTrainTime);
  if (afterFirstTrain) {
    const minutesAfter = end.diff(firstTrainTime, 'minutes');
    warnings.push({
      type: 'late_end',
      message: `计划结束时间压到首班车后 ${minutesAfter} 分钟，存在安全风险！`,
      minutes_after: minutesAfter,
      severity: 'critical'
    });
  }
  
  // 计算撤场缓冲时间（结束时间到首班车的时间差）
  const clearanceBufferMinutes = firstTrainTime.diff(end, 'minutes');
  
  // 检查缓冲时间是否足够
  if (clearanceBufferMinutes < config.required_clearance_minutes && !afterFirstTrain) {
    warnings.push({
      type: 'insufficient_buffer',
      message: `撤场缓冲时间不足（${clearanceBufferMinutes} 分钟），建议至少 ${config.required_clearance_minutes} 分钟`,
      current_buffer: clearanceBufferMinutes,
      required_buffer: config.required_clearance_minutes,
      severity: 'warning'
    });
  }
  
  return {
    is_valid: !afterFirstTrain && clearanceBufferMinutes >= 0,
    warnings,
    before_night_window: beforeNightWindow,
    after_first_train: afterFirstTrain,
    clearance_buffer_minutes: clearanceBufferMinutes,
    config_applied: config,
    first_train_time_actual: firstTrainTime.format(TIME_FORMAT),
    night_window_start: nightStartTime.format(TIME_FORMAT),
    night_window_end: nightEndTime.format(TIME_FORMAT)
  };
}

/**
 * 检查紧急插单的时间优先级
 * 紧急插单应该能够优先安排，但不能影响已批准的计划
 * @param {Object} emergencyPlan - 紧急插单计划
 * @param {Array} existingPlans - 现有已批准计划
 * @returns {Object} { can_insert: boolean, conflicts: Array, suggestions: Array }
 */
function checkEmergencyInsertion(emergencyPlan, existingPlans) {
  const conflicts = [];
  const suggestions = [];
  
  const emergencyPeriod = {
    start: emergencyPlan.start_time,
    end: emergencyPlan.end_time
  };
  
  // 检查与现有计划的时间冲突
  for (const plan of existingPlans) {
    // 只检查已批准或已提交的计划
    if (plan.status !== 'approved' && plan.status !== 'submitted') {
      continue;
    }
    
    const existingPeriod = {
      start: plan.start_time,
      end: plan.end_time
    };
    
    const overlap = checkTimeOverlap(emergencyPeriod, existingPeriod);
    
    if (overlap.overlaps) {
      // 检查区间是否重叠
      const emergencySections = JSON.parse(plan.section_ids || '[]');
      const existingSections = JSON.parse(plan.section_ids || '[]');
      
      const sectionOverlap = emergencySections.some(s => existingSections.includes(s));
      
      conflicts.push({
        plan_id: plan.id,
        plan_number: plan.plan_number,
        status: plan.status,
        time_overlap: overlap,
        section_overlap: sectionOverlap,
        is_critical: sectionOverlap // 同一区间重叠是严重冲突
      });
      
      if (sectionOverlap) {
        suggestions.push({
          type: 'adjust_time',
          message: `与计划 ${plan.plan_number} 在同一区间有时间重叠，建议调整紧急插单时间`,
          conflicting_plan: plan.plan_number
        });
      }
    }
  }
  
  // 紧急插单优先级：如果只是时间重叠但区间不同，可以标记为警告而非阻止
  const criticalConflicts = conflicts.filter(c => c.is_critical);
  const warningConflicts = conflicts.filter(c => !c.is_critical);
  
  return {
    can_insert: criticalConflicts.length === 0,
    critical_conflicts: criticalConflicts,
    warning_conflicts: warningConflicts,
    all_conflicts: conflicts,
    suggestions,
    emergency_priority_applied: emergencyPlan.is_emergency,
    priority_level: emergencyPlan.priority || 0
  };
}

/**
 * 计算施工持续时间（分钟）
 */
function calculateDuration(startTime, endTime) {
  const start = moment(startTime);
  const end = moment(endTime);
  return end.diff(start, 'minutes');
}

/**
 * 检查停送电前后置条件
 * 停电操作必须在施工开始前完成，送电操作必须在施工结束后
 * @param {Object} plan - 计划对象
 * @param {Object} options - 配置选项
 * @returns {Object} { is_valid: boolean, warnings: Array }
 */
function validatePowerSequence(plan, options = {}) {
  const warnings = [];
  const config = {
    power_off_buffer_minutes: options.power_off_buffer_minutes || 15,
    power_on_buffer_minutes: options.power_on_buffer_minutes || 10
  };
  
  if (!plan.power_off_required) {
    return {
      is_valid: true,
      warnings: [],
      message: '该计划不需要停电操作'
    };
  }
  
  const startTime = moment(plan.start_time);
  const endTime = moment(plan.end_time);
  
  // 假设停电操作时间点（需要提前完成）
  const latestPowerOffTime = startTime.clone().subtract(config.power_off_buffer_minutes, 'minutes');
  
  // 假设送电操作时间点（需要延后完成）
  const earliestPowerOnTime = endTime.clone().add(config.power_on_buffer_minutes, 'minutes');
  
  warnings.push({
    type: 'power_sequence_info',
    message: `停电操作需在 ${latestPowerOffTime.format('HH:mm')} 前完成`,
    latest_power_off_time: latestPowerOffTime.format(TIME_FORMAT)
  });
  
  warnings.push({
    type: 'power_sequence_info',
    message: `送电操作需在 ${earliestPowerOnTime.format('HH:mm')} 后开始`,
    earliest_power_on_time: earliestPowerOnTime.format(TIME_FORMAT)
  });
  
  // 检查接触网分区是否覆盖计划区间
  if (plan.catenary_zone_ids && plan.section_ids) {
    const catenaryZones = JSON.parse(plan.catenary_zone_ids || '[]');
    const sections = JSON.parse(plan.section_ids || '[]');
    
    if (catenaryZones.length === 0) {
      warnings.push({
        type: 'missing_catenary',
        message: '需要停电但未指定接触网分区',
        severity: 'critical'
      });
    }
  }
  
  return {
    is_valid: true, // 停送电时序是操作层面的检查，这里只做提示
    warnings,
    config_applied: config,
    power_requirements: {
      power_off_required: plan.power_off_required,
      latest_power_off: latestPowerOffTime.format(TIME_FORMAT),
      earliest_power_on: earliestPowerOnTime.format(TIME_FORMAT)
    }
  };
}

/**
 * 格式化时间为标准格式
 */
function formatTime(time) {
  return moment(time).format(TIME_FORMAT);
}

/**
 * 解析时间
 */
function parseTime(timeString) {
  return moment(timeString);
}

/**
 * 检查时间是否在夜间（23:00 - 06:00）
 */
function isNightTime(time) {
  const m = moment(time);
  const hour = m.hour();
  return hour >= 23 || hour < 6;
}

module.exports = {
  checkTimeOverlap,
  checkMultipleTimeOverlaps,
  validateNightWindow,
  checkEmergencyInsertion,
  calculateDuration,
  validatePowerSequence,
  formatTime,
  parseTime,
  isNightTime,
  TIME_FORMAT
};
