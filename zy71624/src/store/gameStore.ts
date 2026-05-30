import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  GameState,
  Circuit,
  CircuitComponent,
  Wire,
  Order,
  Bar,
  Incident,
  ReplayNode,
  Difficulty,
  CircuitSnapshot,
  GameStatistics,
  ComponentType,
} from '@/types';
import { circuitEngine } from '@/utils/circuitEngine';
import { createComponent, createWire, createInitialBars, getNodeWorldPosition } from '@/utils/componentFactory';
import { orderGenerator } from '@/utils/orderGenerator';
import {
  GAME_CONFIGS,
  generateReport,
  saveGameToHistory,
  saveGameData,
} from '@/utils/gameConfig';

const createInitialCircuit = (): Circuit => ({
  id: uuidv4(),
  components: [],
  wires: [],
  totalVoltage: 0,
  totalCurrent: 0,
  hasShort: false,
  status: 'active',
});

const createInitialStatistics = (): GameStatistics => ({
  totalScore: 0,
  accuracy: 0,
  totalOrders: 0,
  processedOrders: 0,
  pendingOrders: 0,
  returnedOrders: 0,
  totalIncidents: 0,
  shortCircuits: 0,
  overvoltages: 0,
  timeouts: 0,
  parallelErrors: 0,
});

const createAvailableComponents = (difficulty: Difficulty): CircuitComponent[] => {
  const config = GAME_CONFIGS[difficulty];
  const components: CircuitComponent[] = [];

  for (let i = 0; i < config.initialComponents.power; i++) {
    components.push(createComponent('power', 0, 0, { voltage: 12 }));
  }
  for (let i = 0; i < config.initialComponents.switch; i++) {
    components.push(createComponent('switch', 0, 0));
  }
  for (let i = 0; i < config.initialComponents.bulb; i++) {
    components.push(createComponent('bulb', 0, 0));
  }
  for (let i = 0; i < config.initialComponents.resistor; i++) {
    components.push(createComponent('resistor', 0, 0, { resistance: 10 }));
  }

  return components;
};

interface GameStore extends GameState {
  initGame: (difficulty: Difficulty) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  tick: () => void;
  addComponent: (type: ComponentType, x: number, y: number, properties?: Partial<CircuitComponent['properties']>) => void;
  removeComponent: (componentId: string) => void;
  moveComponent: (componentId: string, x: number, y: number) => void;
  toggleSwitch: (componentId: string) => void;
  addWire: (fromNodeId: string, toNodeId: string) => void;
  removeWire: (wireId: string) => void;
  selectComponent: (componentId: string | null) => void;
  selectWire: (wireId: string | null) => void;
  highlightError: (errorId: string | null) => void;
  analyzeCircuit: () => void;
  generateNewOrder: () => void;
  checkOrderCompletion: () => void;
  checkOrderTimeouts: () => void;
  resolveIncident: (incidentId: string) => void;
  addReplayNode: (type: ReplayNode['type'], action: ReplayNode['action']) => void;
  startReplay: () => void;
  stopReplay: () => void;
  replayStep: (index: number) => void;
  replayNext: () => void;
  replayPrev: () => void;
  jumpToIncident: (incidentId: string) => void;
  getReport: () => ReturnType<typeof generateReport> | null;
  exportAndSave: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  id: '',
  status: 'idle',
  difficulty: 'medium',
  startTime: 0,
  currentTime: 0,
  remainingTime: 0,
  score: 0,
  circuit: createInitialCircuit(),
  bars: [],
  orders: [],
  incidents: [],
  snapshots: [],
  replayData: [],
  currentReplayIndex: 0,
  isReplaying: false,
  selectedComponentId: null,
  selectedWireId: null,
  highlightedErrorId: null,
  availableComponents: [],
  statistics: createInitialStatistics(),

