import { Ship, Berth, Tug, Schedule, Weather, DecisionImpact, GameEvent, EVENT_PRIORITY } from '../types/game';
import { addMinutes, diffMinutes, isOverlap } from '../utils/time';
import { findNextOperableWindow } from './weather';

export const getAvailableBerths = (
  berths: Berth[],
  ship: Ship,
  plannedTime: Date,
  durationMinutes: number
): Berth[] => {
  void durationMinutes;
  return berths.filter(berth => {
    if (ship.length > berth.maxLength || ship.draft > berth.maxDraft) {
      return false;
    }
    
    if (berth.status === 'maintenance' || berth.status === 'locked') {
      return false;
    }
    
    if (berth.occupiedUntil && berth.occupiedUntil.getTime() > plannedTime.getTime()) {
      return false;
    }
    
    return true;
  });
};

export const getAvailableTugs = (
  tugs: Tug[],
  plannedTime: Date,
  durationMinutes: number
): Tug[] => {
  const lockEnd = addMinutes(plannedTime, durationMinutes);
  
  return tugs.filter(tug => {
    if (tug.status === 'refueling' && tug.availableFrom.getTime() > plannedTime.getTime()) {
      return false;
    }
    
    if (tug.availableFrom.getTime() > lockEnd.getTime()) {
      return false;
    }
    
    if (tug.fuelLevel < 10) {
      return false;
    }
    
    return true;
  });
};

export const findOptimalTugCombination = (
  availableTugs: Tug[],
  requiredPower: number
): Tug[] | null => {
  const sorted = [...availableTugs].sort((a, b) => b.power - a.power);
  
  const selected: Tug[] = [];
  let totalPower = 0;
  
  for (const tug of sorted) {
    if (totalPower >= requiredPower) break;
    selected.push(tug);
    totalPower += tug.power;
  }
  
  if (totalPower >= requiredPower) {
    return selected;
  }
  
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const combo = [sorted[i], sorted[j]];
      const comboPower = combo.reduce((sum, t) => sum + t.power, 0);
      if (comboPower >= requiredPower) {
        return combo;
      }
    }
  }
  
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      for (let k = j + 1; k < sorted.length; k++) {
        const combo = [sorted[i], sorted[j], sorted[k]];
        const comboPower = combo.reduce((sum, t) => sum + t.power, 0);
        if (comboPower >= requiredPower) {
          return combo;
        }
      }
    }
  }
  
  return totalPower >= requiredPower ? selected : null;
};

