import { create } from 'zustand';
import type {
  GameState,
  GameActions,
  Elevator,
  ElevatorStatus,
  MaintenanceTeam,
  GameEvent,
  LevelConfig,
  FaultType,
  HistoryFrame,
  ScoreBreakdown,
  LoseReason,
  GameResult,
} from '@/types/game';
import { FAULT_RESCUE_TIMES } from '@/config/levels';

const generateId = () => Math.random().toString(36).substring(2, 9);

const FAULT_TYPES: FaultType[] = ['door_jam', 'power_out', 'overload', 'false_alarm', 'cable_issue'];

const createInitialState = (): Omit<GameState, keyof GameActions> => ({
  status: 'menu',
  currentLevel: null,
  elevators: [],
  teams: [],
  events: [],
  score: 0,
  gameTime: 0,
  result: null,
  loseReason: null,
  selectedTeamId: null,
  selectedElevatorId: null,
  history: [],
  replayIndex: 0,
  replaySpeed: 1,
  scoreBreakdown: null,
});

const initializeElevators = (level: LevelConfig): Elevator[] => {
  return Array.from({ length: level.elevatorCount }, (_, i) => ({
    id: `elevator-${i}`,
    name: `电梯 ${String.fromCharCode(65 + i)}`,
    currentFloor: Math.floor(Math.random() * level.floorCount),
    targetFloor: Math.floor(Math.random() * level.floorCount),
    status: 'normal' as const,
    faultType: null,
    passengerCount: Math.floor(Math.random() * (level.passengerRange[1] - level.passengerRange[0] + 1)) + level.passengerRange[0],
    assignedTeamId: null,
    waitTime: 0,
    mood: 'calm' as const,
    rescueProgress: 0,
    isMoving: Math.random() > 0.5,
  }));
};

