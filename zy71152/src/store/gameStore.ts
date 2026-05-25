import { create } from 'zustand';
import {
  GameState,
  Train,
  Signal,
  Section,
  Level,
  SIGNAL_ASPECTS,
  TRAIN_STATUSES,
  GAME_STATUSES,
  CONFLICT_TYPES,
  Conflict,
  GameEvent,
  ReplayData,
  ReplayFrame
} from '../types/game';
import { levels } from '../data/levels';

interface GameStore extends GameState {
  loadLevel: (levelId: number) => void;
  toggleSignal: (signalId: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  setSpeedMultiplier: (speed: number) => void;
  update: (deltaTime: number) => void;
  saveReplay: () => void;
  loadReplay: (replay: ReplayData) => void;
  reset: () => void;
}

const initialState: GameState = {
  time: 0,
  score: 0,
  status: GAME_STATUSES.READY,
  trains: [],
  signals: [],
  sections: [],
  events: [],
  conflicts: [],
  level: null,
  speedMultiplier: 1
};

const getSectionOccupancy = (sectionId: string, trains: Train[]): Train[] => {
  return trains.filter(t => {
    if (t.status !== TRAIN_STATUSES.RUNNING && t.status !== TRAIN_STATUSES.STOPPED) return false;
    if (t.currentSectionIndex < 0) return false;
    return t.route[t.currentSectionIndex] === sectionId;
  });
};

const isInMaintenanceWindow = (section: Section, time: number): boolean => {
  return section.maintenance.some(w => time >= w.start && time <= w.end);
};

const canEnterSection = (
  train: Train,
  section: Section | undefined,
  signals: Signal[],
  time: number
): { allowed: boolean; reason?: string } => {
  if (!section) return { allowed: false, reason: '区间不存在' };

  if (isInMaintenanceWindow(section, time)) {
    return { allowed: false, reason: '区间处于检修窗口' };
  }

  const isReverse = train.direction === 'backward';
  const sectionSignal = signals.find(s => {
    if (s.sectionId !== section.id) return false;
    return isReverse ? s.direction === 'backward' : s.direction === 'forward';
  });

  if (sectionSignal?.aspect === SIGNAL_ASPECTS.RED) {
    return { allowed: false, reason: '信号机显示红灯' };
  }

  return { allowed: true };
};

const checkConflicts = (
  trains: Train[],
  sections: Section[],
  signals: Signal[],
  time: number
): Conflict | null => {
  for (const section of sections) {
    const occupyingTrains = getSectionOccupancy(section.id, trains);
    if (occupyingTrains.length > 1) {
      return {
        type: CONFLICT_TYPES.SECTION_OCCUPANCY,
        time,
        message: `区间 ${section.name} 冲突：${occupyingTrains.map(t => t.name).join(', ')} 同时占用`,
        trainIds: occupyingTrains.map(t => t.id)
      };
    }

    if (isInMaintenanceWindow(section, time) && occupyingTrains.length > 0) {
      const train = occupyingTrains[0];
      const isReverse = train.direction === 'backward';
      const nearEntry = isReverse ? train.progress > 0.85 : train.progress < 0.15;
      
      if (!nearEntry) {
        return {
          type: CONFLICT_TYPES.MAINTENANCE_CONFLICT,
          time,
          message: `区间 ${section.name} 处于检修窗口，列车 ${train.name} 违规进入`,
          trainIds: [train.id]
        };
      }
    }
  }

  for (const train of trains) {
    if (train.status !== TRAIN_STATUSES.RUNNING && train.status !== TRAIN_STATUSES.STOPPED) continue;
    if (train.currentSectionIndex < 0) continue;

    const currentSectionId = train.route[train.currentSectionIndex];
    const isReverse = train.direction === 'backward';
    const isEntering = isReverse ? train.progress > 0.85 : train.progress < 0.15;
    
    if (isEntering) {
      const sectionSignal = signals.find(s => {
        if (s.sectionId !== currentSectionId) return false;
        return isReverse ? s.direction === 'backward' : s.direction === 'forward';
      });

      const midProgress = isReverse ? train.progress < 0.7 : train.progress > 0.3;

      if (sectionSignal && sectionSignal.aspect === SIGNAL_ASPECTS.RED && midProgress) {
        return {
          type: CONFLICT_TYPES.SIGNAL_VIOLATION,
          time,
          message: `列车 ${train.name} 闯红灯进入区间`,
          trainIds: [train.id]
        };
      }

      if (sectionSignal && sectionSignal.aspect === SIGNAL_ASPECTS.YELLOW && train.speed > train.maxSpeed * 0.6) {
        return {
          type: CONFLICT_TYPES.OVERSPEED,
          time,
          message: `列车 ${train.name} 在黄灯信号下超速`,
          trainIds: [train.id]
        };
      }
    }
  }

  return null;
};

const calculateScore = (train: Train): number => {
  const arrivalDelay = Math.max(0, train.delay);
  if (arrivalDelay === 0) return 100;
  if (arrivalDelay < 50) return 50;
  if (arrivalDelay < 150) return 20;
  return 0;
};

let replayFrames: ReplayFrame[] = [];

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  loadLevel: (levelId: number) => {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    set({
      level,
      time: 0,
      score: 0,
      status: GAME_STATUSES.READY,
      trains: JSON.parse(JSON.stringify(level.trains)),
      signals: JSON.parse(JSON.stringify(level.signals)),
      sections: JSON.parse(JSON.stringify(level.sections)),
      events: [],
      conflicts: [],
      speedMultiplier: 1
    });
    replayFrames = [];
  },

