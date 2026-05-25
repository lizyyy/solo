import { create } from 'zustand';
import {
  GameState,
  SupplyType,
  ActionRecord,
  HistoryRecord,
} from '../types';
import { getLevelById } from '../game/levels';
import {
  updateVehicles,
  loadSupplies,
  unloadSupplies,
  findPath,
  recordAction,
} from '../game/engine';
import { generateRandomEvent, applyEventEffect } from '../game/events';
import { calculateScore, checkWinCondition, checkLoseCondition } from '../game/scoring';

interface GameStore extends GameState {
  initializeGame: (levelId: string) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endTurn: () => void;
  selectVehicle: (vehicleId: string | null) => void;
  addToRoute: (nodeId: string) => void;
  removeFromRoute: (nodeId: string) => void;
  clearRoute: () => void;
  loadSupply: (type: SupplyType, amount: number) => void;
  unloadVehicle: () => void;
  dispatchVehicle: () => void;
  recallVehicle: (vehicleId: string) => void;
  gameTick: (deltaTime: number) => void;
  finishGame: () => void;
  resetGame: () => void;
  saveToHistory: () => void;
}

const createEmptyInventory = () => ({ water: 0, medicine: 0, tent: 0 });

const getInitialState = (): GameState => ({
  levelId: '',
  phase: 'planning',
  turn: 1,
  maxTurns: 15,
  weather: 'sunny',
  warehouseSupplies: createEmptyInventory(),
  nodes: [],
  roads: [],
  vehicles: [],
  events: [],
  selectedVehicle: null,
  selectedRoute: [],
  eventLog: [],
  startTime: 0,
  elapsedTime: 0,
  isPaused: false,
  actionHistory: [],
  score: 0,
  scoreDetails: [],
});

const STORAGE_KEY = 'relief_game_history';