const initializeTeams = (level: LevelConfig): MaintenanceTeam[] => {
  return Array.from({ length: level.teamCount }, (_, i) => ({
    id: `team-${i}`,
    name: `维保 ${i + 1} 队`,
    status: 'idle' as const,
    assignedElevatorId: null,
    progress: 0,
    currentFloor: 0,
    targetFloor: 0,
    isMoving: false,
  }));
};

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...createInitialState(),

  startGame: (level: LevelConfig) => {
    const elevators = initializeElevators(level);
    const teams = initializeTeams(level);
    const initialFrame: HistoryFrame = {
      timestamp: 0,
      elevators: JSON.parse(JSON.stringify(elevators)),
      teams: JSON.parse(JSON.stringify(teams)),
      score: 0,
      gameTime: 0,
    };

    set({
      status: 'playing',
      currentLevel: level,
      elevators,
      teams,
      events: [],
      score: 0,
      gameTime: 0,
      result: null,
      loseReason: null,
      selectedTeamId: null,
      selectedElevatorId: null,
      history: [initialFrame],
      replayIndex: 0,
      replaySpeed: 1,
      scoreBreakdown: null,
    });
  },

  pauseGame: () => {
    const { status } = get();
    if (status === 'playing') {
      set({ status: 'paused' });
    }
  },

  resumeGame: () => {
    const { status } = get();
    if (status === 'paused') {
      set({ status: 'playing' });
    }
  },

  restartGame: () => {
    const { currentLevel } = get();
    if (currentLevel) {
      get().startGame(currentLevel);
    }
  },

  endGame: (result: GameResult, reason: LoseReason) => {
    const state = get();
    const scoreBreakdown = calculateScoreBreakdown(state);

    set({
      status: 'ended',
      result,
      loseReason: reason,
      scoreBreakdown,
    });
  },

  selectTeam: (teamId: string | null) => {
    set({ selectedTeamId: teamId });
  },

  selectElevator: (elevatorId: string | null) => {
    const { selectedTeamId, assignTeam } = get();
    if (selectedTeamId && elevatorId) {
      assignTeam(selectedTeamId, elevatorId);
      set({ selectedTeamId: null, selectedElevatorId: null });
    } else {
      set({ selectedElevatorId: elevatorId });
    }
  },

  assignTeam: (teamId: string, elevatorId: string) => {
    const state = get();
    const team = state.teams.find((t) => t.id === teamId);
    const elevator = state.elevators.find((e) => e.id === elevatorId);

    if (!team || !elevator) return;
    if (team.status !== 'idle') return;
    if (elevator.status !== 'fault') return;

    let conflict = false;
    const updatedTeams = state.teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          status: 'moving' as const,
          assignedElevatorId: elevatorId,
          progress: 0,
          targetFloor: elevator.currentFloor,
          isMoving: true,
        };
      }
      if (t.assignedElevatorId === elevatorId && t.status !== 'idle') {
        conflict = true;
        return {
          ...t,
          status: 'conflict' as const,
        };
      }
      return t;
    });

    const updatedElevators = state.elevators.map((e) => {
      if (e.id === elevatorId) {
        return {
          ...e,
          assignedTeamId: teamId,
          status: 'rescuing' as const,
          rescueProgress: 0,
        };
      }
      return e;
    });

    const newEvents = [...state.events];

    if (conflict) {
      newEvents.push({
        id: generateId(),
        time: state.gameTime,
        type: 'conflict',
        message: `维保队冲突！多部维保队同时前往 ${elevator.name}`,
        elevatorId,
        teamId,
      });
    }

    newEvents.push({
      id: generateId(),
      time: state.gameTime,
      type: 'rescue_start',
      message: `${team.name} 已派往 ${elevator.name} (${elevator.currentFloor}层)`,
      elevatorId,
      teamId,
    });

    set({
      teams: updatedTeams,
      elevators: updatedElevators,
      events: newEvents,
      score: conflict ? state.score - (state.currentLevel?.conflictPenalty || 0) : state.score,
    });
  },

  cancelTeamAssignment: (teamId: string) => {
    const state = get();
    const team = state.teams.find((t) => t.id === teamId);
    if (!team || team.status === 'idle') return;

    const updatedTeams = state.teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          status: 'idle' as const,
          assignedElevatorId: null,
          progress: 0,
          isMoving: false,
          targetFloor: t.currentFloor,
        };
      }
      return t;
    });

    const updatedElevators = state.elevators.map((e) => {
      if (e.id === team.assignedElevatorId) {
        const hasOtherTeam = updatedTeams.some((t) => t.assignedElevatorId === e.id && t.status !== 'idle');
        const newStatus = hasOtherTeam ? 'rescuing' : 'fault';
        return {
          ...e,
          assignedTeamId: hasOtherTeam ? e.assignedTeamId : null,
          status: newStatus as ElevatorStatus,
          rescueProgress: 0,
        };
      }
      return e;
    });

    set({
      teams: updatedTeams,
      elevators: updatedElevators,
    });
  },

  tick: (deltaTime: number) => {
    const state = get();
    if (state.status !== 'playing' || !state.currentLevel) return;

    const level = state.currentLevel;
    const newGameTime = state.gameTime + deltaTime;

    let newScore = state.score;
    let newElevators = [...state.elevators];
    let newTeams = [...state.teams];
    const newEvents = [...state.events];
    let newResult: GameResult = null;
    let newLoseReason: LoseReason = null;

    const movingSpeed = 2;

    newTeams = newTeams.map((team) => {
      if (team.status === 'moving' && team.isMoving) {
        const floorDiff = team.targetFloor - team.currentFloor;
        const moveAmount = movingSpeed * deltaTime;
        let newFloor = team.currentFloor;

        if (Math.abs(floorDiff) <= moveAmount) {
          newFloor = team.targetFloor;
          return {
            ...team,
            currentFloor: newFloor,
            status: 'working' as const,
            isMoving: false,
            progress: 0,
          };
        } else {
          newFloor = team.currentFloor + (floorDiff > 0 ? moveAmount : -moveAmount);
          return {
            ...team,
            currentFloor: newFloor,
          };
        }
      }
      return team;
    });

    newElevators = newElevators.map((elevator) => {
      if (elevator.status === 'rescuing' || elevator.status === 'fault') {
        const workingTeam = newTeams.find(
          (t) => t.assignedElevatorId === elevator.id && t.status === 'working'
        );

        if (workingTeam && elevator.status === 'rescuing') {
          const faultType = elevator.faultType || 'door_jam';
          const rescueTime = FAULT_RESCUE_TIMES[faultType];
          const newProgress = elevator.rescueProgress + deltaTime;

          if (newProgress >= rescueTime) {
            if (elevator.faultType === 'false_alarm') {
              newScore -= 50;
              newEvents.push({
                id: generateId(),
                time: newGameTime,
                type: 'info',
                message: `${elevator.name} 为误报，扣分处理`,
                elevatorId: elevator.id,
                teamId: workingTeam.id,
              });
            } else {
              newScore += level.rescueBonus;
              newEvents.push({
                id: generateId(),
                time: newGameTime,
                type: 'rescue_complete',
                message: `${elevator.name} 救援完成！${elevator.passengerCount} 名乘客获救`,
                elevatorId: elevator.id,
                teamId: workingTeam.id,
              });
            }

            newTeams = newTeams.map((t) => {
              if (t.id === workingTeam.id) {
                return {
                  ...t,
                  status: 'idle' as const,
                  assignedElevatorId: null,
                  progress: 0,
                };
              }
              if (t.assignedElevatorId === elevator.id && t.status === 'conflict') {
                return {
                  ...t,
                  status: 'idle' as const,
                  assignedElevatorId: null,
                  progress: 0,
                };
              }
              return t;
            });

            return {
              ...elevator,
              status: 'rescued' as const,
              assignedTeamId: null,
              rescueProgress: 0,
              mood: 'calm' as const,
              waitTime: 0,
            };
          }

          return {
            ...elevator,
            rescueProgress: newProgress,
          };
        }

        const newWaitTime = elevator.waitTime + deltaTime;
        let newMood = elevator.mood;

        if (newWaitTime > 30 && elevator.mood === 'calm') {
          newMood = 'anxious';
          newEvents.push({
            id: generateId(),
            time: newGameTime,
            type: 'mood_change',
            message: `${elevator.name} 乘客情绪变为焦虑`,
            elevatorId: elevator.id,
          });
        } else if (newWaitTime > 60 && elevator.mood === 'anxious') {
          newMood = 'panic';
          newScore -= level.panicPenalty;
          newEvents.push({
            id: generateId(),
            time: newGameTime,
            type: 'mood_change',
            message: `${elevator.name} 乘客情绪恐慌！扣分 ${level.panicPenalty}`,
            elevatorId: elevator.id,
          });
        } else if (newWaitTime > 90) {
          newResult = 'lose';
          newLoseReason = 'passenger_panic';
          newEvents.push({
            id: generateId(),
            time: newGameTime,
            type: 'timeout',
            message: `${elevator.name} 乘客等待超时，救援失败`,
            elevatorId: elevator.id,
          });
        }

        return {
          ...elevator,
          waitTime: newWaitTime,
          mood: newMood,
        };
      }

      if (elevator.status === 'normal' && elevator.isMoving) {
        const floorDiff = elevator.targetFloor - elevator.currentFloor;
        const moveAmount = movingSpeed * deltaTime;
        if (Math.abs(floorDiff) <= moveAmount) {
          return {
            ...elevator,
            currentFloor: elevator.targetFloor,
            isMoving: false,
            targetFloor: Math.floor(Math.random() * level.floorCount),
          };
        } else {
          return {
            ...elevator,
            currentFloor: elevator.currentFloor + (floorDiff > 0 ? moveAmount : -moveAmount),
          };
        }
      }

      if (elevator.status === 'normal' && !elevator.isMoving && Math.random() < 0.02) {
        return {
          ...elevator,
          isMoving: true,
        };
      }

      if (elevator.status === 'rescued' && Math.random() < 0.01) {
        return {
          ...elevator,
          status: 'normal' as const,
          faultType: null,
          passengerCount: Math.floor(Math.random() * (level.passengerRange[1] - level.passengerRange[0] + 1)) + level.passengerRange[0],
          isMoving: true,
        };
      }

      return elevator;
    });

    const faultCount = newElevators.filter((e) => e.status === 'fault' || e.status === 'rescuing').length;
    const lastFaultTime = newEvents
      .filter((e) => e.type === 'fault')
      .slice(-1)[0]?.time ?? 0;

    if (
      faultCount < level.maxConcurrentFaults &&
      newGameTime - lastFaultTime > level.faultInterval[0] &&
      Math.random() < (deltaTime / level.faultInterval[1])
    ) {
      const normalElevators = newElevators.filter((e) => e.status === 'normal');
      if (normalElevators.length > 0) {
        const targetElevator = normalElevators[Math.floor(Math.random() * normalElevators.length)];
        const faultType = FAULT_TYPES[Math.floor(Math.random() * FAULT_TYPES.length)];

        newElevators = newElevators.map((e) => {
          if (e.id === targetElevator.id) {
            return {
              ...e,
              status: 'fault' as const,
              faultType,
              isMoving: false,
              waitTime: 0,
              mood: 'calm' as const,
            };
          }
          return e;
        });

        newEvents.push({
          id: generateId(),
          time: newGameTime,
          type: 'fault',
          message: `${targetElevator.name} 在 ${Math.floor(targetElevator.currentFloor)} 层发生故障！`,
          elevatorId: targetElevator.id,
        });
      }
    }

    if (newGameTime >= level.gameDuration && !newResult) {
      if (level.winCondition === 'all_rescued') {
        const hasActiveFaults = newElevators.some((e) => e.status === 'fault' || e.status === 'rescuing');
        newResult = hasActiveFaults ? 'lose' : 'win';
        newLoseReason = hasActiveFaults ? 'timeout' : null;
      } else {
        newResult = newScore >= (level.winScore || 0) ? 'win' : 'lose';
        newLoseReason = newResult === 'win' ? null : 'timeout';
      }
    }

    const historyFrame: HistoryFrame = {
      timestamp: Date.now(),
      elevators: JSON.parse(JSON.stringify(newElevators)),
      teams: JSON.parse(JSON.stringify(newTeams)),
      score: newScore,
      gameTime: newGameTime,
    };

    if (newResult) {
      const scoreBreakdown = calculateScoreBreakdown({
        ...state,
        elevators: newElevators,
        teams: newTeams,
        events: newEvents,
        score: newScore,
        currentLevel: level,
      });

      set({
        elevators: newElevators,
        teams: newTeams,
        events: newEvents,
        score: newScore,
        gameTime: newGameTime,
        status: 'ended',
        result: newResult,
        loseReason: newLoseReason,
        history: [...state.history, historyFrame],
        scoreBreakdown,
      });
    } else {
      set({
        elevators: newElevators,
        teams: newTeams,
        events: newEvents,
        score: newScore,
        gameTime: newGameTime,
        history: [...state.history, historyFrame],
      });
    }
  },

  goToMenu: () => {
    set(createInitialState());
  },

  startReplay: () => {
    set({ status: 'replaying', replayIndex: 0 });
  },

  stopReplay: () => {
    set({ status: 'ended', replayIndex: 0 });
  },

  setReplayIndex: (index: number) => {
    const { history } = get();
    const clampedIndex = Math.max(0, Math.min(index, history.length - 1));
    set({ replayIndex: clampedIndex });
  },

  setReplaySpeed: (speed: number) => {
    set({ replaySpeed: speed });
  },

  exportReport: () => {
    const state = get();
    const report = {
      gameInfo: {
        levelName: state.currentLevel?.name,
        difficulty: state.currentLevel?.difficulty,
        gameDuration: state.currentLevel?.gameDuration,
        actualPlayTime: state.gameTime,
      },
      result: {
        outcome: state.result,
        loseReason: state.loseReason,
      },
      score: state.scoreBreakdown,
      statistics: {
        totalElevators: state.elevators.length,
        totalTeams: state.teams.length,
        totalRescues: state.events.filter((e) => e.type === 'rescue_complete').length,
        totalFaults: state.events.filter((e) => e.type === 'fault').length,
        totalConflicts: state.events.filter((e) => e.type === 'conflict').length,
        totalMoodChanges: state.events.filter((e) => e.type === 'mood_change').length,
      },
      eventLog: state.events,
      exportTime: new Date().toISOString(),
    };
    return JSON.stringify(report, null, 2);
  },

  loadHistory: (history: HistoryFrame[]) => {
    set({
      history,
      replayIndex: 0,
      status: 'replaying',
      elevators: history[0]?.elevators || [],
      teams: history[0]?.teams || [],
      score: history[0]?.score || 0,
      gameTime: history[0]?.gameTime || 0,
    });
  },
}));

