import type {
  GameState,
  Booth,
  Crew,
  Task,
  Material,
  Inspection,
  GameEvent,
  TaskType,
  InspectionType,
  MaterialType,
  ScoreBreakdown,
} from '@/types/game';
import { TASK_CONFIG } from '@/types/game';
import { BOOTH_NAMES, CREW_NAMES, MATERIAL_NAMES } from '@/data/levels';

const generateId = () => Math.random().toString(36).substring(2, 9);

export function initializeBooths(count: number): Booth[] {
  const booths: Booth[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const spacing = 200;
    const offsetX = 200 - ((cols - 1) * spacing) / 2;
    const offsetY = 180 - ((rows - 1) * spacing) / 2;

    booths.push({
      id: `booth-${i}`,
      name: BOOTH_NAMES[i] || `展位 ${i + 1}`,
      position: {
        x: offsetX + col * spacing,
        y: offsetY + row * spacing,
      },
      size: { w: 140, h: 120 },
      utilitiesDone: false,
      structureDone: false,
      fireSafetyDone: false,
      utilitiesProgress: 0,
      structureProgress: 0,
      fireSafetyProgress: 0,
    });
  }
  return booths;
}

export function initializeCrews(count: number): Crew[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `crew-${i}`,
    name: CREW_NAMES[i] || `施工队 ${String.fromCharCode(65 + i)}`,
    status: 'idle' as const,
    currentTask: null,
    assignedBooth: null,
    efficiency: 0.9 + Math.random() * 0.3,
  }));
}

export function initializeMaterials(boothCount: number, delayChance: number): Material[] {
  const materials: Material[] = [];
  const types: MaterialType[] = ['utilities', 'structure', 'fire'];

  for (let i = 0; i < boothCount; i++) {
    for (const type of types) {
      const baseDelivery = type === 'utilities' ? 2 : type === 'structure' ? 4 : 6;
      const variance = Math.floor(Math.random() * 3);
      const deliveryTurn = baseDelivery + variance;
      const isDelayed = Math.random() < delayChance;

      materials.push({
        id: `material-${type}-${i}`,
        name: MATERIAL_NAMES[type][Math.floor(Math.random() * MATERIAL_NAMES[type].length)],
        type,
        requiredFor: [`booth-${i}`],
        deliveryTurn,
        actualDeliveryTurn: isDelayed ? deliveryTurn + 2 : null,
        delivered: false,
        quantity: 1,
        used: false,
      });
    }
  }
  return materials;
}

export function initializeInspections(): Inspection[] {
  return [
    { type: 'utilities', unlocked: false, requested: false, completed: false, passed: false, attempts: 0 },
    { type: 'structure', unlocked: false, requested: false, completed: false, passed: false, attempts: 0 },
    { type: 'fire', unlocked: false, requested: false, completed: false, passed: false, attempts: 0 },
  ];
}

function addEvent(state: GameState, event: Omit<GameEvent, 'id' | 'turn'>): GameState {
  return {
    ...state,
    events: [
      ...state.events,
      {
        id: generateId(),
        turn: state.currentTurn,
        ...event,
      },
    ],
  };
}

function checkInspectionUnlocks(state: GameState): GameState {
  let newInspections = [...state.inspections];
  let newEvents = [...state.events];

  const utilitiesDone = state.booths.every((b) => b.utilitiesProgress >= 100);
  const utilitiesInspection = newInspections.find((i) => i.type === 'utilities');

  if (utilitiesDone && utilitiesInspection && !utilitiesInspection.unlocked) {
    utilitiesInspection.unlocked = true;
    newEvents.push({
      id: generateId(),
      turn: state.currentTurn,
      type: 'info' as const,
      message: '🔓 水电验收已解锁！可以申请验收。',
    });
  }

  const structureDone = state.booths.every((b) => b.structureProgress >= 100);
  const structureInspection = newInspections.find((i) => i.type === 'structure');
  const utilitiesPassed = utilitiesInspection?.passed;

  if (structureDone && utilitiesPassed && structureInspection && !structureInspection.unlocked) {
    structureInspection.unlocked = true;
    newEvents.push({
      id: generateId(),
      turn: state.currentTurn,
      type: 'info' as const,
      message: '🔓 展架验收已解锁！可以申请验收。',
    });
  }

  const fireDone = state.booths.every((b) => b.fireSafetyProgress >= 100);
  const fireInspection = newInspections.find((i) => i.type === 'fire');
  const structurePassed = structureInspection?.passed;

  if (fireDone && structurePassed && fireInspection && !fireInspection.unlocked) {
    fireInspection.unlocked = true;
    newEvents.push({
      id: generateId(),
      turn: state.currentTurn,
      type: 'info' as const,
      message: '🔓 消防验收已解锁！可以申请验收。',
    });
  }

  return { ...state, inspections: newInspections, events: newEvents };
}