  initGame: (difficulty: Difficulty) => {
    const config = GAME_CONFIGS[difficulty];
    const bars = createInitialBars();
    const availableComponents = createAvailableComponents(difficulty);
    const initialOrders = orderGenerator.generateInitialOrders(difficulty, bars, 2);

    set({
      id: uuidv4(),
      status: 'idle',
      difficulty,
      startTime: Date.now(),
      currentTime: 0,
      remainingTime: config.gameDuration,
      score: 0,
      circuit: createInitialCircuit(),
      bars,
      orders: initialOrders,
      incidents: [],
      snapshots: [],
      replayData: [],
      currentReplayIndex: 0,
      isReplaying: false,
      selectedComponentId: null,
      selectedWireId: null,
      highlightedErrorId: null,
      availableComponents,
      statistics: createInitialStatistics(),
    });

    orderGenerator.reset();
  },

  startGame: () => {
    const state = get();
    const config = GAME_CONFIGS[state.difficulty];
    set({
      status: 'playing',
      startTime: Date.now(),
      remainingTime: config.gameDuration,
    });
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'playing' });
  },

  endGame: () => {
    const state = get();
    const endTime = Date.now();
    const totalOrders = state.orders.length;
    const processedOrders = state.orders.filter(o => o.status === 'completed' || o.status === 'confirmed').length;
    const accuracy = totalOrders > 0 ? processedOrders / totalOrders : 0;

    set({
      status: 'finished',
      endTime,
      statistics: {
        ...state.statistics,
        totalScore: state.score,
        accuracy,
        totalOrders,
        processedOrders,
        pendingOrders: state.orders.filter(o => o.status === 'pending').length,
        returnedOrders: state.orders.filter(o => o.status === 'timeout' || o.status === 'returned').length,
      },
    });

    get().exportAndSave();
  },

  resetGame: () => {
    const difficulty = get().difficulty;
    get().initGame(difficulty);
  },

  tick: () => {
    const state = get();
    if (state.status !== 'playing') return;

    const newRemainingTime = state.remainingTime - 1;

    set({
      currentTime: state.currentTime + 1,
      remainingTime: newRemainingTime,
    });

    get().checkOrderTimeouts();
    get().analyzeCircuit();
    get().checkOrderCompletion();

    const config = GAME_CONFIGS[state.difficulty];
    const pendingCount = state.orders.filter(o => o.status === 'pending').length;

    if (pendingCount < config.maxConcurrentOrders && state.currentTime % 10 === 0) {
      get().generateNewOrder();
    }

    if (newRemainingTime <= 0) {
      get().endGame();
    }
  },

  addComponent: (type: ComponentType, x: number, y: number, properties = {}) => {
    const state = get();
    if (state.status !== 'playing' && state.status !== 'idle') return;

    const available = state.availableComponents.find(c => c.type === type);
    if (!available) return;

    const newComponent = createComponent(type, x, y, properties);

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    set({
      circuit: {
        ...state.circuit,
        components: [...state.circuit.components, newComponent],
      },
      availableComponents: state.availableComponents.filter(c => c.id !== available.id),
    });

    get().addReplayNode('component_add', {
      type: 'addComponent',
      targetId: newComponent.id,
      params: { type, x, y, properties },
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));

    get().analyzeCircuit();
  },

  removeComponent: (componentId: string) => {
    const state = get();
    if (state.status !== 'playing') return;

    const component = state.circuit.components.find(c => c.id === componentId);
    if (!component) return;

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    const relatedWires = state.circuit.wires.filter(w =>
      component.nodes.some(n => n.id === w.fromNodeId || n.id === w.toNodeId)
    );

    const newComponent = createComponent(component.type, 0, 0, component.properties);

    set({
      circuit: {
        ...state.circuit,
        components: state.circuit.components.filter(c => c.id !== componentId),
        wires: state.circuit.wires.filter(w => !relatedWires.some(rw => rw.id === w.id)),
      },
      availableComponents: [...state.availableComponents, newComponent],
      selectedComponentId: null,
    });

    get().addReplayNode('component_remove', {
      type: 'removeComponent',
      targetId: componentId,
      params: {},
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));

    get().analyzeCircuit();
  },

  moveComponent: (componentId: string, x: number, y: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    set({
      circuit: {
        ...state.circuit,
        components: state.circuit.components.map(c =>
          c.id === componentId ? { ...c, x, y } : c
        ),
      },
    });

    get().addReplayNode('component_move', {
      type: 'moveComponent',
      targetId: componentId,
      params: { x, y },
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));
  },

  toggleSwitch: (componentId: string) => {
    const state = get();
    if (state.status !== 'playing') return;

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    set({
      circuit: {
        ...state.circuit,
        components: state.circuit.components.map(c =>
          c.id === componentId
            ? { ...c, state: c.state === 'on' ? 'off' : 'on' }
            : c
        ),
      },
    });

    get().addReplayNode('switch_toggle', {
      type: 'toggleSwitch',
      targetId: componentId,
      params: {},
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));

    get().analyzeCircuit();
  },

  addWire: (fromNodeId: string, toNodeId: string) => {
    const state = get();
    if (state.status !== 'playing') return;

    const exists = state.circuit.wires.some(
      w => (w.fromNodeId === fromNodeId && w.toNodeId === toNodeId) ||
           (w.fromNodeId === toNodeId && w.toNodeId === fromNodeId)
    );
    if (exists) return;

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    const newWire = createWire(fromNodeId, toNodeId);

    set({
      circuit: {
        ...state.circuit,
        wires: [...state.circuit.wires, newWire],
      },
    });

    get().addReplayNode('wire_connect', {
      type: 'addWire',
      targetId: newWire.id,
      params: { fromNodeId, toNodeId },
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));

    get().analyzeCircuit();
  },

  removeWire: (wireId: string) => {
    const state = get();
    if (state.status !== 'playing') return;

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    set({
      circuit: {
        ...state.circuit,
        wires: state.circuit.wires.filter(w => w.id !== wireId),
      },
      selectedWireId: null,
    });

    get().addReplayNode('wire_disconnect', {
      type: 'removeWire',
      targetId: wireId,
      params: {},
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));

    get().analyzeCircuit();
  },

  selectComponent: (componentId: string | null) => {
    set({ selectedComponentId: componentId, selectedWireId: null });
  },

  selectWire: (wireId: string | null) => {
    set({ selectedWireId: wireId, selectedComponentId: null });
  },

  highlightError: (errorId: string | null) => {
    set({ highlightedErrorId: errorId });
  },

  analyzeCircuit: () => {
    const state = get();
    if (state.status !== 'playing') return;

    const result = circuitEngine.analyze(state.circuit, state.bars);

    const updatedBars = state.bars.map(bar => {
      const voltage = result.barVoltages.get(bar.id) || 0;
      let status: Bar['status'] = 'off';
      let brightness = 0;

      if (voltage > 0) {
        const ratio = voltage / bar.requiredVoltage;
        if (ratio > 1.2) {
          status = 'overvoltage';
          brightness = 100;
        } else if (ratio < 0.8) {
          status = 'undervoltage';
          brightness = ratio * 100;
        } else {
          status = 'normal';
          brightness = 100;
        }
      }

      return {
        ...bar,
        currentVoltage: voltage,
        status,
        bulbBrightness: brightness,
      };
    });

    if (result.incidents.length > 0) {
      const previousState = {
        circuit: JSON.parse(JSON.stringify(state.circuit)),
        orders: JSON.parse(JSON.stringify(state.orders)),
        bars: JSON.parse(JSON.stringify(state.bars)),
      };

      result.incidents.forEach(incident => {
        incident.gameTime = state.currentTime;
      });

      const snapshots: CircuitSnapshot[] = result.incidents.map(incident => ({
        id: incident.snapshotId,
        incidentId: incident.id,
        timestamp: incident.timestamp,
        circuitState: {
          components: JSON.parse(JSON.stringify(result.circuit.components)),
          wires: JSON.parse(JSON.stringify(result.circuit.wires)),
        },
        barStates: JSON.parse(JSON.stringify(updatedBars)),
        orderStates: JSON.parse(JSON.stringify(state.orders)),
      }));

      const newScore = Math.max(0, state.score - result.incidents.reduce((sum, i) => sum + i.penalty, 0));

      set(prev => ({
        circuit: result.circuit,
        bars: updatedBars,
        incidents: [...prev.incidents, ...result.incidents],
        snapshots: [...prev.snapshots, ...snapshots],
        score: newScore,
        statistics: {
          ...prev.statistics,
          totalIncidents: prev.statistics.totalIncidents + result.incidents.length,
          shortCircuits: prev.statistics.shortCircuits + result.incidents.filter(i => i.type === 'short_circuit').length,
          overvoltages: prev.statistics.overvoltages + result.incidents.filter(i => i.type === 'overvoltage' || i.type === 'undervoltage').length,
          parallelErrors: prev.statistics.parallelErrors + result.incidents.filter(i => i.type === 'parallel_current_error').length,
        },
      }));

      get().addReplayNode('incident_event', {
        type: 'incidentsDetected',
        params: { incidents: result.incidents },
      });

      const newState = {
        circuit: JSON.parse(JSON.stringify(get().circuit)),
        orders: JSON.parse(JSON.stringify(get().orders)),
        bars: JSON.parse(JSON.stringify(get().bars)),
      };

      set(state => ({
        replayData: state.replayData.map(node =>
          node.sequence === state.replayData.length - 1
            ? { ...node, previousState, newState }
            : node
        ),
      }));
    } else {
      set({
        circuit: result.circuit,
        bars: updatedBars,
      });
    }
  },

  generateNewOrder: () => {
    const state = get();
    const newOrder = orderGenerator.generateOrder(state.difficulty, state.bars, state.orders);
    if (!newOrder) return;

    const previousState = {
      circuit: JSON.parse(JSON.stringify(state.circuit)),
      orders: JSON.parse(JSON.stringify(state.orders)),
      bars: JSON.parse(JSON.stringify(state.bars)),
    };

    set(state => ({
      orders: [...state.orders, newOrder],
    }));

    get().addReplayNode('order_event', {
      type: 'newOrder',
      targetId: newOrder.id,
      params: { order: newOrder },
    });

    const newState = {
      circuit: JSON.parse(JSON.stringify(get().circuit)),
      orders: JSON.parse(JSON.stringify(get().orders)),
      bars: JSON.parse(JSON.stringify(get().bars)),
    };

    set(state => ({
      replayData: state.replayData.map(node =>
        node.sequence === state.replayData.length - 1
          ? { ...node, previousState, newState }
          : node
      ),
    }));
  },

  checkOrderCompletion: () => {
    const state = get();
    let hasChanges = false;

    const updatedOrders = state.orders.map(order => {
      if (order.status !== 'pending') return order;

      const bar = state.bars.find(b => b.id === order.barId);
      if (!bar) return order;

      const check = orderGenerator.checkOrderCompletion(order, bar);
      if (check.completed) {
        hasChanges = true;
        return {
          ...order,
          status: 'completed' as const,
          completedAt: Date.now(),
          problemType: check.problemType,
        };
      }
      return order;
    });

    if (hasChanges) {
      const completedOrders = updatedOrders.filter(
        (o, i) => o.status === 'completed' && state.orders[i]?.status !== 'completed'
      );

      const scoreGain = completedOrders.reduce((sum, o) => sum + o.score, 0);

      set({
        orders: updatedOrders,
        score: state.score + scoreGain,
        statistics: {
          ...state.statistics,
          processedOrders: state.statistics.processedOrders + completedOrders.length,
        },
      });

      completedOrders.forEach(order => {
        get().addReplayNode('order_event', {
          type: 'orderCompleted',
          targetId: order.id,
          params: { order, scoreGain },
        });
      });
    }
  },

  checkOrderTimeouts: () => {
    const state = get();
    const now = Date.now();
    let hasChanges = false;

    const updatedOrders = state.orders.map(order => {
      if (order.status !== 'pending') return order;

      const elapsed = (now - order.createdAt) / 1000;
      if (elapsed >= order.timeoutSeconds) {
        hasChanges = true;
        return {
          ...order,
          status: 'returned' as const,
          completedAt: now,
        };
      }
      return order;
    });

    if (hasChanges) {
      const timeoutOrders = updatedOrders.filter(
        (o, i) => o.status === 'returned' && state.orders[i]?.status !== 'returned'
      );

      set({
        orders: updatedOrders,
        statistics: {
          ...state.statistics,
          returnedOrders: state.statistics.returnedOrders + timeoutOrders.length,
          timeouts: state.statistics.timeouts + timeoutOrders.length,
        },
      });

      timeoutOrders.forEach(order => {
        get().addReplayNode('order_event', {
          type: 'orderTimeout',
          targetId: order.id,
          params: { order },
        });
      });
    }
  },

  resolveIncident: (incidentId: string) => {
    set(state => ({
      incidents: state.incidents.map(i =>
        i.id === incidentId
          ? { ...i, resolved: true, resolvedAt: Date.now() }
          : i
      ),
    }));
  },

  addReplayNode: (type: ReplayNode['type'], action: ReplayNode['action']) => {
    const state = get();
    const node: ReplayNode = {
      sequence: state.replayData.length,
      timestamp: Date.now(),
      gameTime: state.currentTime,
      type,
      action,
      previousState: {
        circuit: JSON.parse(JSON.stringify(state.circuit)),
        orders: JSON.parse(JSON.stringify(state.orders)),
        bars: JSON.parse(JSON.stringify(state.bars)),
      },
      newState: {
        circuit: JSON.parse(JSON.stringify(state.circuit)),
        orders: JSON.parse(JSON.stringify(state.orders)),
        bars: JSON.parse(JSON.stringify(state.bars)),
      },
    };

    set(state => ({
      replayData: [...state.replayData, node],
    }));
  },

  startReplay: () => {
    set({
      isReplaying: true,
      currentReplayIndex: 0,
    });
  },

  stopReplay: () => {
    set({
      isReplaying: false,
      currentReplayIndex: 0,
    });
  },

  replayStep: (index: number) => {
    const state = get();
    if (index < 0 || index >= state.replayData.length) return;

    const node = state.replayData[index];
    set({
      currentReplayIndex: index,
      circuit: JSON.parse(JSON.stringify(node.newState.circuit)),
      orders: JSON.parse(JSON.stringify(node.newState.orders)),
      bars: JSON.parse(JSON.stringify(node.newState.bars)),
    });
  },

  replayNext: () => {
    const state = get();
    get().replayStep(state.currentReplayIndex + 1);
  },

  replayPrev: () => {
    const state = get();
    get().replayStep(state.currentReplayIndex - 1);
  },

  jumpToIncident: (incidentId: string) => {
    const state = get();
    const incident = state.incidents.find(i => i.id === incidentId);
    if (!incident) return;

    const nodeIndex = state.replayData.findIndex(
      n => n.timestamp >= incident.timestamp
    );

    if (nodeIndex >= 0) {
      if (!state.isReplaying) {
        get().startReplay();
      }
      get().replayStep(nodeIndex);
      set({ highlightedErrorId: incidentId });
    }
  },

  getReport: () => {
    const state = get();
    if (state.status !== 'finished') return null;

    return generateReport(
      state.id,
      state.startTime,
      state.endTime || Date.now(),
      state.difficulty,
      state.score,
      state.statistics.accuracy,
      state.orders,
      state.incidents,
      state.replayData
    );
  },

  exportAndSave: () => {
    const state = get();
    const report = get().getReport();
    if (!report) return;

    const totalOrders = state.orders.length;
    const processedOrders = state.orders.filter(o => o.status === 'completed' || o.status === 'confirmed').length;
    const accuracy = totalOrders > 0 ? processedOrders / totalOrders : 0;

    saveGameToHistory(
      state.id,
      state.startTime,
      state.endTime || Date.now(),
      state.difficulty,
      state.score,
      accuracy,
      totalOrders,
      state.incidents.length
    );

    saveGameData(state.id, {
      state: JSON.parse(JSON.stringify(state)),
      report,
    });
  },
}));