function calculateScoreBreakdown(state: GameState): ScoreBreakdown {
  const level = state.currentLevel;
  if (!level) {
    return {
      totalRescues: 0,
      totalRescuePoints: 0,
      totalConflicts: 0,
      totalConflictPenalty: 0,
      totalPanics: 0,
      totalPanicPenalty: 0,
      totalTimeouts: 0,
      totalTimeoutPenalty: 0,
      finalScore: state.score,
    };
  }

  const totalRescues = state.events.filter((e) => e.type === 'rescue_complete').length;
  const totalConflicts = state.events.filter((e) => e.type === 'conflict').length;
  const totalPanics = state.events.filter((e) => e.type === 'mood_change' && e.message.includes('恐慌')).length;
  const totalTimeouts = state.events.filter((e) => e.type === 'timeout').length;
  const falseAlarms = state.events.filter((e) => e.type === 'info' && e.message.includes('误报')).length;

  return {
    totalRescues,
    totalRescuePoints: (totalRescues - falseAlarms) * level.rescueBonus,
    totalConflicts,
    totalConflictPenalty: totalConflicts * level.conflictPenalty,
    totalPanics,
    totalPanicPenalty: totalPanics * level.panicPenalty,
    totalTimeouts,
    totalTimeoutPenalty: totalTimeouts * 200,
    finalScore: state.score,
  };
}