  toggleSignal: (signalId: string) => {
    set(state => {
      const newSignals = state.signals.map(s => {
        if (s.id !== signalId) return s;
        const aspects = [SIGNAL_ASPECTS.RED, SIGNAL_ASPECTS.YELLOW, SIGNAL_ASPECTS.GREEN];
        const currentIndex = aspects.indexOf(s.aspect);
        const nextIndex = (currentIndex + 1) % aspects.length;
        return { ...s, aspect: aspects[nextIndex] };
      });

      const signal = state.signals.find(s => s.id === signalId);
      const newEvent: GameEvent = {
        time: state.time,
        type: 'signal_change',
        message: `信号机 ${signalId} 切换为 ${newSignals.find(s => s.id === signalId)?.aspect}`
      };

      return {
        signals: newSignals,
        events: [...state.events, newEvent]
      };
    });
  },

  startGame: () => {
    set({ status: GAME_STATUSES.RUNNING });
    replayFrames = [];
  },

  pauseGame: () => {
    set({ status: GAME_STATUSES.PAUSED });
  },

  resumeGame: () => {
    set({ status: GAME_STATUSES.RUNNING });
  },

  restartGame: () => {
    const state = get();
    if (state.level) {
      get().loadLevel(state.level.id);
    }
  },

  setSpeedMultiplier: (speed: number) => {
    set({ speedMultiplier: speed });
  },

