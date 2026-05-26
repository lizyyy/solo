import { create } from 'zustand';
import {
  GameState,
  Vehicle,
  StreetLamp,
  ActionRecord,
  ScoreBreakdown,
  HistoryRecord,
} from '@/types/game';
import { generateMap, getTotalSpareParts } from '@/utils/mapGenerator';
import { findPath } from '@/utils/pathfinding';
import {
  getInitialScoreBreakdown,
  calculateTotalScore,
  calculateRepairScore,
  getGrade,
  getFailureReason,
  createActionRecord,
} from '@/utils/scoring';
import { saveHistory, generateHistoryId } from '@/utils/history';

function createInitialState(level: number = 1): Partial<GameState> {
  const map = generateMap(level);
  const sparePartsTotal = Math.ceil(getTotalSpareParts(map.lamps) * 1.2);

  return {
    level,
    score: 0,
    timeRemaining: 180 + level * 30,
    gameSpeed: 1,
    isPaused: false,
    vehicles: map.vehicles,
    lamps: map.lamps,
    nodes: map.nodes,
    edges: map.edges,
    depotNodeId: map.depotNodeId,
    spareParts: {
      total: sparePartsTotal,
      used: 0,
      wasted: 0,
    },
    scoreBreakdown: getInitialScoreBreakdown(),
    actions: [],
    selectedVehicleId: null,
    selectedLampId: null,
    hoveredLampId: null,
    gameStartTime: Date.now(),
    failureReason: null,
  };
}