function processMaterialDeliveries(state: GameState): GameState {
  let newMaterials = [...state.materials];
  let newEvents = [...state.events];
  let allOnTime = state.allMaterialsOnTime;

  newMaterials = newMaterials.map((m) => {
    const currentDeliveryTurn = m.actualDeliveryTurn ?? m.deliveryTurn;
    if (!m.delivered && state.currentTurn >= currentDeliveryTurn) {
      newEvents.push({
        id: generateId(),
        turn: state.currentTurn,
        type: m.actualDeliveryTurn && m.actualDeliveryTurn > m.deliveryTurn ? 'warning' as const : 'success' as const,
        message: `📦 ${m.name}已到达（展位 ${m.requiredFor[0].replace('booth-', '')}）`,
      });
      if (m.actualDeliveryTurn && m.actualDeliveryTurn > m.deliveryTurn) {
        allOnTime = false;
      }
      return { ...m, delivered: true };
    }
    return m;
  });

  return { ...state, materials: newMaterials, events: newEvents, allMaterialsOnTime: allOnTime };
}

function processCrewTasks(state: GameState): GameState {
  let newBooths = state.booths.map((b) => ({ ...b }));
  let newCrews = state.crews.map((c) => ({ ...c }));
  let newTasks = state.tasks.map((t) => ({ ...t }));
  let newEvents = [...state.events];
  let conflictDetected = state.conflictDetected;

  for (const task of newTasks) {
    if (task.status !== 'in_progress') continue;

    const crew = newCrews.find((c) => c.id === task.assignedCrew);
    const booth = newBooths.find((b) => b.id === task.boothId);

    if (!crew || !booth) continue;

    const requiredMaterials = state.materials.filter(
      (m) => m.requiredFor.includes(task.boothId) && m.type === task.type && !m.used
    );

    const missingMaterials = requiredMaterials.filter((m) => !m.delivered);
    if (missingMaterials.length > 0) {
      task.status = 'pending';
      crew.status = 'idle';
      crew.currentTask = null;
      crew.assignedBooth = null;
      newEvents.push({
        id: generateId(),
        turn: state.currentTurn,
        type: 'warning' as const,
        message: `⚠️ ${crew.name}暂停工作：${booth.name}的${TASK_CONFIG[task.type].label}材料未到`,
      });
      conflictDetected = true;
      continue;
    }

    const hasAvailableMaterials = requiredMaterials.length > 0 && requiredMaterials[0].delivered && !requiredMaterials[0].used;

    task.turnsSpent += 1 * crew.efficiency;

    const progressMap: Record<TaskType, 'utilitiesProgress' | 'structureProgress' | 'fireSafetyProgress'> = {
      utilities: 'utilitiesProgress',
      structure: 'structureProgress',
      fire_safety: 'fireSafetyProgress',
    };

    const progressKey = progressMap[task.type];
    const progressIncrement = (100 / task.turnsRequired) * crew.efficiency;
    const currentProgress = booth[progressKey];
    booth[progressKey] = Math.min(100, currentProgress + progressIncrement);

    if (task.turnsSpent >= task.turnsRequired && booth[progressKey] >= 100) {
      task.status = 'completed';
      crew.status = 'idle';
      crew.currentTask = null;
      crew.assignedBooth = null;

      if (hasAvailableMaterials) {
        requiredMaterials[0].used = true;
      }

      const doneKey: 'utilitiesDone' | 'structureDone' | 'fireSafetyDone' = task.type === 'utilities' ? 'utilitiesDone' : task.type === 'structure' ? 'structureDone' : 'fireSafetyDone';
      (booth as any)[doneKey] = true;

      newEvents.push({
        id: generateId(),
        turn: state.currentTurn,
        type: 'success' as const,
        message: `✅ ${crew.name}完成${booth.name}的${TASK_CONFIG[task.type].label}`,
      });
    }
  }

  return {
    ...state,
    booths: newBooths,
    crews: newCrews,
    tasks: newTasks,
    events: newEvents,
    conflictDetected,
  };
}

export function processTurn(state: GameState): GameState {
  let newState = { ...state };

  newState = processMaterialDeliveries(newState);
  newState = processCrewTasks(newState);
  newState = checkInspectionUnlocks(newState);

  return newState;
}

export function assignTask(state: GameState, crewId: string, boothId: string, taskType: TaskType): GameState | null {
  const crew = state.crews.find((c) => c.id === crewId);
  const booth = state.booths.find((b) => b.id === boothId);

  if (!crew || !booth) return null;
  if (crew.status !== 'idle') return null;

  if (taskType === 'structure') {
    const materials = state.materials.filter(
      (m) => m.requiredFor.includes(boothId) && m.type === 'structure'
    );
    const utilitiesMat = materials.find((m) => m.requiredFor.includes(boothId) && m.type === 'utilities');
    // Structure can start after utilities, but we allow parallel work
  }

  const requiredMaterials = state.materials.filter(
    (m) => m.requiredFor.includes(boothId) && m.type === taskType && !m.used
  );

  const config = TASK_CONFIG[taskType];
  const newTask: Task = {
    id: `task-${generateId()}`,
    type: taskType,
    boothId,
    assignedCrew: crewId,
    turnsRequired: config.turns,
    turnsSpent: 0,
    status: 'in_progress',
  };

  const newCrew = { ...crew, status: 'working' as const, currentTask: newTask.id, assignedBooth: boothId };

  const newState = {
    ...state,
    crews: state.crews.map((c) => (c.id === crewId ? newCrew : c)),
    tasks: [...state.tasks, newTask],
    events: [
      ...state.events,
      {
        id: generateId(),
        turn: state.currentTurn,
        type: 'info' as const,
        message: `👷 ${crew.name}开始${booth.name}的${config.label}`,
      },
    ],
  };

  return newState;
}