export const useGameStore = create<GameStore>((set, get) => ({
  ...getInitialState(),

  initializeGame: (levelId: string) => {
    const level = getLevelById(levelId);
    if (!level) return;

    set({
      ...getInitialState(),
      levelId,
      maxTurns: level.maxTurns,
      warehouseSupplies: { ...level.initialSupplies },
      nodes: level.nodes.map((n) => ({
        ...n,
        demand: n.demand ? { ...n.demand } : undefined,
        received: n.received ? { ...n.received } : createEmptyInventory(),
      })),
      roads: level.roads.map((r) => ({ ...r })),
      vehicles: level.vehicles.map((v) => ({
        ...v,
        currentLoad: { ...v.currentLoad },
        targetNodes: [],
      })),
      eventLog: [`关卡开始：${level.name}`],
    });
  },

  startGame: () => {
    const state = get();
    if (state.phase !== 'planning') return;

    set({
      phase: 'executing',
      startTime: Date.now(),
    });
  },

  pauseGame: () => {
    set({ isPaused: true });
  },

  resumeGame: () => {
    set({ isPaused: false });
  },

  endTurn: () => {
    const state = get();
    const newTurn = state.turn + 1;

    const event = generateRandomEvent(state, state.roads, state.nodes);
    let newRoads = state.roads;
    let newNodes = state.nodes;
    let newVehicles = state.vehicles;
    let newWeather = state.weather;
    const newEventLog = [...state.eventLog];
    const newActions: ActionRecord[] = [];

    if (event) {
      const effect = applyEventEffect(event, state);
      newRoads = effect.roads;
      newNodes = effect.nodes;
      newVehicles = effect.vehicles;
      newWeather = effect.weather;
      newEventLog.push(`【${event.title}】${event.description}`);

      const eventAction: ActionRecord = {
        turn: newTurn,
        timestamp: Date.now(),
        type: 'event',
        payload: {
          eventId: event.id,
          eventType: event.type,
          title: event.title,
          description: event.description,
          affectedRoad: event.affectedRoad,
          affectedNode: event.affectedNode,
          effect: {
            roadsChanged: effect.roads !== state.roads,
            nodesChanged: effect.nodes !== state.nodes,
            vehiclesChanged: effect.vehicles !== state.vehicles,
            weatherChanged: effect.weather !== state.weather,
          },
        },
      };
      newActions.push(eventAction);
    }

    const { lose, reason } = checkLoseCondition({
      ...state,
      turn: newTurn,
      roads: newRoads,
      nodes: newNodes,
      vehicles: newVehicles,
    });

    const startAction = recordAction(newTurn, 'start', { turn: newTurn });
    newActions.push(startAction);

    if (lose) {
      const scoreResult = calculateScore({
        ...state,
        turn: newTurn,
        roads: newRoads,
        nodes: newNodes,
        vehicles: newVehicles,
      });
      set({
        turn: newTurn,
        roads: newRoads,
        nodes: newNodes,
        vehicles: newVehicles,
        weather: newWeather,
        events: event ? [...state.events, event] : state.events,
        eventLog: [...newEventLog, `游戏结束：${reason}`],
        phase: 'finished',
        failReason: reason,
        score: scoreResult.score,
        scoreDetails: scoreResult.details,
        actionHistory: [...state.actionHistory, ...newActions],
      });
      return;
    }

    set({
      turn: newTurn,
      roads: newRoads,
      nodes: newNodes,
      vehicles: newVehicles,
      weather: newWeather,
      events: event ? [...state.events, event] : state.events,
      eventLog: newEventLog,
      actionHistory: [...state.actionHistory, ...newActions],
    });
  },

  selectVehicle: (vehicleId: string | null) => {
    const state = get();
    const vehicle = vehicleId ? state.vehicles.find((v) => v.id === vehicleId) : null;
    
    if (vehicle && vehicle.status !== 'idle') {
      return;
    }

    set({
      selectedVehicle: vehicleId,
      selectedRoute: [],
    });
  },

  addToRoute: (nodeId: string) => {
    const state = get();
    if (!state.selectedVehicle) return;

    const vehicle = state.vehicles.find((v) => v.id === state.selectedVehicle);
    if (!vehicle || vehicle.status !== 'idle') return;

    const currentNode = vehicle.currentNode;
    const existingRoute = state.selectedRoute;
    const lastNode = existingRoute.length > 0 ? existingRoute[existingRoute.length - 1] : currentNode;

    if (lastNode === nodeId) return;

    const path = findPath(lastNode, nodeId, state.roads, state.nodes);
    if (!path) return;

    const newPath = path.slice(1);
    const newRoute = [...existingRoute, ...newPath];

    set({
      selectedRoute: newRoute,
    });
  },

  removeFromRoute: (nodeId: string) => {
    const state = get();
    const index = state.selectedRoute.indexOf(nodeId);
    if (index >= 0) {
      set({
        selectedRoute: state.selectedRoute.slice(0, index),
      });
    }
  },

  clearRoute: () => {
    set({ selectedRoute: [] });
  },

  loadSupply: (type: SupplyType, amount: number) => {
    const state = get();
    if (!state.selectedVehicle) return;

    const vehicleIndex = state.vehicles.findIndex((v) => v.id === state.selectedVehicle);
    if (vehicleIndex < 0) return;

    const vehicle = state.vehicles[vehicleIndex];
    if (vehicle.status !== 'idle') return;
    if (vehicle.currentNode !== state.nodes.find((n) => n.type === 'warehouse')?.id) return;

    const result = loadSupplies(vehicle, state.warehouseSupplies, type, amount);

    const action = recordAction(state.turn, 'load', {
      vehicleId: state.selectedVehicle,
      type,
      amount,
      isOverload: result.isOverload,
    });

    const newVehicles = [...state.vehicles];
    newVehicles[vehicleIndex] = result.vehicle;

    let newEventLog = state.eventLog;
    if (result.isOverload) {
      newEventLog = [...newEventLog, `警告：车辆超重！已自动调整装载量`];
    }

    set({
      vehicles: newVehicles,
      warehouseSupplies: result.warehouseSupplies,
      eventLog: newEventLog,
      actionHistory: [...state.actionHistory, action],
    });
  },

  unloadVehicle: () => {
    const state = get();
    if (!state.selectedVehicle) return;

    const vehicleIndex = state.vehicles.findIndex((v) => v.id === state.selectedVehicle);
    if (vehicleIndex < 0) return;

    const vehicle = state.vehicles[vehicleIndex];
    if (vehicle.status !== 'idle') return;

    const warehouseNode = state.nodes.find((n) => n.type === 'warehouse');
    if (!warehouseNode || vehicle.currentNode !== warehouseNode.id) return;

    const result = unloadSupplies(vehicle, state.warehouseSupplies);
    const newVehicles = [...state.vehicles];
    newVehicles[vehicleIndex] = result.vehicle;

    const action = recordAction(state.turn, 'unload', { vehicleId: state.selectedVehicle });

    set({
      vehicles: newVehicles,
      warehouseSupplies: result.warehouseSupplies,
      actionHistory: [...state.actionHistory, action],
      eventLog: [...state.eventLog, `车辆已卸载所有物资`],
    });
  },

  dispatchVehicle: () => {
    const state = get();
    if (!state.selectedVehicle || state.selectedRoute.length === 0) return;

    const vehicleIndex = state.vehicles.findIndex((v) => v.id === state.selectedVehicle);
    if (vehicleIndex < 0) return;

    const vehicle = state.vehicles[vehicleIndex];
    if (vehicle.status !== 'idle') return;

    const warehouseNode = state.nodes.find((n) => n.type === 'warehouse');
    const isAtWarehouse = warehouseNode && vehicle.currentNode === warehouseNode.id;
    const isOverloaded = vehicle.currentWeight > vehicle.maxCapacity;

    if (isAtWarehouse && isOverloaded) {
      set({
        eventLog: [...state.eventLog, `错误：车辆超重，无法出发！`],
      });
      return;
    }

    const newVehicles = [...state.vehicles];
    newVehicles[vehicleIndex] = {
      ...vehicle,
      status: 'moving',
      targetNodes: [...state.selectedRoute],
      progress: 0,
    };

    const action = recordAction(state.turn, 'route', {
      vehicleId: state.selectedVehicle,
      route: state.selectedRoute,
    });

    set({
      vehicles: newVehicles,
      selectedVehicle: null,
      selectedRoute: [],
      actionHistory: [...state.actionHistory, action],
      eventLog: [...state.eventLog, `${vehicle.name} 已出发`],
    });
  },

  recallVehicle: (vehicleId: string) => {
    const state = get();
    const vehicleIndex = state.vehicles.findIndex((v) => v.id === vehicleId);
    if (vehicleIndex < 0) return;

    const warehouseNode = state.nodes.find((n) => n.type === 'warehouse');
    if (!warehouseNode) return;

    const vehicle = state.vehicles[vehicleIndex];
    const path = findPath(vehicle.currentNode, warehouseNode.id, state.roads, state.nodes);
    if (!path) return;

    const newVehicles = [...state.vehicles];
    newVehicles[vehicleIndex] = {
      ...vehicle,
      status: 'moving',
      targetNodes: path.slice(1),
      progress: 0,
    };

    set({
      vehicles: newVehicles,
      eventLog: [...state.eventLog, `${vehicle.name} 正在返回仓库`],
    });
  },

  gameTick: (deltaTime: number) => {
    const state = get();
    if (state.phase !== 'executing' || state.isPaused) return;

    const { vehicles, nodes, deliveries } = updateVehicles(
      state.vehicles,
      state.roads,
      state.nodes,
      deltaTime
    );

    let newEventLog = state.eventLog;
    if (deliveries.length > 0) {
      newEventLog = [...newEventLog, ...deliveries.map((d) => `配送完成 - ${d}`)];
    }

    const newElapsedTime = (Date.now() - state.startTime) / 1000;

    if (checkWinCondition(nodes)) {
      const scoreResult = calculateScore({
        ...state,
        nodes,
        vehicles,
        elapsedTime: newElapsedTime,
      });
      set({
        vehicles,
        nodes,
        elapsedTime: newElapsedTime,
        eventLog: [...newEventLog, '恭喜！所有安置点需求已满足！'],
        phase: 'finished',
        score: scoreResult.score,
        scoreDetails: scoreResult.details,
      });
      return;
    }

    set({
      vehicles,
      nodes,
      elapsedTime: newElapsedTime,
      eventLog: newEventLog,
    });
  },

  finishGame: () => {
    const state = get();
    const scoreResult = calculateScore(state);

    set({
      phase: 'finished',
      score: scoreResult.score,
      scoreDetails: scoreResult.details,
    });
  },

  resetGame: () => {
    const state = get();
    const levelId = state.levelId;
    get().initializeGame(levelId);
  },

  saveToHistory: () => {
    const state = get();
    const level = getLevelById(state.levelId);
    if (!level) return;

    const record: HistoryRecord = {
      id: `history-${Date.now()}`,
      levelId: state.levelId,
      levelName: level.name,
      difficulty: level.difficulty,
      score: state.score,
      completedAt: Date.now(),
      elapsedTime: state.elapsedTime,
      turns: state.turn,
      isWin: !state.failReason,
      actionHistory: state.actionHistory,
      finalState: { ...state },
    };

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const history: HistoryRecord[] = existing ? JSON.parse(existing) : [];
      history.unshift(record);
      const toSave = history.slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  },
}));

export const getHistory = (): HistoryRecord[] => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    return existing ? JSON.parse(existing) : [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    return [];
  }
};