interface GameStore extends GameState {
  startGame: (level: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  setGameSpeed: (speed: number) => void;
  selectVehicle: (vehicleId: string | null) => void;
  selectLamp: (lampId: string | null) => void;
  setHoveredLamp: (lampId: string | null) => void;
  dispatchVehicle: (vehicleId: string, lampId: string) => void;
  cancelVehicleTask: (vehicleId: string) => void;
  tick: (deltaTime: number) => void;
  endGame: () => void;
  exportReport: () => object;
}

export const useGameStore = create<GameStore>((set, get) => ({
  id: '',
  status: 'menu',
  level: 1,
  score: 0,
  timeRemaining: 180,
  gameSpeed: 1,
  isPaused: false,
  vehicles: [],
  lamps: [],
  nodes: [],
  edges: [],
  depotNodeId: '',
  spareParts: { total: 0, used: 0, wasted: 0 },
  scoreBreakdown: getInitialScoreBreakdown(),
  actions: [],
  selectedVehicleId: null,
  selectedLampId: null,
  hoveredLampId: null,
  gameStartTime: Date.now(),
  failureReason: null,

  startGame: (level: number) => {
    const initState = createInitialState(level);
    set({
      ...initState,
      status: 'playing',
      id: generateHistoryId(),
      gameStartTime: Date.now(),
    } as Partial<GameStore>);
  },

  pauseGame: () => {
    if (get().status === 'playing') {
      set({ isPaused: true, status: 'paused' });
    }
  },

  resumeGame: () => {
    if (get().status === 'paused') {
      set({ isPaused: false, status: 'playing' });
    }
  },

  resetGame: () => {
    set({ status: 'menu', score: 0, actions: [] });
  },

  setGameSpeed: (speed: number) => {
    set({ gameSpeed: speed });
  },

  selectVehicle: (vehicleId: string | null) => {
    set({ selectedVehicleId: vehicleId });
  },

  selectLamp: (lampId: string | null) => {
    set({ selectedLampId: lampId });
  },

  setHoveredLamp: (lampId: string | null) => {
    set({ hoveredLampId: lampId });
  },

  dispatchVehicle: (vehicleId: string, lampId: string) => {
    const state = get();
    const vehicle = state.vehicles.find((v) => v.id === vehicleId);
    const lamp = state.lamps.find((l) => l.id === lampId);

    if (!vehicle || !lamp) return;
    if (vehicle.status !== 'idle') return;
    if (lamp.status !== 'broken') return;

    if (vehicle.spareParts < lamp.repairCost) {
      const newActions = [
        ...state.actions,
        createActionRecord(
          'waste',
          `派遣${vehicle.name}维修${lampId}失败：备件不足`,
          -30,
          state.timeRemaining,
          vehicleId,
          lampId
        ),
      ];
      const newBreakdown = {
        ...state.scoreBreakdown,
        errorPenalty: state.scoreBreakdown.errorPenalty + 30,
      };
      set({
        actions: newActions,
        scoreBreakdown: newBreakdown,
        score: calculateTotalScore(newBreakdown),
      });
      return;
    }

    const pathResult = findPath(state.nodes, state.edges, vehicle.currentNodeId, lamp.nodeId);
    if (!pathResult) return;

    const newVehicles = state.vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            status: 'moving' as const,
            targetNodeId: lamp.nodeId,
            targetLampId: lampId,
            path: pathResult.path,
            pathIndex: 0,
            progress: 0,
          }
        : v
    );

    const newLamps = state.lamps.map((l) =>
      l.id === lampId
        ? { ...l, status: 'assigned' as const, assignedVehicleId: vehicleId }
        : l
    );

    const newActions = [
      ...state.actions,
      createActionRecord(
        'dispatch',
        `派遣${vehicle.name}前往维修${lampId}`,
        0,
        state.timeRemaining,
        vehicleId,
        lampId
      ),
    ];

    set({
      vehicles: newVehicles,
      lamps: newLamps,
      actions: newActions,
    });
  },

  cancelVehicleTask: (vehicleId: string) => {
    const state = get();
    const vehicle = state.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || vehicle.status === 'idle') return;

    const targetLamp = vehicle.targetLampId
      ? state.lamps.find((l) => l.id === vehicle.targetLampId)
      : null;

    const newVehicles = state.vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            status: 'idle' as const,
            targetNodeId: null,
            targetLampId: null,
            path: [],
            pathIndex: 0,
            progress: 0,
            repairProgress: 0,
          }
        : v
    );

    const newLamps = targetLamp
      ? state.lamps.map((l) =>
          l.id === targetLamp.id
            ? { ...l, status: 'broken' as const, assignedVehicleId: null }
            : l
        )
      : state.lamps;

    const newActions = [
      ...state.actions,
      createActionRecord(
        'cancel',
        `取消${vehicle.name}的维修任务`,
        -15,
        state.timeRemaining,
        vehicleId,
        targetLamp?.id
      ),
    ];

    const newBreakdown = {
      ...state.scoreBreakdown,
      errorPenalty: state.scoreBreakdown.errorPenalty + 15,
    };

    set({
      vehicles: newVehicles,
      lamps: newLamps,
      actions: newActions,
      scoreBreakdown: newBreakdown,
      score: calculateTotalScore(newBreakdown),
    });
  },

  tick: (deltaTime: number) => {
    const state = get();
    if (state.status !== 'playing' || state.isPaused) return;

    const scaledDelta = deltaTime * state.gameSpeed;
    let newTimeRemaining = Math.max(0, state.timeRemaining - scaledDelta);
    let newVehicles = [...state.vehicles];
    let newLamps = [...state.lamps];
    let newBreakdown = { ...state.scoreBreakdown };
    let newActions = [...state.actions];
    let newSpareParts = { ...state.spareParts };

    newLamps = newLamps.map((lamp) => {
      if (lamp.status === 'broken' || lamp.status === 'assigned') {
        const newTime = Math.max(0, lamp.timeRemaining - scaledDelta);
        if (newTime <= 0) {
          const penalty = lamp.priority === 'critical' || lamp.priority === 'high' ? 100 : 50;
          newBreakdown.timeoutPenalty += penalty;
          newActions.push(
            createActionRecord(
              'timeout',
              `${lamp.id}超时未维修`,
              -penalty,
              newTimeRemaining,
              undefined,
              lamp.id
            )
          );
          return { ...lamp, timeRemaining: 0, status: 'timeout' as const };
        }
        return { ...lamp, timeRemaining: newTime };
      }
      return lamp;
    });

    newVehicles = newVehicles.map((vehicle) => {
      if (vehicle.status === 'moving' && vehicle.path.length > 0) {
        const currentNode = state.nodes.find((n) => n.id === vehicle.currentNodeId);
        const nextNodeId = vehicle.path[Math.min(vehicle.pathIndex + 1, vehicle.path.length - 1)];
        const nextNode = state.nodes.find((n) => n.id === nextNodeId);

        if (currentNode && nextNode) {
          const totalDist = Math.sqrt(
            (nextNode.x - currentNode.x) ** 2 + (nextNode.y - currentNode.y) ** 2
          );
          const moveSpeed = vehicle.speed * scaledDelta;
          const newProgress = vehicle.progress + moveSpeed;

          if (newProgress >= totalDist) {
            const newPathIndex = vehicle.pathIndex + 1;
            if (newPathIndex >= vehicle.path.length - 1) {
              const targetLamp = newLamps.find((l) => l.id === vehicle.targetLampId);
              if (targetLamp && vehicle.spareParts >= targetLamp.repairCost) {
                return {
                  ...vehicle,
                  currentNodeId: nextNodeId,
                  status: 'repairing' as const,
                  pathIndex: newPathIndex,
                  progress: 0,
                  repairProgress: 0,
                };
              } else {
                return {
                  ...vehicle,
                  currentNodeId: nextNodeId,
                  pathIndex: newPathIndex,
                  progress: 0,
                };
              }
            }
            return {
              ...vehicle,
              currentNodeId: nextNodeId,
              pathIndex: newPathIndex,
              progress: 0,
            };
          }
          return { ...vehicle, progress: newProgress };
        }
      }

      if (vehicle.status === 'repairing' && vehicle.targetLampId) {
        const targetLamp = newLamps.find((l) => l.id === vehicle.targetLampId);
        if (targetLamp) {
          const newRepairProgress = vehicle.repairProgress + scaledDelta;
          if (newRepairProgress >= targetLamp.repairTime) {
            const repairScore = calculateRepairScore(targetLamp, targetLamp.timeRemaining);
            newBreakdown.baseScore += repairScore.baseScore;
            newBreakdown.priorityBonus += repairScore.priorityBonus;
            newBreakdown.timeBonus += repairScore.timeBonus;
            newSpareParts.used += targetLamp.repairCost;

            newLamps = newLamps.map((l) =>
              l.id === targetLamp.id ? { ...l, status: 'repaired' as const } : l
            );

            newActions.push(
              createActionRecord(
                'repair',
                `${targetLamp.id}维修完成`,
                repairScore.baseScore + repairScore.priorityBonus + repairScore.timeBonus,
                newTimeRemaining,
                vehicle.id,
                targetLamp.id
              )
            );

            const pathToDepot = findPath(
              state.nodes,
              state.edges,
              vehicle.currentNodeId,
              state.depotNodeId
            );

            if (pathToDepot) {
              return {
                ...vehicle,
                status: 'returning' as const,
                targetNodeId: state.depotNodeId,
                targetLampId: null,
                spareParts: vehicle.spareParts - targetLamp.repairCost,
                path: pathToDepot.path,
                pathIndex: 0,
                progress: 0,
                repairProgress: 0,
              };
            }
          }
          return { ...vehicle, repairProgress: newRepairProgress };
        }
      }

      if (vehicle.status === 'returning' && vehicle.path.length > 0) {
        const currentNode = state.nodes.find((n) => n.id === vehicle.currentNodeId);
        const nextNodeId = vehicle.path[Math.min(vehicle.pathIndex + 1, vehicle.path.length - 1)];
        const nextNode = state.nodes.find((n) => n.id === nextNodeId);

        if (currentNode && nextNode) {
          const totalDist = Math.sqrt(
            (nextNode.x - currentNode.x) ** 2 + (nextNode.y - currentNode.y) ** 2
          );
          const moveSpeed = vehicle.speed * scaledDelta;
          const newProgress = vehicle.progress + moveSpeed;

          if (newProgress >= totalDist) {
            const newPathIndex = vehicle.pathIndex + 1;
            if (newPathIndex >= vehicle.path.length - 1) {
              return {
                ...vehicle,
                currentNodeId: nextNodeId,
                status: 'idle' as const,
                targetNodeId: null,
                path: [],
                pathIndex: 0,
                progress: 0,
              };
            }
            return {
              ...vehicle,
              currentNodeId: nextNodeId,
              pathIndex: newPathIndex,
              progress: 0,
            };
          }
          return { ...vehicle, progress: newProgress };
        }
      }

      if (vehicle.status === 'idle') {
        const newEmptyTime = vehicle.emptyTime + scaledDelta;
        if (newEmptyTime >= 30 && Math.floor(newEmptyTime) % 30 === 0) {
          newBreakdown.wastePenalty += 5;
        }
        return { ...vehicle, emptyTime: newEmptyTime };
      }

      return vehicle;
    });

    const allLampsResolved = newLamps.every(
      (l) => l.status === 'repaired' || l.status === 'timeout'
    );

    const newScore = calculateTotalScore(newBreakdown);

    if (allLampsResolved || newTimeRemaining <= 0) {
      const grade = getGrade(newScore, newBreakdown, newLamps.length);
      const reason = getFailureReason(newBreakdown, newLamps, newVehicles);

      const historyRecord: HistoryRecord = {
        id: state.id,
        timestamp: Date.now(),
        finalScore: newScore,
        grade,
        level: state.level,
        scoreBreakdown: newBreakdown,
        failureReason: reason || undefined,
        actions: newActions,
        totalTime: state.timeRemaining - newTimeRemaining,
      };
      saveHistory(historyRecord);

      set({
        status: 'ended',
        timeRemaining: newTimeRemaining,
        vehicles: newVehicles,
        lamps: newLamps,
        scoreBreakdown: newBreakdown,
        score: newScore,
        actions: newActions,
        spareParts: newSpareParts,
        failureReason: reason,
      });
      return;
    }

    set({
      timeRemaining: newTimeRemaining,
      vehicles: newVehicles,
      lamps: newLamps,
      scoreBreakdown: newBreakdown,
      score: newScore,
      actions: newActions,
      spareParts: newSpareParts,
    });
  },

  endGame: () => {
    const state = get();
    if (state.status === 'ended') return;

    const grade = getGrade(state.score, state.scoreBreakdown, state.lamps.length);
    const reason = getFailureReason(state.scoreBreakdown, state.lamps, state.vehicles);

    const historyRecord: HistoryRecord = {
      id: state.id,
      timestamp: Date.now(),
      finalScore: state.score,
      grade,
      level: state.level,
      scoreBreakdown: state.scoreBreakdown,
      failureReason: reason || undefined,
      actions: state.actions,
      totalTime: 180 + state.level * 30 - state.timeRemaining,
    };
    saveHistory(historyRecord);

    set({ status: 'ended', failureReason: reason });
  },

  exportReport: () => {
    const state = get();
    return {
      gameId: state.id,
      level: state.level,
      finalScore: state.score,
      grade: getGrade(state.score, state.scoreBreakdown, state.lamps.length),
      scoreBreakdown: state.scoreBreakdown,
      spareParts: state.spareParts,
      totalLamps: state.lamps.length,
      repairedLamps: state.lamps.filter((l) => l.status === 'repaired').length,
      timeoutLamps: state.lamps.filter((l) => l.status === 'timeout').length,
      actions: state.actions,
      timestamp: state.gameStartTime,
    };
  },
}));
