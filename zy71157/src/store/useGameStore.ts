import { create } from 'zustand';
import type { GameState, Baggage, ConveyorSegment, Flight, LevelConfig, GameRecord, BaggageError } from '@/types/game';
import { getLevelConfig } from '@/utils/levelConfigs';
import {
  createBaggage,
  updateBaggagePosition,
  validateDelivery,
  calculateScore,
  updateFlightStatuses,
  checkPassConditions,
  createGameEvent,
  createBaggageError,
  resetBaggageIdCounter,
  calculatePath,
} from '@/utils/gameLogic';
import { saveGameRecord } from '@/utils/reportGenerator';

interface GameStore extends GameState {
  initLevel: (levelId: number) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  toggleSwitch: (switchId: string) => void;
  updateGame: (deltaTime: number) => void;
  spawnBaggage: () => void;
  selectBaggage: (baggageId?: string) => void;
  getCurrentRecord: () => Omit<GameRecord, 'id'> | null;
  setReplayMode: (record: GameRecord) => void;
  updateReplay: (deltaTime: number) => void;
  switchStates: Record<string, string>;
  lastSpawnTime: number;
  lastFlightUpdateTime: number;
  lastRecordId: string | null;
}

const generateId = (): string => {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const initialState: GameState = {
  levelId: 0,
  status: 'idle',
  timeRemaining: 0,
  elapsedTime: 0,
  score: 0,
  correctCount: 0,
  errorCount: 0,
  transferTimeoutCount: 0,
  oversizeErrorCount: 0,
  baggages: [],
  conveyorSegments: [],
  flights: [],
  gates: [],
  switches: [],
  events: [],
  errors: [],
  replayMode: false,
  replaySpeed: 1,
  replayTime: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  switchStates: {},
  lastSpawnTime: 0,
  lastFlightUpdateTime: 0,
  lastRecordId: null,

  initLevel: (levelId: number) => {
    const level = getLevelConfig(levelId);
    if (!level) return;

    resetBaggageIdCounter();

    const segments: ConveyorSegment[] = level.conveyorSegments.map(s => ({
      ...s,
      currentSwitchTarget: s.isSwitch && s.switchOptions ? s.switchOptions[0] : undefined,
    }));

    const flights: Flight[] = level.flights.map(f => ({
      ...f,
      status: 'ontime',
    }));

    const switchStates: Record<string, string> = {};
    segments.forEach(s => {
      if (s.isSwitch && s.switchOptions && s.currentSwitchTarget) {
        switchStates[s.id] = s.currentSwitchTarget;
      }
    });

    (window as any).__currentLevel = level;

    set({
      levelId,
      status: 'idle',
      timeRemaining: level.timeLimit,
      elapsedTime: 0,
      score: 0,
      correctCount: 0,
      errorCount: 0,
      transferTimeoutCount: 0,
      oversizeErrorCount: 0,
      baggages: [],
      conveyorSegments: segments,
      flights,
      gates: level.gates,
      switches: level.switches,
      events: [],
      errors: [],
      replayMode: false,
      currentLevel: level,
      switchStates,
      lastSpawnTime: 0,
      lastFlightUpdateTime: 0,
      selectedBaggageId: undefined,
    });
  },

  startGame: () => {
    const state = get();
    if (state.status !== 'idle' && state.status !== 'finished' && state.status !== 'failed') return;

    const event = createGameEvent('game_start', {}, state.elapsedTime);
    
    set(state => ({
      status: 'playing',
      events: [...state.events, event],
    }));
  },

  pauseGame: () => {
    const state = get();
    if (state.status !== 'playing') return;

    const event = createGameEvent('game_pause', {}, state.elapsedTime);
    
    set(state => ({
      status: 'paused',
      events: [...state.events, event],
    }));
  },

  resumeGame: () => {
    const state = get();
    if (state.status !== 'paused') return;

    const event = createGameEvent('game_resume', {}, state.elapsedTime);
    
    set(state => ({
      status: 'playing',
      events: [...state.events, event],
    }));
  },

  restartGame: () => {
    const levelId = get().levelId;
    get().initLevel(levelId);
  },

  endGame: () => {
    const state = get();
    const level = state.currentLevel;
    if (!level) return;

    const { passed, reasons } = checkPassConditions(state, level);
    const total = state.correctCount + state.errorCount;
    const accuracy = total > 0 ? state.correctCount / total : 1;

    const event = createGameEvent('game_end', { passed, reasons }, state.elapsedTime);

    const finalStats = {
      totalBaggage: total,
      byType: {
        normal: state.baggages.filter(b => b.type === 'normal').length,
        transfer: state.baggages.filter(b => b.type === 'transfer').length,
        oversize: state.baggages.filter(b => b.type === 'oversize').length,
      },
      byGate: {} as Record<string, number>,
    };

    state.gates.forEach(gate => {
      finalStats.byGate[gate.id] = state.baggages.filter(b => b.targetGate === gate.id).length;
    });

    const record: Omit<GameRecord, 'id'> = {
      levelId: state.levelId,
      levelName: level.name,
      startTime: state.events.find(e => e.type === 'game_start')?.timestamp || Date.now(),
      endTime: Date.now(),
      playTime: state.elapsedTime,
      score: state.score,
      correctCount: state.correctCount,
      errorCount: state.errorCount,
      accuracy,
      transferTimeoutCount: state.transferTimeoutCount,
      oversizeErrorCount: state.oversizeErrorCount,
      passed,
      events: [...state.events, event],
      errors: state.errors,
      finalStats,
    };

    const recordWithId: GameRecord = { ...record, id: generateId() };
    saveGameRecord(recordWithId);

    set(state => ({
      status: passed ? 'finished' : 'failed',
      events: [...state.events, event],
      lastRecordId: recordWithId.id,
    }));
  },

  toggleSwitch: (switchId: string) => {
    const state = get();
    const segments = state.conveyorSegments;
    const switchStates = { ...state.switchStates };

    const segmentIndex = segments.findIndex(s => s.id === switchId);
    if (segmentIndex === -1) return;

    const segment = segments[segmentIndex];
    if (!segment.isSwitch || !segment.switchOptions) return;

    const currentIndex = segment.switchOptions.indexOf(switchStates[switchId]);
    const nextIndex = (currentIndex + 1) % segment.switchOptions.length;
    const nextTarget = segment.switchOptions[nextIndex];

    const newSegments = [...segments];
    newSegments[segmentIndex] = {
      ...segment,
      currentSwitchTarget: nextTarget,
    };

    switchStates[switchId] = nextTarget;

    const switchConfig = state.switches.find(s => s.id === switchId);
    const event = createGameEvent('switch_changed', {
      switchId,
      oldValue: switchStates[switchId],
      newValue: nextTarget,
      options: switchConfig?.options,
    }, state.elapsedTime);

    const updatedBaggages = state.baggages.map(b => {
      if (b.status === 'moving' || b.status === 'waiting') {
        const newPath = calculatePath(
          b.path[b.pathIndex],
          b.targetGate,
          newSegments,
          state.switches,
          switchStates,
          state.gates
        );
        return {
          ...b,
          path: [...b.path.slice(0, b.pathIndex + 1), ...newPath.slice(1)],
        };
      }
      return b;
    });

    set(state => ({
      conveyorSegments: newSegments,
      switchStates,
      events: [...state.events, event],
      baggages: updatedBaggages,
    }));
  },

  updateGame: (deltaTime: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const level = state.currentLevel;
    if (!level) return;

    let newTimeRemaining = state.timeRemaining - deltaTime;
    let newElapsedTime = state.elapsedTime + deltaTime;

    if (newTimeRemaining <= 0) {
      newTimeRemaining = 0;
      set({ timeRemaining: 0, elapsedTime: newElapsedTime });
      get().endGame();
      return;
    }

    let newScore = state.score;
    let newCorrectCount = state.correctCount;
    let newErrorCount = state.errorCount;
    let newTransferTimeoutCount = state.transferTimeoutCount;
    let newOversizeErrorCount = state.oversizeErrorCount;
    const newErrors: BaggageError[] = [...state.errors];
    const newEvents = [...state.events];

    const newBaggages: Baggage[] = [];
    const baggageToRemove: string[] = [];

    for (const baggage of state.baggages) {
      if (baggage.status !== 'moving' && baggage.status !== 'waiting') {
        newBaggages.push(baggage);
        continue;
      }

      const { baggage: updatedBaggage, reachedEnd, reachedGate } = updateBaggagePosition(
        baggage,
        state.conveyorSegments,
        deltaTime
      );

      if (baggage.type === 'transfer' && baggage.transferTime !== undefined) {
        updatedBaggage.transferTime = Math.max(0, baggage.transferTime - deltaTime * 0.5);
      }

      if (reachedEnd && reachedGate) {
        const validation = validateDelivery(updatedBaggage, reachedGate, level, newElapsedTime);
        const scoreChange = calculateScore(updatedBaggage, validation.valid, newElapsedTime);

        newScore += scoreChange;

        if (validation.valid) {
          newCorrectCount++;
          updatedBaggage.status = 'delivered';
          updatedBaggage.deliveredAt = Date.now();
          
          const event = createGameEvent('baggage_delivered', {
            baggage: updatedBaggage,
            gate: reachedGate,
            score: scoreChange,
          }, newElapsedTime);
          newEvents.push(event);
        } else {
          newErrorCount++;
          updatedBaggage.status = 'error';
          updatedBaggage.errorType = validation.errorType;
          updatedBaggage.errorDescription = validation.description;

          if (validation.errorType === 'transfer_timeout') {
            newTransferTimeoutCount++;
          } else if (validation.errorType === 'oversize_wrong_lane') {
            newOversizeErrorCount++;
          }

          const error = createBaggageError(
            updatedBaggage,
            validation.errorType!,
            validation.description,
            newElapsedTime,
            reachedGate
          );
          newErrors.push(error);

          const event = createGameEvent('baggage_error', {
            baggage: updatedBaggage,
            error: validation.errorType,
            description: validation.description,
            gate: reachedGate,
            score: scoreChange,
          }, newElapsedTime);
          newEvents.push(event);
        }

        baggageToRemove.push(updatedBaggage.id);
        newBaggages.push({ ...updatedBaggage, status: updatedBaggage.status === 'delivered' ? 'delivered' : 'error' });
      } else if (reachedEnd) {
        newErrorCount++;
        updatedBaggage.status = 'error';
        updatedBaggage.errorType = 'missed_flight';
        updatedBaggage.errorDescription = `行李${updatedBaggage.flightNumber}未送达${updatedBaggage.targetGate}，传送带末端无对应航班口，请切换开关`;

        const error = createBaggageError(
          updatedBaggage,
          'missed_flight',
          updatedBaggage.errorDescription,
          newElapsedTime
        );
        newErrors.push(error);

        const event = createGameEvent('baggage_error', {
          baggage: updatedBaggage,
          error: 'missed_flight',
          description: updatedBaggage.errorDescription,
          gate: updatedBaggage.targetGate,
          score: -50,
        }, newElapsedTime);
        newEvents.push(event);

        newScore -= 50;

        baggageToRemove.push(updatedBaggage.id);
        newBaggages.push({ ...updatedBaggage, status: 'error' });
      } else {
        newBaggages.push(updatedBaggage);
      }
    }

    const filteredBaggages = newBaggages.filter(
      b => !baggageToRemove.includes(b.id) || b.status === 'delivered' || b.status === 'error'
    );

    let newFlights = state.flights;
    if (level.hasDelays && newElapsedTime - state.lastFlightUpdateTime > 10) {
      const { flights, changes } = updateFlightStatuses(state.flights, newElapsedTime, level.hasDelays);
      newFlights = flights;
      
      changes.forEach(change => {
        const event = createGameEvent('flight_updated', change, newElapsedTime);
        newEvents.push(event);
      });
    }

    const maxErrors = level.passConditions.maxErrors;
    if (newErrorCount > maxErrors) {
      set({
        timeRemaining: newTimeRemaining,
        elapsedTime: newElapsedTime,
        baggages: filteredBaggages,
        score: newScore,
        correctCount: newCorrectCount,
        errorCount: newErrorCount,
        transferTimeoutCount: newTransferTimeoutCount,
        oversizeErrorCount: newOversizeErrorCount,
        errors: newErrors,
        events: newEvents,
        flights: newFlights,
        lastFlightUpdateTime: newElapsedTime,
      });
      get().endGame();
      return;
    }

    if (level.passConditions.maxTransferTimeouts && newTransferTimeoutCount > level.passConditions.maxTransferTimeouts) {
      set({
        timeRemaining: newTimeRemaining,
        elapsedTime: newElapsedTime,
        baggages: filteredBaggages,
        score: newScore,
        correctCount: newCorrectCount,
        errorCount: newErrorCount,
        transferTimeoutCount: newTransferTimeoutCount,
        oversizeErrorCount: newOversizeErrorCount,
        errors: newErrors,
        events: newEvents,
        flights: newFlights,
        lastFlightUpdateTime: newElapsedTime,
      });
      get().endGame();
      return;
    }

    set({
      timeRemaining: newTimeRemaining,
      elapsedTime: newElapsedTime,
      baggages: filteredBaggages,
      score: newScore,
      correctCount: newCorrectCount,
      errorCount: newErrorCount,
      transferTimeoutCount: newTransferTimeoutCount,
      oversizeErrorCount: newOversizeErrorCount,
      errors: newErrors,
      events: newEvents,
      flights: newFlights,
      lastFlightUpdateTime: newElapsedTime,
    });
  },

  spawnBaggage: () => {
    const state = get();
    const level = state.currentLevel;
    if (!level || state.status !== 'playing') return;

    const now = state.elapsedTime;
    if (now - state.lastSpawnTime < level.baggageSpawnRate) return;

    const baggage = createBaggage(level, state.flights, state.switchStates, state.conveyorSegments);
    
    const event = createGameEvent('baggage_spawn', { baggage }, state.elapsedTime);

    set(state => ({
      baggages: [...state.baggages, baggage],
      lastSpawnTime: now,
      events: [...state.events, event],
    }));
  },

  selectBaggage: (baggageId?: string) => {
    set({ selectedBaggageId: baggageId });
  },

  getCurrentRecord: () => {
    const state = get();
    const level = state.currentLevel;
    if (!level) return null;

    const total = state.correctCount + state.errorCount;
    const accuracy = total > 0 ? state.correctCount / total : 1;

    const finalStats = {
      totalBaggage: total,
      byType: {
        normal: state.baggages.filter(b => b.type === 'normal').length,
        transfer: state.baggages.filter(b => b.type === 'transfer').length,
        oversize: state.baggages.filter(b => b.type === 'oversize').length,
      },
      byGate: {} as Record<string, number>,
    };

    state.gates.forEach(gate => {
      finalStats.byGate[gate.id] = state.baggages.filter(b => b.targetGate === gate.id).length;
    });

    return {
      levelId: state.levelId,
      levelName: level.name,
      startTime: state.events.find(e => e.type === 'game_start')?.timestamp || Date.now(),
      endTime: Date.now(),
      playTime: state.elapsedTime,
      score: state.score,
      correctCount: state.correctCount,
      errorCount: state.errorCount,
      accuracy,
      transferTimeoutCount: state.transferTimeoutCount,
      oversizeErrorCount: state.oversizeErrorCount,
      passed: checkPassConditions(state, level).passed,
      events: state.events,
      errors: state.errors,
      finalStats,
    };
  },

  setReplayMode: (record: GameRecord) => {
    const level = getLevelConfig(record.levelId);
    if (!level) return;

    const segments: ConveyorSegment[] = level.conveyorSegments.map(s => ({
      ...s,
      currentSwitchTarget: s.isSwitch && s.switchOptions ? s.switchOptions[0] : undefined,
    }));

    const flights: Flight[] = level.flights.map(f => ({
      ...f,
      status: 'ontime',
    }));

    (window as any).__currentLevel = level;

    set({
      levelId: record.levelId,
      status: 'replay',
      timeRemaining: level.timeLimit,
      elapsedTime: 0,
      score: 0,
      correctCount: 0,
      errorCount: 0,
      transferTimeoutCount: 0,
      oversizeErrorCount: 0,
      baggages: [],
      conveyorSegments: segments,
      flights,
      gates: level.gates,
      switches: level.switches,
      events: record.events,
      errors: [],
      replayMode: true,
      replaySpeed: 1,
      replayTime: 0,
      currentLevel: level,
      switchStates: {},
      lastSpawnTime: 0,
      lastFlightUpdateTime: 0,
    });
  },

  updateReplay: (deltaTime: number) => {
    const state = get();
    if (state.status !== 'replay') return;

    const newReplayTime = state.replayTime + deltaTime * state.replaySpeed;
    
    const currentEvents = state.events.filter(
      e => e.gameTime <= newReplayTime && e.gameTime > state.replayTime
    );

    let newScore = state.score;
    let newCorrectCount = state.correctCount;
    let newErrorCount = state.errorCount;
    let newTransferTimeoutCount = state.transferTimeoutCount;
    let newOversizeErrorCount = state.oversizeErrorCount;
    let newBaggages = [...state.baggages];
    let newFlights = [...state.flights];
    const newErrors = [...state.errors];
    let newSegments = [...state.conveyorSegments];
    const newSwitchStates = { ...state.switchStates };

    for (const event of currentEvents) {
      switch (event.type) {
        case 'baggage_spawn':
          newBaggages.push({ ...event.data.baggage, status: 'waiting' });
          break;
        case 'baggage_delivered':
          newBaggages = newBaggages.map(b =>
            b.id === event.data.baggage.id
              ? { ...b, status: 'delivered', deliveredAt: event.timestamp }
              : b
          );
          newScore += event.data.score;
          newCorrectCount++;
          break;
        case 'baggage_error':
          newBaggages = newBaggages.map(b =>
            b.id === event.data.baggage.id
              ? { ...b, status: 'error', errorType: event.data.error, errorDescription: event.data.description }
              : b
          );
          newScore += event.data.score;
          newErrorCount++;
          if (event.data.error === 'transfer_timeout') newTransferTimeoutCount++;
          if (event.data.error === 'oversize_wrong_lane') newOversizeErrorCount++;
          newErrors.push({
            baggageId: event.data.baggage.id,
            flightNumber: event.data.baggage.flightNumber,
            type: event.data.error,
            timestamp: event.timestamp,
            gameTime: event.gameTime,
            description: event.data.description,
            targetGate: event.data.baggage.targetGate,
            actualGate: event.data.gate,
          });
          break;
        case 'switch_changed':
          newSegments = newSegments.map(s =>
            s.id === event.data.switchId
              ? { ...s, currentSwitchTarget: event.data.newValue }
              : s
          );
          newSwitchStates[event.data.switchId] = event.data.newValue;
          break;
        case 'flight_updated':
          newFlights = newFlights.map(f =>
            f.number === event.data.flightNumber
              ? { ...f, status: event.data.newStatus as any }
              : f
          );
          break;
        case 'game_end':
          set({ status: 'finished' });
          break;
      }
    }

    const activeBaggages = newBaggages.filter(b => b.status === 'moving' || b.status === 'waiting');
    const updatedBaggages = activeBaggages.map(baggage => {
      const { baggage: updated } = updateBaggagePosition(baggage, newSegments, deltaTime * state.replaySpeed);
      return updated;
    });

    const finalBaggages = [
      ...newBaggages.filter(b => b.status !== 'moving' && b.status !== 'waiting'),
      ...updatedBaggages,
    ];

    const level = state.currentLevel;
    const timeRemaining = level ? Math.max(0, level.timeLimit - newReplayTime) : 0;

    if (timeRemaining <= 0) {
      set({ status: 'finished' });
      return;
    }

    set({
      replayTime: newReplayTime,
      elapsedTime: newReplayTime,
      timeRemaining,
      baggages: finalBaggages,
      score: newScore,
      correctCount: newCorrectCount,
      errorCount: newErrorCount,
      transferTimeoutCount: newTransferTimeoutCount,
      oversizeErrorCount: newOversizeErrorCount,
      errors: newErrors,
      flights: newFlights,
      conveyorSegments: newSegments,
      switchStates: newSwitchStates,
    });
  },
}));