export function requestInspection(state: GameState, type: InspectionType): GameState | null {
  const inspection = state.inspections.find((i) => i.type === type);
  if (!inspection) return null;
  if (!inspection.unlocked) return null;
  if (inspection.completed) return null;

  const progressKey = type === 'utilities' ? 'utilitiesProgress' : type === 'structure' ? 'structureProgress' : 'fireSafetyProgress';
  const allReady = state.booths.every((b) => (b[progressKey] as number) >= 100);

  if (!allReady) return null;

  const newInspection = {
    ...inspection,
    requested: true,
    completed: true,
    passed: allReady,
    attempts: inspection.attempts + 1,
  };

  let newState = {
    ...state,
    inspections: state.inspections.map((i) => (i.type === type ? newInspection : i)),
  };

  if (allReady) {
    newState = {
      ...newState,
      events: [
        ...newState.events,
        {
          id: generateId(),
          turn: state.currentTurn,
          type: 'success' as const,
          message: `🏆 ${type === 'utilities' ? '水电' : type === 'structure' ? '展架' : '消防'}验收通过！`,
        },
      ],
    };
  } else {
    newState = {
      ...newState,
      events: [
        ...newState.events,
        {
          id: generateId(),
          turn: state.currentTurn,
          type: 'error' as const,
          message: `❌ ${type === 'utilities' ? '水电' : type === 'structure' ? '展架' : '消防'}验收未通过，需要整改`,
        },
      ],
    };
  }

  return newState;
}

export function emergencyDelivery(state: GameState, materialType: string, boothId: string): GameState | null {
  const booth = state.booths.find((b) => b.id === boothId);
  if (!booth) return null;

  const newState = {
    ...state,
    emergencyUsed: state.emergencyUsed + 1,
    events: [
      ...state.events,
      {
        id: generateId(),
        turn: state.currentTurn,
        type: 'warning' as const,
        message: `🚨 紧急补货：${booth.name}的${materialType === 'utilities' ? '水电' : materialType === 'structure' ? '展架' : '消防'}材料`,
      },
    ],
  };

  const pendingMaterials = newState.materials.filter(
    (m) => m.requiredFor.includes(boothId) && m.type === materialType && !m.delivered
  );

  if (pendingMaterials.length > 0) {
    return {
      ...newState,
      materials: newState.materials.map((m) =>
        m.requiredFor.includes(boothId) && m.type === materialType && !m.delivered
          ? { ...m, delivered: true, actualDeliveryTurn: state.currentTurn }
          : m
      ),
    };
  }

  return newState;
}

export function calculateScore(state: GameState, history: GameState['history']): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    onTimeBonus: 0,
    earlyCompletion: 0,
    firstTryPass: 0,
    noDelayBonus: 0,
    noConflictBonus: 0,
    inspectionPenalty: 0,
    emergencyPenalty: 0,
    overtimePenalty: 0,
    total: 0,
  };

  const allPassed = state.inspections.every((i) => i.passed);

  if (allPassed) {
    breakdown.onTimeBonus = 100;
  }

  if (allPassed && state.currentTurn < state.maxTurns) {
    breakdown.earlyCompletion = (state.maxTurns - state.currentTurn) * 10;
  }

  const allFirstTry = state.inspections.every((i) => i.attempts <= 1 && i.passed);
  if (allFirstTry) {
    breakdown.firstTryPass = state.inspections.filter((i) => i.passed).length * 20;
  }

  if (state.allMaterialsOnTime) {
    breakdown.noDelayBonus = 15;
  }

  if (!state.conflictDetected) {
    breakdown.noConflictBonus = 10;
  }

  const failedInspections = state.inspections.filter((i) => i.attempts > 1);
  breakdown.inspectionPenalty = failedInspections.length * -15;

  breakdown.emergencyPenalty = state.emergencyUsed * -10;

  if (state.currentTurn > state.maxTurns) {
    breakdown.overtimePenalty = (state.currentTurn - state.maxTurns) * -5;
  }

  breakdown.total =
    breakdown.onTimeBonus +
    breakdown.earlyCompletion +
    breakdown.firstTryPass +
    breakdown.noDelayBonus +
    breakdown.noConflictBonus +
    breakdown.inspectionPenalty +
    breakdown.emergencyPenalty +
    breakdown.overtimePenalty;

  return breakdown;
}
