import {
  Ship,
  Berth,
  Tug,
  Schedule,
  Weather,
  GameEvent,
  GameState,
  EVENT_PRIORITY,
  ScheduleValidationResult,
} from '../types/game';
import { addMinutes, diffMinutes } from '../utils/time';
import { validateSchedule, checkMissedWindows } from './validator';
import {
  updateResourceStatusAfterSchedule,
  releaseResourcesAfterSchedule,
  generateResourceLockedEvent,
  generateFuelInsufficientEvent,
  checkFuelSufficiency,
} from './resource';
import { getCurrentWeather, generateWeatherChangedEvent } from './weather';
import { calculateScoreImpact } from '../utils/exporter';

const generateScheduleId = (): string => {
  return `SCH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
};

const generateEventId = (): string => {
  return `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateBerthingSuccessEvent = (
  schedule: Schedule,
  ship: Ship,
  timestamp: Date
): GameEvent => {
  return {
    id: generateEventId(),
    type: 'berthing_success',
    timestamp,
    scheduleId: schedule.id,
    shipId: ship.id,
    tugId: null,
    description: `${ship.name}成功靠泊，泊位: ${schedule.berthId}，用时: ${schedule.estimatedDuration}分钟`,
    rawData: {
      shipId: ship.id,
      shipName: ship.name,
      berthId: schedule.berthId,
      scheduleId: schedule.id,
      duration: schedule.estimatedDuration,
      shipSource: ship.source,
    },
    priority: EVENT_PRIORITY.berthing_success,
    resolved: true,
  };
};

export const generateWindowMissedEvent = (
  schedule: Schedule,
  ship: Ship,
  reason: string,
  timestamp: Date
): GameEvent => {
  return {
    id: generateEventId(),
    type: 'window_missed',
    timestamp,
    scheduleId: schedule.id,
    shipId: ship.id,
    tugId: null,
    description: `${ship.name}错过靠泊窗口: ${reason}`,
    rawData: {
      shipId: ship.id,
      shipName: ship.name,
      scheduleId: schedule.id,
      plannedTime: schedule.plannedTime,
      windowStart: schedule.windowStart,
      windowEnd: schedule.windowEnd,
      reason,
      shipSource: ship.source,
    },
    priority: EVENT_PRIORITY.window_missed,
    resolved: false,
  };
};

export const generateScheduleCreatedEvent = (
  schedule: Schedule,
  ship: Ship,
  timestamp: Date
): GameEvent => {
  return {
    id: generateEventId(),
    type: 'schedule_created',
    timestamp,
    scheduleId: schedule.id,
    shipId: ship.id,
    tugId: null,
    description: `已创建${ship.name}的靠泊计划，时间: ${schedule.plannedTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    rawData: {
      schedule,
      shipSource: ship.source,
    },
    priority: EVENT_PRIORITY.schedule_created,
    resolved: true,
  };
};

export const createSchedule = (
  ship: Ship,
  berth: Berth,
  selectedTugs: Tug[],
  plannedTime: Date,
  durationMinutes: number,
  windowStart: Date,
  windowEnd: Date,
  decisionNote: string = ''
): Schedule => {
  const now = new Date();
  
  return {
    id: generateScheduleId(),
    shipId: ship.id,
    berthId: berth.id,
    tugIds: selectedTugs.map(t => t.id),
    plannedTime: new Date(plannedTime),
    windowStart: new Date(windowStart),
    windowEnd: new Date(windowEnd),
    actualTime: null,
    estimatedDuration: durationMinutes,
    status: 'planned',
    decisionNote,
    createdAt: now,
    lockedResources: {
      berth: {
        start: new Date(plannedTime),
        end: addMinutes(plannedTime, durationMinutes),
      },
      tugs: selectedTugs.map(tug => ({
        tugId: tug.id,
        start: new Date(plannedTime),
        end: addMinutes(plannedTime, durationMinutes),
      })),
    },
  };
};

export const executeSchedule = (
  schedule: Schedule,
  state: GameState
): {
  newState: GameState;
  newEvents: GameEvent[];
} => {
  const newEvents: GameEvent[] = [];
  const ship = state.ships.find(s => s.id === schedule.shipId)!;
  const berth = state.berths.find(b => b.id === schedule.berthId)!;
  const tugs = state.tugs.filter(t => schedule.tugIds.includes(t.id));
  
  const fuelCheck = checkFuelSufficiency(tugs, schedule.estimatedDuration);
  if (!fuelCheck.sufficient) {
    fuelCheck.details.forEach(detail => {
      if (detail.currentFuel < detail.requiredFuel) {
        newEvents.push(
          generateFuelInsufficientEvent(
            detail.tugName,
            detail.currentFuel,
            detail.requiredFuel,
            state.currentTime,
            ship.id,
            schedule.id
          )
        );
      }
    });
  }
  
  const resourceUpdate = updateResourceStatusAfterSchedule(state.berths, state.tugs, schedule);
  
  newEvents.push(
    generateResourceLockedEvent(
      'berth',
      berth.name,
      schedule.id,
      schedule.lockedResources.berth.start,
      schedule.lockedResources.berth.end,
      state.currentTime
    )
  );
  
  tugs.forEach(tug => {
    const tugLock = schedule.lockedResources.tugs.find(tl => tl.tugId === tug.id)!;
    newEvents.push(
      generateResourceLockedEvent(
        'tug',
        tug.name,
        schedule.id,
        tugLock.start,
        tugLock.end,
        state.currentTime
      )
    );
  });
  
  newEvents.push(generateScheduleCreatedEvent(schedule, ship, state.currentTime));
  
  const updatedShips = state.ships.map(s =>
    s.id === ship.id ? { ...s, status: 'berthing' as const } : s
  );
  
  const updatedSchedule = { ...schedule, status: 'in_progress' as const, actualTime: new Date(state.currentTime) };
  const updatedSchedules = state.schedules.map(s =>
    s.id === schedule.id ? updatedSchedule : s
  );
  
  const scoreDelta = calculateScoreImpact('berthing_success', ship.priority);
  
  return {
    newState: {
      ...state,
      ships: updatedShips,
      berths: resourceUpdate.berths,
      tugs: resourceUpdate.tugs,
      schedules: updatedSchedules,
      events: [...state.events, ...newEvents],
      score: state.score + scoreDelta,
    },
    newEvents,
  };
};

export const completeSchedule = (
  schedule: Schedule,
  state: GameState
): {
  newState: GameState;
  newEvents: GameEvent[];
} => {
  const newEvents: GameEvent[] = [];
  const ship = state.ships.find(s => s.id === schedule.shipId)!;
  
  newEvents.push(generateBerthingSuccessEvent(schedule, ship, state.currentTime));
  
  const resourceUpdate = releaseResourcesAfterSchedule(state.berths, state.tugs, schedule);
  
  const updatedShips = state.ships.map(s =>
    s.id === ship.id ? { ...s, status: 'docked' as const } : s
  );
  
  const updatedSchedule = { ...schedule, status: 'completed' as const };
  const updatedSchedules = state.schedules.map(s =>
    s.id === schedule.id ? updatedSchedule : s
  );
  
  const scoreDelta = calculateScoreImpact('berthing_success', ship.priority);
  
  return {
    newState: {
      ...state,
      ships: updatedShips,
      berths: resourceUpdate.berths,
      tugs: resourceUpdate.tugs,
      schedules: updatedSchedules,
      events: [...state.events, ...newEvents],
      score: state.score + scoreDelta,
    },
    newEvents,
  };
};

export const failSchedule = (
  schedule: Schedule,
  state: GameState,
  reason: string
): {
  newState: GameState;
  newEvents: GameEvent[];
} => {
  const newEvents: GameEvent[] = [];
  const ship = state.ships.find(s => s.id === schedule.shipId)!;
  
  newEvents.push(generateWindowMissedEvent(schedule, ship, reason, state.currentTime));
  
  const resourceUpdate = releaseResourcesAfterSchedule(state.berths, state.tugs, schedule);
  
  const updatedShips = state.ships.map(s =>
    s.id === ship.id ? { ...s, status: 'missed' as const } : s
  );
  
  const updatedSchedule = { ...schedule, status: 'failed' as const };
  const updatedSchedules = state.schedules.map(s =>
    s.id === schedule.id ? updatedSchedule : s
  );
  
  const scoreDelta = calculateScoreImpact('window_missed', ship.priority);
  
  return {
    newState: {
      ...state,
      ships: updatedShips,
      berths: resourceUpdate.berths,
      tugs: resourceUpdate.tugs,
      schedules: updatedSchedules,
      events: [...state.events, ...newEvents],
      score: state.score + scoreDelta,
    },
    newEvents,
  };
};

export const cancelSchedule = (
  schedule: Schedule,
  state: GameState,
  reason: string
): {
  newState: GameState;
  newEvents: GameEvent[];
} => {
  const newEvents: GameEvent[] = [];
  
  const resourceUpdate = releaseResourcesAfterSchedule(state.berths, state.tugs, schedule);
  
  const ship = state.ships.find(s => s.id === schedule.shipId)!;
  const updatedShips = state.ships.map(s =>
    s.id === ship.id ? { ...s, status: 'waiting' as const } : s
  );
  
  const updatedSchedule = { ...schedule, status: 'cancelled' as const };
  const updatedSchedules = state.schedules.map(s =>
    s.id === schedule.id ? updatedSchedule : s
  );
  
  newEvents.push({
    id: generateEventId(),
    type: 'schedule_cancelled',
    timestamp: state.currentTime,
    scheduleId: schedule.id,
    shipId: ship.id,
    tugId: null,
    description: `${ship.name}的靠泊计划已取消: ${reason}`,
    rawData: {
      scheduleId: schedule.id,
      reason,
      shipSource: ship.source,
    },
    priority: EVENT_PRIORITY.schedule_cancelled,
    resolved: true,
  });
  
  return {
    newState: {
      ...state,
      ships: updatedShips,
      berths: resourceUpdate.berths,
      tugs: resourceUpdate.tugs,
      schedules: updatedSchedules,
      events: [...state.events, ...newEvents],
    },
    newEvents,
  };
};

export const advanceTime = (
  state: GameState,
  minutes: number
): {
  newState: GameState;
  newEvents: GameEvent[];
} => {
  const newEvents: GameEvent[] = [];
  const newTime = addMinutes(state.currentTime, minutes);
  
  const oldWeather = getCurrentWeather(state.weatherForecast, state.currentTime);
  const newWeather = getCurrentWeather(state.weatherForecast, newTime);
  
  if (newWeather) {
    const weatherEvent = generateWeatherChangedEvent(oldWeather, newWeather, newTime);
    if (weatherEvent) {
      newEvents.push(weatherEvent);
    }
  }
  
  const missedWindows = checkMissedWindows(state.schedules, newTime, state.weatherForecast);
  let currentState = { ...state, currentTime: newTime };
  
  missedWindows.forEach(missed => {
    const schedule = currentState.schedules.find(s => s.id === missed.scheduleId);
    if (schedule && schedule.status === 'planned') {
      const result = failSchedule(schedule, currentState, missed.reason);
      currentState = result.newState;
      newEvents.push(...result.newEvents);
    }
  });
  
  const inProgressSchedules = currentState.schedules.filter(
    s => s.status === 'in_progress' && s.actualTime
  );
  
  inProgressSchedules.forEach(schedule => {
    if (schedule.actualTime) {
      const elapsedMinutes = diffMinutes(newTime, schedule.actualTime);
      if (elapsedMinutes >= schedule.estimatedDuration) {
        const result = completeSchedule(schedule, currentState);
        currentState = result.newState;
        newEvents.push(...result.newEvents);
      }
    }
  });
  
  const updatedTugs = currentState.tugs.map(tug => {
    if (tug.status === 'refueling' && tug.availableFrom.getTime() <= newTime.getTime()) {
      return {
        ...tug,
        status: 'available' as const,
        fuelLevel: Math.min(tug.maxFuel, tug.fuelLevel + 50),
      };
    }
    return tug;
  });
  
  const updatedBerths = currentState.berths.map(berth => {
    if (berth.status === 'maintenance' && berth.occupiedUntil && berth.occupiedUntil.getTime() <= newTime.getTime()) {
      return {
        ...berth,
        status: 'available' as const,
        occupiedUntil: null,
      };
    }
    return berth;
  });
  
  const updatedShips = currentState.ships.map(ship => {
    if (ship.status === 'waiting' && ship.eta.getTime() <= newTime.getTime()) {
      return ship;
    }
    return ship;
  });
  
  const allShipsProcessed = currentState.ships.every(
    s => s.status === 'docked' || s.status === 'departed' || s.status === 'missed'
  );
  const timeExpired = newTime.getTime() >= state.endTime.getTime();
  
  if (allShipsProcessed || timeExpired) {
    newEvents.push({
      id: generateEventId(),
      type: 'game_end',
      timestamp: newTime,
      scheduleId: null,
      shipId: null,
      tugId: null,
      description: allShipsProcessed ? '所有船舶已处理完毕' : '游戏时间已结束',
      rawData: {
        reason: allShipsProcessed ? 'all_ships_processed' : 'time_expired',
        finalScore: currentState.score,
      },
      priority: EVENT_PRIORITY.game_end,
      resolved: true,
    });
    currentState = { ...currentState, isGameOver: true };
  }
  
  currentState = {
    ...currentState,
    tugs: updatedTugs,
    berths: updatedBerths,
    ships: updatedShips,
    events: [...currentState.events, ...newEvents],
  };
  
  return {
    newState: currentState,
    newEvents,
  };
};

export const validateAndCreateSchedule = (
  ship: Ship,
  berth: Berth,
  selectedTugs: Tug[],
  plannedTime: Date,
  durationMinutes: number,
  weatherForecast: Weather[],
  schedules: Schedule[],
  currentTime: Date,
  decisionNote: string
): {
  schedule: Schedule | null;
  validation: ScheduleValidationResult;
  events: GameEvent[];
} => {
  const events: GameEvent[] = [];
  
  const validation = validateSchedule(
    ship,
    berth,
    selectedTugs,
    plannedTime,
    durationMinutes,
    weatherForecast,
    schedules,
    currentTime
  );
  
  if (!validation.valid) {
    return { schedule: null, validation, events };
  }
  
  const lockStart = new Date(plannedTime);
  const lockEnd = addMinutes(plannedTime, durationMinutes);
  
  const schedule: Schedule = {
    id: generateScheduleId(),
    shipId: ship.id,
    berthId: berth.id,
    tugIds: selectedTugs.map(t => t.id),
    plannedTime: new Date(plannedTime),
    windowStart: new Date(lockStart),
    windowEnd: new Date(lockEnd),
    actualTime: null,
    estimatedDuration: durationMinutes,
    status: 'planned',
    decisionNote,
    createdAt: new Date(),
    lockedResources: {
      berth: {
        start: new Date(lockStart),
        end: new Date(lockEnd),
      },
      tugs: selectedTugs.map(tug => ({
        tugId: tug.id,
        start: new Date(lockStart),
        end: new Date(lockEnd),
      })),
    },
  };
  
  events.push(generateScheduleCreatedEvent(schedule, ship, currentTime));
  
  return { schedule, validation, events };
};
