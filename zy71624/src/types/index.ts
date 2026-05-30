export type ComponentType = 'power' | 'switch' | 'bulb' | 'resistor' | 'bar';

export type ComponentState = 'normal' | 'on' | 'off' | 'broken' | 'overloaded';

export type OrderStatus = 'pending' | 'completed' | 'timeout' | 'returned' | 'confirmed';

export type IncidentType = 'short_circuit' | 'overvoltage' | 'overcurrent' | 'undervoltage' | 'timeout' | 'parallel_current_error';

export type GameStatus = 'idle' | 'playing' | 'paused' | 'stopped' | 'finished';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ReportStatus = 'processed' | 'pending' | 'returned';

export interface Position {
  x: number;
  y: number;
}

export interface CircuitNode {
  id: string;
  componentId: string;
  index: number;
  voltage: number;
  current: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  state: ComponentState;
  properties: {
    voltage?: number;
    resistance?: number;
    current?: number;
    ratedVoltage?: number;
    barId?: number;
  };
  nodes: CircuitNode[];
}

export interface Wire {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  current: number;
  isShort: boolean;
  isActive: boolean;
}

export interface Circuit {
  id: string;
  components: CircuitComponent[];
  wires: Wire[];
  totalVoltage: number;
  totalCurrent: number;
  hasShort: boolean;
  status: 'active' | 'stopped' | 'error';
}

export interface Bar {
  id: number;
  name: string;
  currentVoltage: number;
  requiredVoltage: number;
  status: 'off' | 'normal' | 'overvoltage' | 'undervoltage';
  bulbBrightness: number;
}

export interface Order {
  id: string;
  barId: number;
  barName: string;
  requiredVoltage: number;
  requiredCurrent: number;
  timeoutSeconds: number;
  status: OrderStatus;
  createdAt: number;
  completedAt?: number;
  problemType?: 'normal' | 'shortage' | 'overvoltage' | 'parallel_error';
  difficulty: number;
  score: number;
}

export interface CircuitSnapshot {
  id: string;
  incidentId: string;
  timestamp: number;
  circuitState: {
    components: CircuitComponent[];
    wires: Wire[];
  };
  barStates: Bar[];
  orderStates: Order[];
}

export interface Incident {
  id: string;
  type: IncidentType;
  timestamp: number;
  gameTime: number;
  description: string;
  sourceComponentId?: string;
  sourceWireId?: string;
  resolved: boolean;
  resolvedAt?: number;
  snapshotId: string;
  penalty: number;
}

export interface Action {
  type: string;
  targetId?: string;
  params: Record<string, unknown>;
}

export interface ReplayNode {
  sequence: number;
  timestamp: number;
  gameTime: number;
  type: 'component_add' | 'component_remove' | 'component_move' | 'wire_connect' | 'wire_disconnect' | 'switch_toggle' | 'order_event' | 'incident_event' | 'state_change';
  action: Action;
  previousState: {
    circuit: Circuit;
    orders: Order[];
    bars: Bar[];
  };
  newState: {
    circuit: Circuit;
    orders: Order[];
    bars: Bar[];
  };
}

export interface GameStatistics {
  totalScore: number;
  accuracy: number;
  totalOrders: number;
  processedOrders: number;
  pendingOrders: number;
  returnedOrders: number;
  totalIncidents: number;
  shortCircuits: number;
  overvoltages: number;
  timeouts: number;
  parallelErrors: number;
}

export interface GameConfig {
  gameDuration: number;
  difficulty: Difficulty;
  maxConcurrentOrders: number;
  orderInterval: number;
  initialComponents: {
    power: number;
    switch: number;
    bulb: number;
    resistor: number;
  };
}

export interface GameState {
  id: string;
  status: GameStatus;
  difficulty: Difficulty;
  startTime: number;
  endTime?: number;
  currentTime: number;
  remainingTime: number;
  score: number;
  circuit: Circuit;
  bars: Bar[];
  orders: Order[];
  incidents: Incident[];
  snapshots: CircuitSnapshot[];
  replayData: ReplayNode[];
  currentReplayIndex: number;
  isReplaying: boolean;
  selectedComponentId: string | null;
  selectedWireId: string | null;
  highlightedErrorId: string | null;
  availableComponents: CircuitComponent[];
  statistics: GameStatistics;
}

export interface GameReport {
  gameId: string;
  startTime: number;
  endTime: number;
  duration: number;
  difficulty: Difficulty;
  totalScore: number;
  accuracy: number;
  statistics: {
    processed: { count: number; orders: Order[] };
    pending: { count: number; orders: Order[] };
    returned: { count: number; orders: Order[] };
  };
  incidents: Incident[];
  replayData: ReplayNode[];
  exportTime: number;
}

export interface HistoryRecord {
  gameId: string;
  startTime: number;
  endTime: number;
  difficulty: Difficulty;
  totalScore: number;
  accuracy: number;
  totalOrders: number;
  totalIncidents: number;
  thumbnail?: string;
}

export interface DraggableComponent {
  id: string;
  type: ComponentType;
  component: CircuitComponent;
}
