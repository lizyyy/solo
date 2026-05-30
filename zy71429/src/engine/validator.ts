import { Ship, Berth, Tug, Weather, Schedule, ScheduleValidationResult, GameState } from '../types/game';
import { isBetween, isOverlap, getOverlapPeriod, diffMinutes } from '../utils/time';

export const validateBerthCompatibility = (
  ship: Ship,
  berth: Berth
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (ship.length > berth.maxLength) {
    errors.push(`船舶长度(${ship.length}m)超过泊位最大长度(${berth.maxLength}m)`);
  }
  
  if (ship.draft > berth.maxDraft) {
    errors.push(`船舶吃水(${ship.draft}m)超过泊位最大吃水(${berth.maxDraft}m)`);
  }
  
  if (berth.status === 'maintenance') {
    errors.push(`泊位${berth.name}正在维护中`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateTugSufficiency = (
  ship: Ship,
  selectedTugs: Tug[]
): { valid: boolean; errors: string[]; totalPower: number } => {
  const errors: string[] = [];
  const totalPower = selectedTugs.reduce((sum, tug) => sum + tug.power, 0);
  
  if (totalPower < ship.tugRequired) {
    errors.push(`拖轮总功率(${totalPower}马力)不足，船舶需要${ship.tugRequired}马力`);
  }
  
  const lowFuelTugs = selectedTugs.filter(t => t.fuelLevel < 20);
  if (lowFuelTugs.length > 0) {
    errors.push(`以下拖轮燃油不足20%: ${lowFuelTugs.map(t => t.name).join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    totalPower,
  };
};

export const validateWeatherWindow = (
  plannedTime: Date,
  durationMinutes: number,
  weatherForecast: Weather[]
): { valid: boolean; errors: string[]; warnings: string[]; windowStart: Date; windowEnd: Date } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const windowStart = new Date(plannedTime);
  const windowEnd = new Date(plannedTime.getTime() + durationMinutes * 60000);
  
  const relevantWeather = weatherForecast.filter(w => 
    isBetween(w.timestamp, 
      new Date(windowStart.getTime() - 30 * 60000),
      new Date(windowEnd.getTime() + 30 * 60000)
    )
  );
  
  if (relevantWeather.length === 0) {
    errors.push('该时间段没有天气预报数据');
    return { valid: false, errors, warnings, windowStart, windowEnd };
  }
  
  const restrictedPeriods = relevantWeather.filter(w => w.windowType === 'restricted');
  if (restrictedPeriods.length > 0) {
    const times = restrictedPeriods.map(w => w.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    errors.push(`作业时段包含禁航窗口: ${times.join(', ')}`);
  }
  
  const warningPeriods = relevantWeather.filter(w => w.windowType === 'warning');
  if (warningPeriods.length > 0) {
    const times = warningPeriods.map(w => w.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    warnings.push(`作业时段包含警告窗口，风浪较大: ${times.join(', ')}`);
  }
  
  const maxWave = Math.max(...relevantWeather.map(w => w.waveHeight));
  const maxWind = Math.max(...relevantWeather.map(w => w.windLevel));
  
  if (maxWave >= 3.0) {
    warnings.push(`最大浪高${maxWave}m，接近作业限制`);
  }
  
  if (maxWind >= 6) {
    warnings.push(`最大风力${maxWind}级，请注意安全`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    windowStart,
    windowEnd,
  };
};

export const validateResourceAvailability = (
  berth: Berth,
  selectedTugs: Tug[],
  plannedTime: Date,
  durationMinutes: number,
  schedules: Schedule[],
  currentTime: Date
): ScheduleValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resourceConflicts: ScheduleValidationResult['resourceConflicts'] = [];
  const impactedSchedules: string[] = [];
  const windowIssues: ScheduleValidationResult['windowIssues'] = [];
  
  const lockStart = new Date(plannedTime);
  const lockEnd = new Date(plannedTime.getTime() + durationMinutes * 60000);
  
  if (plannedTime.getTime() < currentTime.getTime()) {
    errors.push('计划时间不能早于当前时间');
  }
  
  if (berth.occupiedUntil && berth.occupiedUntil.getTime() > lockStart.getTime()) {
    const conflict = getOverlapPeriod(lockStart, lockEnd, currentTime, berth.occupiedUntil);
    if (conflict) {
      errors.push(`泊位${berth.name}在该时段已被占用`);
      resourceConflicts.push({
        type: 'berth',
        resourceId: berth.id,
        conflictingScheduleId: 'current_occupation',
        timeOverlap: conflict,
      });
    }
  }
  
  const berthConflicts = schedules.filter(s => 
    s.status !== 'cancelled' && 
    s.berthId === berth.id &&
    isOverlap(lockStart, lockEnd, s.lockedResources.berth.start, s.lockedResources.berth.end)
  );
  
  berthConflicts.forEach(schedule => {
    const overlap = getOverlapPeriod(lockStart, lockEnd, schedule.lockedResources.berth.start, schedule.lockedResources.berth.end);
    if (overlap) {
      errors.push(`泊位${berth.name}与计划${schedule.id}时间冲突`);
      resourceConflicts.push({
        type: 'berth',
        resourceId: berth.id,
        conflictingScheduleId: schedule.id,
        timeOverlap: overlap,
      });
      if (!impactedSchedules.includes(schedule.id)) {
        impactedSchedules.push(schedule.id);
      }
    }
  });
  
  selectedTugs.forEach(tug => {
    if (tug.availableFrom.getTime() > lockStart.getTime()) {
      const waitMinutes = diffMinutes(tug.availableFrom, lockStart);
      warnings.push(`拖轮${tug.name}需要等待${waitMinutes}分钟后才可用`);
    }
    
    if (tug.status === 'refueling') {
      warnings.push(`拖轮${tug.name}正在加油中`);
    }
    
    const tugConflicts = schedules.filter(s => 
      s.status !== 'cancelled' &&
      s.tugIds.includes(tug.id) &&
      s.lockedResources.tugs.some(t => 
        isOverlap(lockStart, lockEnd, t.start, t.end)
      )
    );
    
    tugConflicts.forEach(schedule => {
      const tugLock = schedule.lockedResources.tugs.find(t => t.tugId === tug.id);
      if (tugLock) {
        const overlap = getOverlapPeriod(lockStart, lockEnd, tugLock.start, tugLock.end);
        if (overlap) {
          errors.push(`拖轮${tug.name}与计划${schedule.id}时间冲突`);
          resourceConflicts.push({
            type: 'tug',
            resourceId: tug.id,
            conflictingScheduleId: schedule.id,
            timeOverlap: overlap,
          });
          if (!impactedSchedules.includes(schedule.id)) {
            impactedSchedules.push(schedule.id);
          }
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    impactedSchedules,
    resourceConflicts,
    windowIssues,
  };
};

export const validateSchedule = (
  ship: Ship,
  berth: Berth,
  selectedTugs: Tug[],
  plannedTime: Date,
  durationMinutes: number,
  weatherForecast: Weather[],
  schedules: Schedule[],
  currentTime: Date
): ScheduleValidationResult => {
  const berthValidation = validateBerthCompatibility(ship, berth);
  const tugValidation = validateTugSufficiency(ship, selectedTugs);
  const weatherValidation = validateWeatherWindow(plannedTime, durationMinutes, weatherForecast);
  const resourceValidation = validateResourceAvailability(
    berth, selectedTugs, plannedTime, durationMinutes, schedules, currentTime
  );
  
  return {
    valid: berthValidation.valid && tugValidation.valid && weatherValidation.valid && resourceValidation.valid,
    errors: [
      ...berthValidation.errors,
      ...tugValidation.errors,
      ...weatherValidation.errors,
      ...resourceValidation.errors,
    ],
    warnings: [
      ...weatherValidation.warnings,
      ...resourceValidation.warnings,
    ],
    impactedSchedules: resourceValidation.impactedSchedules,
    resourceConflicts: resourceValidation.resourceConflicts,
    windowIssues: weatherValidation.errors.length > 0 ? [{
      type: 'outside_window',
      message: weatherValidation.errors[0],
    }] : [],
  };
};

export const checkMissedWindows = (
  schedules: Schedule[],
  currentTime: Date,
  weatherForecast: Weather[]
): Array<{ scheduleId: string; shipId: string; reason: string }> => {
  const missed: Array<{ scheduleId: string; shipId: string; reason: string }> = [];
  
  schedules.filter(s => s.status === 'planned').forEach(schedule => {
    const upcomingWeather = weatherForecast.find(w => 
      w.timestamp.getTime() >= schedule.windowStart.getTime() &&
      w.timestamp.getTime() <= schedule.windowEnd.getTime()
    );
    
    if (upcomingWeather && upcomingWeather.windowType === 'restricted') {
      missed.push({
        scheduleId: schedule.id,
        shipId: schedule.shipId,
        reason: `天气窗口已关闭，当前浪高${upcomingWeather.waveHeight}m，风力${upcomingWeather.windLevel}级`,
      });
      return;
    }
    
    if (currentTime.getTime() > schedule.windowEnd.getTime()) {
      missed.push({
        scheduleId: schedule.id,
        shipId: schedule.shipId,
        reason: `已超过靠泊窗口期，原计划${schedule.windowEnd.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}前完成`,
      });
    }
  });
  
  return missed;
};

export const checkTugConflicts = (
  newSchedule: Schedule,
  existingSchedules: Schedule[]
): Array<{ tugId: string; conflictingScheduleId: string }> => {
  const conflicts: Array<{ tugId: string; conflictingScheduleId: string }> = [];
  
  existingSchedules
    .filter(s => s.id !== newSchedule.id && s.status !== 'cancelled')
    .forEach(existing => {
      newSchedule.tugIds.forEach(tugId => {
        const existingTugLock = existing.lockedResources.tugs.find(t => t.tugId === tugId);
        const newTugLock = newSchedule.lockedResources.tugs.find(t => t.tugId === tugId);
        
        if (existingTugLock && newTugLock && 
            isOverlap(existingTugLock.start, existingTugLock.end, newTugLock.start, newTugLock.end)) {
          conflicts.push({
            tugId,
            conflictingScheduleId: existing.id,
          });
        }
      });
    });
  
  return conflicts;
};

export const validateGameState = (state: GameState): string[] => {
  const errors: string[] = [];
  
  if (state.ships.length === 0) {
    errors.push('没有船舶数据');
  }
  
  if (state.berths.length === 0) {
    errors.push('没有泊位数据');
  }
  
  if (state.tugs.length === 0) {
    errors.push('没有拖轮数据');
  }
  
  if (state.weatherForecast.length === 0) {
    errors.push('没有天气预报数据');
  }
  
  const shipIds = new Set(state.ships.map(s => s.id));
  const berthIds = new Set(state.berths.map(b => b.id));
  const tugIds = new Set(state.tugs.map(t => t.id));
  
  state.schedules.forEach((schedule, index) => {
    if (!shipIds.has(schedule.shipId)) {
      errors.push(`计划${index + 1}引用了不存在的船舶: ${schedule.shipId}`);
    }
    if (!berthIds.has(schedule.berthId)) {
      errors.push(`计划${index + 1}引用了不存在的泊位: ${schedule.berthId}`);
    }
    schedule.tugIds.forEach(tugId => {
      if (!tugIds.has(tugId)) {
        errors.push(`计划${index + 1}引用了不存在的拖轮: ${tugId}`);
      }
    });
  });
  
  return errors;
};
