import type { Baggage, BaggageType, ConveyorSegment, Flight, LevelConfig, GameEvent, BaggageError, ErrorType, GameState } from '@/types/game';
import { BAGGAGE_COLORS, getGateForFlight } from './levelConfigs';

let baggageIdCounter = 0;

export const generateBaggageId = (): string => {
  baggageIdCounter++;
  return `bag_${Date.now()}_${baggageIdCounter}`;
};

export const resetBaggageIdCounter = (): void => {
  baggageIdCounter = 0;
};

export const calculatePath = (
  startSegmentId: string,
  targetGate: string,
  segments: ConveyorSegment[],
  switches: Array<{ id: string; options: string[] }>,
  switchStates: Record<string, string>,
  gates: LevelConfig['gates']
): string[] => {
  const getNextSegments = (segmentId: string): string[] => {
    const current = segments.find(s => s.id === segmentId);
    if (!current) return [];

    if (current.isSwitch && current.switchOptions) {
      const selected = switchStates[segmentId];
      if (selected && current.switchOptions.includes(selected)) {
        return [selected];
      }
      return [current.switchOptions[0]];
    }

    const connected = segments.filter(s => 
      s.id !== segmentId && 
      Math.abs(s.start.x - current.end.x) < 0.1 && 
      Math.abs(s.start.z - current.end.z) < 0.1
    );
    return connected.map(s => s.id);
  };

  const reachesGate = (segmentId: string, gateId: string): boolean => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return false;
    
    const gate = gates.find(g => g.id === gateId);
    if (!gate) return false;

    const dist = Math.sqrt(
      Math.pow(segment.end.x - gate.position.x, 2) +
      Math.pow(segment.end.z - gate.position.z, 2)
    );
    return dist < 2.5;
  };

  const findPath = (currentId: string, visited: Set<string>): string[] | null => {
    if (visited.has(currentId)) return null;
    visited.add(currentId);

    if (reachesGate(currentId, targetGate)) {
      return [currentId];
    }

    const nextSegments = getNextSegments(currentId);
    for (const nextId of nextSegments) {
      const path = findPath(nextId, new Set(visited));
      if (path) {
        return [currentId, ...path];
      }
    }

    return null;
  };

  const path = findPath(startSegmentId, new Set());
  return path || [startSegmentId];
};

export const getSegmentEndGate = (
  segmentId: string,
  segments: ConveyorSegment[],
  gates: LevelConfig['gates']
): string | undefined => {
  const segment = segments.find(s => s.id === segmentId);
  if (!segment) return undefined;

  for (const gate of gates) {
    const dist = Math.sqrt(
      Math.pow(segment.end.x - gate.position.x, 2) +
      Math.pow(segment.end.z - gate.position.z, 2)
    );
    if (dist < 2.5) {
      return gate.id;
    }
  }
  return undefined;
};

export const createBaggage = (
  level: LevelConfig,
  flights: Flight[],
  switchStates: Record<string, string>,
  segments: ConveyorSegment[]
): Baggage => {
  const type = getRandomBaggageType(level.baggageTypes);
  const flight = flights[Math.floor(Math.random() * flights.length)];
  
  let targetGate = flight.gate;
  let isOversize = false;
  let transferTime: number | undefined;
  let transferFlight: string | undefined;

  if (type === 'oversize') {
    isOversize = true;
    targetGate = 'OVERSIZE';
  } else if (type === 'transfer') {
    transferTime = Math.floor(Math.random() * 40) + 15;
    const otherFlights = flights.filter(f => f.number !== flight.number);
    if (otherFlights.length > 0) {
      transferFlight = otherFlights[Math.floor(Math.random() * otherFlights.length)].number;
    }
  }

  if (flight.status === 'cancelled') {
    targetGate = 'STORAGE';
  } else if (flight.status === 'delayed' && level.hasDelays) {
    const shouldStore = Math.random() > 0.5;
    if (shouldStore) {
      targetGate = 'STORAGE';
    }
  }

  const firstSegment = segments[0];
  
  const baggage: Baggage = {
    id: generateBaggageId(),
    type,
    flightNumber: flight.number,
    targetGate,
    weight: Math.floor(Math.random() * 25) + 10,
    isOversize,
    transferTime,
    transferFlight,
    status: 'waiting',
    position: { ...level.spawnPoint },
    progress: 0,
    currentSegmentId: firstSegment.id,
    path: calculatePath(firstSegment.id, targetGate, segments, level.switches, switchStates, level.gates),
    pathIndex: 0,
    createdAt: Date.now(),
    color: BAGGAGE_COLORS[type] || BAGGAGE_COLORS.normal,
  };

  return baggage;
};