  update: (deltaTime: number) => {
    const state = get();
    if (state.status !== GAME_STATUSES.RUNNING || !state.level) return;

    const newTime = state.time + deltaTime * state.speedMultiplier;
    let newScore = state.score;
    let newEvents = [...state.events];

    const newTrains = state.trains.map(train => {
      const newTrain = { ...train };

      if (newTrain.status === TRAIN_STATUSES.WAITING && newTime >= newTrain.scheduledDeparture) {
        const firstSectionId = newTrain.route[0];
        const firstSection = state.sections.find(s => s.id === firstSectionId);
        const checkResult = canEnterSection(newTrain, firstSection, state.signals, newTime);
        
        if (checkResult.allowed) {
          newTrain.status = TRAIN_STATUSES.RUNNING;
          newTrain.currentSectionIndex = 0;
          newTrain.progress = newTrain.direction === 'forward' ? 0 : 1;
          newEvents.push({
            time: newTime,
            type: 'train_depart',
            message: `列车 ${newTrain.name} 发车`
          });
        } else {
          newTrain.delay += deltaTime * state.speedMultiplier;
          if (!newEvents.some(e => e.type === 'delay_warning' && e.details?.trainId === newTrain.id)) {
            newEvents.push({
              time: newTime,
              type: 'delay_warning',
              message: `列车 ${newTrain.name} 发车延迟：${checkResult.reason}`,
              details: { trainId: newTrain.id }
            });
          }
        }
      }

      if (newTrain.status === TRAIN_STATUSES.RUNNING || newTrain.status === TRAIN_STATUSES.STOPPED) {
        const currentSectionId = newTrain.route[newTrain.currentSectionIndex];
        const section = state.sections.find(s => s.id === currentSectionId);
        if (!section) return newTrain;

        const isReverse = newTrain.direction === 'backward';
        
        const sectionSignal = state.signals.find(s => {
          if (s.sectionId !== currentSectionId) return false;
          return isReverse ? s.direction === 'backward' : s.direction === 'forward';
        });

        let effectiveSpeed = newTrain.maxSpeed;
        if (sectionSignal?.aspect === SIGNAL_ASPECTS.YELLOW) {
          effectiveSpeed = newTrain.maxSpeed * 0.5;
        }

        const nearEntry = isReverse ? newTrain.progress > 0.9 : newTrain.progress < 0.1;
        const stopThreshold = isReverse ? 0.15 : 0.85;
        const shouldStop = sectionSignal?.aspect === SIGNAL_ASPECTS.RED && 
          ((isReverse && newTrain.progress < stopThreshold) ||
          (!isReverse && newTrain.progress > stopThreshold));

        const inMaintenance = isInMaintenanceWindow(section, newTime);
        const shouldStopForMaintenance = inMaintenance && !nearEntry;

        if (shouldStop || shouldStopForMaintenance) {
          newTrain.status = TRAIN_STATUSES.STOPPED;
          newTrain.speed = 0;
          newTrain.delay += deltaTime * state.speedMultiplier;
          
          if (shouldStopForMaintenance && !newEvents.some(e => e.type === 'maintenance_stop' && e.details?.trainId === newTrain.id)) {
            newEvents.push({
              time: newTime,
              type: 'maintenance_stop',
              message: `列车 ${newTrain.name} 因检修停车`,
              details: { trainId: newTrain.id }
            });
          }
        } else {
          newTrain.status = TRAIN_STATUSES.RUNNING;
          newTrain.speed = effectiveSpeed;
          const moveDistance = (effectiveSpeed * deltaTime * state.speedMultiplier) / section.length;
          
          if (isReverse) {
            newTrain.progress -= moveDistance;
          } else {
            newTrain.progress += moveDistance;
          }

          const reachedEnd = isReverse ? newTrain.progress <= 0 : newTrain.progress >= 1;
          
          if (reachedEnd) {
            newTrain.currentSectionIndex++;
            
            if (newTrain.currentSectionIndex >= newTrain.route.length) {
              newTrain.status = TRAIN_STATUSES.COMPLETED;
              newTrain.progress = isReverse ? 0 : 1;
              const scoreEarned = calculateScore(newTrain);
              newScore += scoreEarned;
              newEvents.push({
                time: newTime,
                type: 'train_complete',
                message: `列车 ${newTrain.name} 到达，获得 ${scoreEarned} 分`
              });
            } else {
              const nextSectionId = newTrain.route[newTrain.currentSectionIndex];
              const nextSection = state.sections.find(s => s.id === nextSectionId);
              const nextCheck = canEnterSection(newTrain, nextSection, state.signals, newTime);
              
              if (nextCheck.allowed) {
                newTrain.progress = isReverse ? 1 : 0;
              } else {
                newTrain.currentSectionIndex--;
                newTrain.progress = isReverse ? 0 : 1;
                newTrain.status = TRAIN_STATUSES.STOPPED;
                newTrain.speed = 0;
                newTrain.delay += deltaTime * state.speedMultiplier;
                
                if (!newEvents.some(e => e.type === 'section_hold' && e.details?.trainId === newTrain.id)) {
                  newEvents.push({
                    time: newTime,
                    type: 'section_hold',
                    message: `列车 ${newTrain.name} 在区间外等待：${nextCheck.reason}`,
                    details: { trainId: newTrain.id }
                  });
                }
              }
            }
          }
        }

        if (newTrain.status === TRAIN_STATUSES.STOPPED) {
          newTrain.delay += deltaTime * state.speedMultiplier;
        }
      }

      return newTrain;
    });

    const conflict = checkConflicts(newTrains, state.sections, state.signals, newTime);
    
    if (conflict) {
      replayFrames.push({
        time: newTime,
        trains: JSON.parse(JSON.stringify(newTrains)),
        signals: JSON.parse(JSON.stringify(state.signals)),
        score: newScore
      });

      set({
        time: newTime,
        trains: newTrains,
        score: newScore - 200,
        status: GAME_STATUSES.LOST,
        conflicts: [...state.conflicts, conflict],
        events: [...newEvents, {
          time: newTime,
          type: 'conflict',
          message: conflict.message
        }]
      });
      return;
    }

    const allCompleted = newTrains.every(t => t.status === TRAIN_STATUSES.COMPLETED);
    
    if (allCompleted) {
      replayFrames.push({
        time: newTime,
        trains: JSON.parse(JSON.stringify(newTrains)),
        signals: JSON.parse(JSON.stringify(state.signals)),
        score: newScore
      });

      set({
        time: newTime,
        trains: newTrains,
        score: newScore,
        status: GAME_STATUSES.WON,
        events: [...newEvents, {
          time: newTime,
          type: 'game_complete',
          message: '所有列车完成运行！'
        }]
      });
      return;
    }

    if (newTime >= state.level.timeLimit) {
      replayFrames.push({
        time: newTime,
        trains: JSON.parse(JSON.stringify(newTrains)),
        signals: JSON.parse(JSON.stringify(state.signals)),
        score: newScore
      });

      set({
        time: newTime,
        trains: newTrains,
        score: newScore,
        status: GAME_STATUSES.LOST,
        conflicts: [...state.conflicts, {
          type: CONFLICT_TYPES.TIMEOUT,
          time: newTime,
          message: '超过时间限制',
          trainIds: []
        }],
        events: [...newEvents, {
          time: newTime,
          type: 'timeout',
          message: '超过时间限制'
        }]
      });
      return;
    }

    replayFrames.push({
      time: newTime,
      trains: JSON.parse(JSON.stringify(newTrains)),
      signals: JSON.parse(JSON.stringify(state.signals)),
      score: newScore
    });

    set({
      time: newTime,
      trains: newTrains,
      score: newScore,
      events: newEvents
    });
  },

  saveReplay: () => {
    const state = get();
    if (!state.level) return;

    const replay: ReplayData = {
      levelId: state.level.id,
      finalScore: state.score,
      result: state.status === GAME_STATUSES.WON ? 'won' : 'lost',
      frames: [...replayFrames],
      events: state.events,
      timestamp: Date.now()
    };

    const replays = JSON.parse(localStorage.getItem('railway_replays') || '[]');
    replays.push(replay);
    localStorage.setItem('railway_replays', JSON.stringify(replays.slice(-10)));
  },

  loadReplay: (replay: ReplayData) => {
    const level = levels.find(l => l.id === replay.levelId);
    if (!level) return;

    set({
      level,
      time: 0,
      score: 0,
      status: GAME_STATUSES.PAUSED,
      trains: JSON.parse(JSON.stringify(level.trains)),
      signals: JSON.parse(JSON.stringify(level.signals)),
      sections: JSON.parse(JSON.stringify(level.sections)),
      events: replay.events,
      conflicts: [],
      speedMultiplier: 1
    });
  },

  reset: () => {
    set(initialState);
    replayFrames = [];
  }
}));