export const generateResourceLockedEvent = (
  resourceType: 'berth' | 'tug',
  resourceName: string,
  scheduleId: string,
  startTime: Date,
  endTime: Date,
  timestamp: Date
): GameEvent => {
  return {
    id: `evt_lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'resource_locked',
    timestamp,
    scheduleId,
    shipId: null,
    tugId: resourceType === 'tug' ? resourceName : null,
    description: `${resourceType === 'berth' ? '泊位' : '拖轮'}${resourceName}已锁定，时间段: ${startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    rawData: {
      resourceType,
      resourceName,
      lockPeriod: { start: startTime, end: endTime },
    },
    priority: EVENT_PRIORITY.resource_locked,
    resolved: false,
  };
};

export const generateTugConflictEvent = (
  tugName: string,
  conflictingScheduleIds: string[],
  timestamp: Date,
  shipId?: string,
  scheduleId?: string
): GameEvent => {
  return {
    id: `evt_conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'tug_conflict',
    timestamp,
    scheduleId: scheduleId || null,
    shipId: shipId || null,
    tugId: tugName,
    description: `拖轮${tugName}资源冲突，涉及计划: ${conflictingScheduleIds.join(', ')}`,
    rawData: {
      tugName,
      conflictingScheduleIds,
    },
    priority: EVENT_PRIORITY.tug_conflict,
    resolved: false,
  };
};

export const generateFuelInsufficientEvent = (
  tugName: string,
  currentFuel: number,
  requiredFuel: number,
  timestamp: Date,
  shipId?: string,
  scheduleId?: string
): GameEvent => {
  return {
    id: `evt_fuel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'fuel_insufficient',
    timestamp,
    scheduleId: scheduleId || null,
    shipId: shipId || null,
    tugId: tugName,
    description: `拖轮${tugName}燃油不足，当前${currentFuel}%，作业需要${requiredFuel}%`,
    rawData: {
      tugName,
      currentFuel,
      requiredFuel,
    },
    priority: EVENT_PRIORITY.fuel_insufficient,
    resolved: false,
  };
};

export const calculateFuelConsumption = (
  tugs: Tug[],
  durationMinutes: number
): number => {
  const baseConsumption = 0.1;
  return tugs.reduce((total, tug) => {
    return total + (tug.power / 1000) * baseConsumption * (durationMinutes / 60);
  }, 0);
};

export const checkFuelSufficiency = (
  tugs: Tug[],
  durationMinutes: number
): { sufficient: boolean; details: Array<{ tugId: string; tugName: string; currentFuel: number; requiredFuel: number }> } => {
  const details: Array<{ tugId: string; tugName: string; currentFuel: number; requiredFuel: number }> = [];
  let sufficient = true;
  
  const fuelPerHour = 5;
  
  tugs.forEach(tug => {
    const requiredFuel = (durationMinutes / 60) * fuelPerHour;
    if (tug.fuelLevel < requiredFuel) {
      sufficient = false;
    }
    details.push({
      tugId: tug.id,
      tugName: tug.name,
      currentFuel: tug.fuelLevel,
      requiredFuel: Math.ceil(requiredFuel),
    });
  });
  
  return { sufficient, details };
};

export const updateResourceStatusAfterSchedule = (
  berths: Berth[],
  tugs: Tug[],
  schedule: Schedule
): { berths: Berth[]; tugs: Tug[] } => {
  const updatedBerths = berths.map(b => {
    if (b.id === schedule.berthId) {
      return {
        ...b,
        status: 'locked' as const,
        occupiedUntil: schedule.lockedResources.berth.end,
        currentShipId: schedule.shipId,
      };
    }
    return b;
  });
  
  const updatedTugs = tugs.map(t => {
    if (schedule.tugIds.includes(t.id)) {
      const tugLock = schedule.lockedResources.tugs.find(tl => tl.tugId === t.id);
      return {
        ...t,
        status: 'assigned' as const,
        availableFrom: tugLock ? tugLock.end : t.availableFrom,
        currentAssignment: schedule.id,
      };
    }
    return t;
  });
  
  return { berths: updatedBerths, tugs: updatedTugs };
};

export const releaseResourcesAfterSchedule = (
  berths: Berth[],
  tugs: Tug[],
  schedule: Schedule
): { berths: Berth[]; tugs: Tug[] } => {
  const updatedBerths = berths.map(b => {
    if (b.id === schedule.berthId && b.currentShipId === schedule.shipId) {
      return {
        ...b,
        status: 'available' as const,
        occupiedUntil: null,
        currentShipId: null,
      };
    }
    return b;
  });
  
  const updatedTugs = tugs.map(t => {
    if (schedule.tugIds.includes(t.id) && t.currentAssignment === schedule.id) {
      const fuelConsumption = calculateFuelConsumption([t], schedule.estimatedDuration);
      return {
        ...t,
        status: 'available' as const,
        fuelLevel: Math.max(0, t.fuelLevel - fuelConsumption),
        currentAssignment: null,
      };
    }
    return t;
  });
  
  return { berths: updatedBerths, tugs: updatedTugs };
};

export const calculateDecisionImpact = (
  ship: Ship,
  berth: Berth,
  selectedTugs: Tug[],
  plannedTime: Date,
  durationMinutes: number,
  schedules: Schedule[],
  weatherForecast: Weather[]
): DecisionImpact => {
  const lockEnd = addMinutes(plannedTime, durationMinutes);
  
  const affectedResources: DecisionImpact['affectedResources'] = [
    {
      type: 'berth',
      id: berth.id,
      lockPeriod: { start: plannedTime, end: lockEnd },
    },
    ...selectedTugs.map(tug => ({
      type: 'tug' as const,
      id: tug.id,
      lockPeriod: { start: plannedTime, end: lockEnd },
    })),
  ];
  
  const affectedShips = schedules
    .filter(s => s.status !== 'cancelled' && s.status !== 'completed')
    .filter(s => {
      if (s.berthId === berth.id && 
          isOverlap(plannedTime, lockEnd, s.lockedResources.berth.start, s.lockedResources.berth.end)) {
        return true;
      }
      return s.tugIds.some(tugId => 
        selectedTugs.some(st => st.id === tugId) &&
        s.lockedResources.tugs.some(tl => 
          tl.tugId === tugId && 
          isOverlap(plannedTime, lockEnd, tl.start, tl.end)
        )
      );
    })
    .map(s => s.shipId);
  
  const affectedShipsSet = new Set(affectedShips);
  const uniqueAffectedShips = Array.from(affectedShipsSet);
  
  let delayRisk = 0;
  if (plannedTime.getTime() > ship.eta.getTime() + 60 * 60000) {
    delayRisk += 30;
  }
  if (uniqueAffectedShips.length > 0) {
    delayRisk += uniqueAffectedShips.length * 20;
  }
  
  const nextWindow = findNextOperableWindow(weatherForecast, lockEnd, durationMinutes);
  let windowMissRisk = 0;
  if (!nextWindow) {
    windowMissRisk = 80;
  } else {
    const hoursUntilNext = diffMinutes(nextWindow.start, lockEnd) / 60;
    if (hoursUntilNext > 6) {
      windowMissRisk = 40;
    } else if (hoursUntilNext > 3) {
      windowMissRisk = 20;
    }
  }
  
  const fuelConsumption = calculateFuelConsumption(selectedTugs, durationMinutes);
  
  const priorityMultiplier = ship.priority === 'high' ? 2 : ship.priority === 'medium' ? 1.5 : 1;
  const baseScore = 100 * priorityMultiplier;
  const delayPenalty = delayRisk * 0.5;
  const windowPenalty = windowMissRisk * 0.5;
  const scoreImpact = baseScore - delayPenalty - windowPenalty;
  
  const alternativeOptions: DecisionImpact['alternativeOptions'] = [];
  
  if (uniqueAffectedShips.length > 0) {
    const altWindow = findNextOperableWindow(weatherForecast, addMinutes(lockEnd, 30), durationMinutes);
    if (altWindow) {
      alternativeOptions.push({
        description: `推迟到${altWindow.start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}开始，避免资源冲突`,
        scoreDelta: -10,
        riskLevel: 'low',
      });
    }
  }
  
  if (selectedTugs.length > 2) {
    const altTugs = findOptimalTugCombination(
      selectedTugs.slice(1),
      ship.tugRequired
    );
    if (altTugs && altTugs.length < selectedTugs.length) {
      alternativeOptions.push({
        description: `使用更少拖轮(${altTugs.map(t => t.name).join('、')})，节省资源`,
        scoreDelta: 5,
        riskLevel: 'medium',
      });
    }
  }
  
  if (ship.priority !== 'high' && uniqueAffectedShips.some(shipId => {
    const otherShip = schedules.find(s => s.shipId === shipId)?.shipId;
    return otherShip && otherShip !== ship.id;
  })) {
    alternativeOptions.push({
      description: `优先安排高优先级船舶，调整本船靠泊顺序`,
      scoreDelta: 20,
      riskLevel: 'low',
    });
  }
  
  return {
    affectedResources,
    affectedShips: uniqueAffectedShips,
    delayRisk: Math.min(100, delayRisk),
    windowMissRisk: Math.min(100, windowMissRisk),
    fuelConsumption: Math.round(fuelConsumption * 100) / 100,
    scoreImpact: Math.round(scoreImpact),
    alternativeOptions,
  };
};