export const getRandomBaggageType = (allowedTypes: BaggageType[]): BaggageType => {
  const weights: Record<BaggageType, number> = {
    normal: 60,
    transfer: 25,
    oversize: 15,
  };
  
  const filtered = allowedTypes.map(t => ({ type: t, weight: weights[t] }));
  const totalWeight = filtered.reduce((sum, f) => sum + f.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of filtered) {
    random -= item.weight;
    if (random <= 0) return item.type;
  }
  
  return allowedTypes[0];
};

export const updateBaggagePosition = (
  baggage: Baggage,
  segments: ConveyorSegment[],
  deltaTime: number
): { baggage: Baggage; reachedEnd: boolean; reachedGate?: string } => {
  if (baggage.status !== 'moving' && baggage.status !== 'waiting') {
    return { baggage, reachedEnd: false };
  }

  const currentSegment = segments.find(s => s.id === baggage.currentSegmentId);
  if (!currentSegment) {
    return { baggage: { ...baggage, status: 'error' }, reachedEnd: true };
  }

  const speed = currentSegment.speed;
  const distance = speed * deltaTime;
  
  const segmentLength = Math.sqrt(
    Math.pow(currentSegment.end.x - currentSegment.start.x, 2) +
    Math.pow(currentSegment.end.z - currentSegment.start.z, 2)
  );

  let newProgress = baggage.progress + distance / segmentLength;
  let newPathIndex = baggage.pathIndex;
  let newSegmentId = baggage.currentSegmentId;
  let newPosition = { ...baggage.position };
  let reachedEnd = false;
  let reachedGate: string | undefined;

  if (newProgress >= 1) {
    newProgress = 0;
    newPathIndex++;

    if (newPathIndex >= baggage.path.length) {
      reachedEnd = true;
      const levelConfig = (window as any).__currentLevel as LevelConfig;
      if (levelConfig) {
        reachedGate = getSegmentEndGate(baggage.currentSegmentId, segments, levelConfig.gates);
      }
      newPosition = { ...currentSegment.end };
    } else {
      newSegmentId = baggage.path[newPathIndex];
      const nextSegment = segments.find(s => s.id === newSegmentId);
      if (nextSegment) {
        newPosition = { ...nextSegment.start };
      }
    }
  } else {
    newPosition = {
      x: currentSegment.start.x + (currentSegment.end.x - currentSegment.start.x) * newProgress,
      z: currentSegment.start.z + (currentSegment.end.z - currentSegment.start.z) * newProgress,
    };
  }

  return {
    baggage: {
      ...baggage,
      progress: newProgress,
      pathIndex: newPathIndex,
      currentSegmentId: newSegmentId,
      position: newPosition,
      status: 'moving',
    },
    reachedEnd,
    reachedGate,
  };
};

export const validateDelivery = (
  baggage: Baggage,
  actualGate: string,
  level: LevelConfig,
  elapsedTime: number
): { valid: boolean; errorType?: ErrorType; description: string } => {
  if (baggage.isOversize) {
    if (actualGate !== 'OVERSIZE') {
      return {
        valid: false,
        errorType: 'oversize_wrong_lane',
        description: `超规行李(${baggage.weight}kg)应送往超规口OVERSIZE，实际送往${actualGate}`,
      };
    }
  }

  if (baggage.type === 'transfer' && baggage.transferTime !== undefined) {
    if (baggage.transferTime <= 0) {
      return {
        valid: false,
        errorType: 'transfer_timeout',
        description: `转机行李${baggage.flightNumber}→${baggage.transferFlight}转机超时`,
      };
    }
  }

  if (actualGate !== baggage.targetGate) {
    const flightsList = (level as any).flightsWithStatus || level.flights;
    const flight = flightsList?.find((f: any) => f.number === baggage.flightNumber);
    if (flight?.status === 'cancelled') {
      return {
        valid: false,
        errorType: 'flight_cancelled',
        description: `航班${baggage.flightNumber}已取消，行李应转存STORAGE`,
      };
    }
    
    return {
      valid: false,
      errorType: 'wrong_gate',
      description: `行李${baggage.flightNumber}应送往${baggage.targetGate}，实际送往${actualGate}`,
    };
  }

  if (baggage.transferTime !== undefined && baggage.transferTime < 10) {
    return {
      valid: true,
      description: `转机时间紧迫，剩余${baggage.transferTime}分钟`,
    };
  }

  return {
    valid: true,
    description: `行李${baggage.flightNumber}正确送达${actualGate}`,
  };
};

export const calculateScore = (
  baggage: Baggage,
  valid: boolean,
  elapsedTime: number
): number => {
  if (!valid) return -50;

  let baseScore = 100;
  
  if (baggage.type === 'transfer') {
    baseScore = 150;
    if (baggage.transferTime && baggage.transferTime > 20) {
      baseScore += 50;
    }
  }
  
  if (baggage.isOversize) {
    baseScore = 200;
  }

  return baseScore;
};

export const updateFlightStatuses = (
  flights: Flight[],
  elapsedTime: number,
  hasDelays: boolean
): { flights: Flight[]; changes: Array<{ flightNumber: string; oldStatus: string; newStatus: string }> } => {
  if (!hasDelays) return { flights, changes: [] };

  const changes: Array<{ flightNumber: string; oldStatus: string; newStatus: string }> = [];
  const updatedFlights = flights.map(flight => {
    if (flight.status === 'ontime' && elapsedTime > 30) {
      const rand = Math.random();
      if (rand < 0.05) {
        changes.push({ flightNumber: flight.number, oldStatus: 'ontime', newStatus: 'delayed' });
        return { ...flight, status: 'delayed' as const };
      } else if (rand < 0.08) {
        changes.push({ flightNumber: flight.number, oldStatus: 'ontime', newStatus: 'cancelled' });
        return { ...flight, status: 'cancelled' as const };
      }
    }
    return flight;
  });

  return { flights: updatedFlights, changes };
};

export const checkPassConditions = (
  state: GameState,
  level: LevelConfig
): { passed: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  const total = state.correctCount + state.errorCount;
  const accuracy = total > 0 ? state.correctCount / total : 1;

  if (accuracy < level.passConditions.minAccuracy) {
    reasons.push(`准确率${(accuracy * 100).toFixed(1)}%低于要求${(level.passConditions.minAccuracy * 100)}%`);
  }

  if (state.errorCount > level.passConditions.maxErrors) {
    reasons.push(`错误数${state.errorCount}超过限制${level.passConditions.maxErrors}`);
  }

  if (level.passConditions.maxTransferTimeouts && state.transferTimeoutCount > level.passConditions.maxTransferTimeouts) {
    reasons.push(`转机超时${state.transferTimeoutCount}次超过限制${level.passConditions.maxTransferTimeouts}`);
  }

  if (level.passConditions.maxOversizeErrors && state.oversizeErrorCount > level.passConditions.maxOversizeErrors) {
    reasons.push(`超规错误${state.oversizeErrorCount}次超过限制${level.passConditions.maxOversizeErrors}`);
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
};

export const createGameEvent = (
  type: GameEvent['type'],
  data: any,
  gameTime: number
): GameEvent => ({
  timestamp: Date.now(),
  gameTime,
  type,
  data,
});

export const createBaggageError = (
  baggage: Baggage,
  errorType: ErrorType,
  description: string,
  gameTime: number,
  actualGate?: string
): BaggageError => ({
  baggageId: baggage.id,
  flightNumber: baggage.flightNumber,
  type: errorType,
  timestamp: Date.now(),
  gameTime,
  description,
  targetGate: baggage.targetGate,
  actualGate,
});
