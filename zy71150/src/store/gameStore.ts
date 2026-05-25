import { create } from 'zustand';
import { 
  GameState, 
  Patient, 
  Room, 
  EsiLevel, 
  GameAction,
  FailReason,
  GameRecord,
  PatientTemplate
} from '../types/game';
import { patientTemplates } from '../data/patients';
import { levelConfigs, scoringRules } from '../data/levels';

interface GameStore {
  gameState: GameState | null;
  gameRecords: GameRecord[];
  selectedPatientId: string | null;
  isPaused: boolean;
  currentReplayIndex: number;
  isReplayMode: boolean;
  
  initGame: (levelId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  selectPatient: (patientId: string | null) => void;
  triagePatient: (patientId: string, esiLevel: EsiLevel) => void;
  assignToRoom: (patientId: string, roomId: string) => void;
  incrementTime: () => void;
  endGame: (status: 'won' | 'lost') => void;
  loadGameRecord: (gameId: string) => void;
  setReplayIndex: (index: number) => void;
  clearReplay: () => void;
  saveGameRecord: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createPatientFromTemplate = (template: PatientTemplate, arrivalTime: number): Patient => ({
  ...template,
  id: generateId(),
  arrivalTime,
  currentEsi: template.correctEsi,
  status: 'waiting',
  reassessEvents: template.reassessEvents.map(e => ({ ...e, triggered: false }))
});

const getRandomPatient = (patientPool: string[], usedTemplates: string[]): PatientTemplate => {
  const availableTemplates = patientTemplates.filter(
    t => patientPool.includes(t.id) && !usedTemplates.includes(t.id)
  );
  
  if (availableTemplates.length === 0) {
    return patientTemplates.find(t => patientPool.includes(t.id))!;
  }
  
  return availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
};

const initializeRooms = (roomConfigs: { id: string; name: string; canHandleEsi: EsiLevel[] }[]): Room[] => {
  return roomConfigs.map(config => ({
    ...config,
    status: 'idle' as const,
    processingProgress: 0
  }));
};

const loadGameRecords = (): GameRecord[] => {
  try {
    const saved = localStorage.getItem('triage_game_records');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  gameRecords: loadGameRecords(),
  selectedPatientId: null,
  isPaused: false,
  currentReplayIndex: 0,
  isReplayMode: false,

  initGame: (levelId: string) => {
    const levelConfig = levelConfigs.find(l => l.id === levelId);
    if (!levelConfig) return;

    const rooms = initializeRooms(levelConfig.rooms);
    const patients: Patient[] = [];
    const usedTemplates: string[] = [];

    for (let i = 0; i < levelConfig.initialPatients; i++) {
      const template = getRandomPatient(levelConfig.patientPool, usedTemplates);
      usedTemplates.push(template.id);
      patients.push(createPatientFromTemplate(template, -i * 5));
    }

    const initialState: GameState = {
      id: generateId(),
      levelId,
      status: 'playing',
      score: 0,
      timeElapsed: 0,
      patients,
      rooms,
      actionHistory: patients.map(p => ({
        timestamp: p.arrivalTime,
        type: 'patient_arrive' as const,
        patientId: p.id,
        details: { name: p.name, chiefComplaint: p.chiefComplaint }
      })),
      failReasons: [],
      patientsProcessed: 0,
      targetPatients: levelConfig.targetPatients,
      patientSpawnRate: levelConfig.patientSpawnRate,
      lastSpawnTime: 0
    };

    set({ 
      gameState: initialState, 
      selectedPatientId: null, 
      isPaused: false,
      isReplayMode: false,
      currentReplayIndex: 0
    });
  },

  pauseGame: () => set({ isPaused: true }),
  resumeGame: () => set({ isPaused: false }),
  
  restartGame: () => {
    const { gameState } = get();
    if (gameState) {
      get().initGame(gameState.levelId);
    }
  },

  selectPatient: (patientId: string | null) => set({ selectedPatientId: patientId }),

  triagePatient: (patientId: string, esiLevel: EsiLevel) => {
    const { gameState } = get();
    if (!gameState) return;

    const patient = gameState.patients.find(p => p.id === patientId);
    if (!patient || (patient.status !== 'waiting' && patient.status !== 'reassess')) return;

    if (patient.triageDecision === patient.currentEsi) return;

    const isCorrect = esiLevel === patient.currentEsi;
    const scoreChange = isCorrect 
      ? scoringRules.correctTriage[esiLevel] 
      : scoringRules.wrongTriage;

    const action: GameAction = {
      timestamp: gameState.timeElapsed,
      type: 'triage',
      patientId,
      details: { 
        decision: esiLevel, 
        correct: patient.currentEsi, 
        isCorrect,
        scoreChange,
        patientName: patient.name
      }
    };

    let failReasons = [...gameState.failReasons];
    if (!isCorrect) {
      failReasons.push({
        timestamp: gameState.timeElapsed,
        type: 'wrong_triage',
        patientId,
        description: `${patient.name} 分诊错误：判断为 ESI ${esiLevel}，应为 ESI ${patient.currentEsi}`,
        penalty: Math.abs(scoringRules.wrongTriage)
      });
    }

    set({
      gameState: {
        ...gameState,
        score: gameState.score + scoreChange,
        patients: gameState.patients.map(p =>
          p.id === patientId ? { ...p, triageDecision: esiLevel } : p
        ),
        actionHistory: [...gameState.actionHistory, action],
        failReasons
      }
    });
  },

  assignToRoom: (patientId: string, roomId: string) => {
    const { gameState } = get();
    if (!gameState) return;

    const patient = gameState.patients.find(p => p.id === patientId);
    const room = gameState.rooms.find(r => r.id === roomId);
    
    if (!patient || !room) return;
    if ((patient.status !== 'waiting' && patient.status !== 'reassess') || room.status !== 'idle') return;
    if (!room.canHandleEsi.includes(patient.currentEsi)) return;
    if (!patient.triageDecision) return;

    let scoreBonus = 0;
    let failReasons = [...gameState.failReasons];
    let reassessBonus = 0;

    if ('pendingReassessBonus' in patient && patient.pendingReassessBonus && patient.triageDecision) {
      reassessBonus = scoringRules.reassessSuccess;
    }
    
    if (patient.triageDecision !== patient.currentEsi) {
      failReasons.push({
        timestamp: gameState.timeElapsed,
        type: 'wrong_triage',
        patientId,
        description: `${patient.name} 分诊错误送入诊室`,
        penalty: Math.abs(scoringRules.wrongTriage)
      });
    }

    if (room.canHandleEsi[0] < patient.currentEsi && room.canHandleEsi.length < 3) {
      scoreBonus = scoringRules.resourceWaste;
      failReasons.push({
        timestamp: gameState.timeElapsed,
        type: 'resource_waste',
        patientId,
        description: `${room.name} 被用于处理低优先级患者 ${patient.name}，造成资源浪费`,
        penalty: Math.abs(scoringRules.resourceWaste)
      });
    }

    const totalScoreChange = scoreBonus + reassessBonus;

    const action: GameAction = {
      timestamp: gameState.timeElapsed,
      type: 'assign_room',
      patientId,
      details: { 
        roomId, 
        roomName: room.name,
        patientName: patient.name,
        scoreChange: totalScoreChange,
        reassessBonus: reassessBonus > 0 ? reassessBonus : undefined
      }
    };

    set({
      gameState: {
        ...gameState,
        score: gameState.score + totalScoreChange,
        patients: gameState.patients.map(p =>
          p.id === patientId ? { 
            ...p, 
            status: 'processing', 
            assignedRoomId: roomId,
            pendingReassessBonus: false
          } : p
        ),
        rooms: gameState.rooms.map(r =>
          r.id === roomId ? { ...r, status: 'occupied', patientId, processingProgress: 0 } : r
        ),
        actionHistory: [...gameState.actionHistory, action],
        failReasons
      },
      selectedPatientId: null
    });
  },

  incrementTime: () => {
    const { gameState, isPaused } = get();
    if (!gameState || isPaused || gameState.status !== 'playing') return;

    let newState = { ...gameState };
    newState.timeElapsed += 1;

    const levelConfig = levelConfigs.find(l => l.id === gameState.levelId);
    if (levelConfig && newState.timeElapsed - newState.lastSpawnTime >= newState.patientSpawnRate) {
      const usedTemplates = newState.patients.slice(-10).map(p => 
        patientTemplates.find(t => p.name === t.name)?.id || ''
      );
      const template = getRandomPatient(levelConfig.patientPool, usedTemplates);
      const newPatient = createPatientFromTemplate(template, newState.timeElapsed);
      
      newState.patients = [...newState.patients, newPatient];
      newState.lastSpawnTime = newState.timeElapsed;
      newState.actionHistory = [...newState.actionHistory, {
        timestamp: newState.timeElapsed,
        type: 'patient_arrive',
        patientId: newPatient.id,
        details: { name: newPatient.name, chiefComplaint: newPatient.chiefComplaint }
      }];
    }

    let failReasons = [...newState.failReasons];
    newState.patients = newState.patients.map(patient => {
      if (patient.status !== 'waiting' && patient.status !== 'reassess') return patient;

      const waitTime = newState.timeElapsed - patient.arrivalTime;
      if (waitTime >= patient.maxWaitTime) {
        const isCritical = patient.currentEsi <= 2;
        const penalty = isCritical ? scoringRules.criticalTimeout : scoringRules.normalTimeout;
        
        failReasons.push({
          timestamp: newState.timeElapsed,
          type: isCritical ? 'missed_critical' : 'wait_timeout',
          patientId: patient.id,
          description: `${patient.name} 等待超时${isCritical ? '（危重）' : ''}，未能及时处理`,
          penalty: Math.abs(penalty)
        });

        newState.score += penalty;
        newState.actionHistory = [...newState.actionHistory, {
          timestamp: newState.timeElapsed,
          type: 'patient_death',
          patientId: patient.id,
          details: { 
            name: patient.name, 
            isCritical,
            penalty
          }
        }];

        return { ...patient, status: isCritical ? 'deceased' : 'discharged' };
      }

      return patient;
    });

    newState.patients = newState.patients.map(patient => {
      if (patient.status !== 'waiting') return patient;

      const waitTime = newState.timeElapsed - patient.arrivalTime;
      const updatedEvents = patient.reassessEvents.map(event => {
        if (!event.triggered && waitTime >= event.triggerTime) {
          newState.actionHistory = [...newState.actionHistory, {
            timestamp: newState.timeElapsed,
            type: 'reassess',
            patientId: patient.id,
            details: { 
              patientName: patient.name,
              newSymptoms: event.newSymptoms,
              oldEsi: patient.currentEsi,
              newEsi: event.newCorrectEsi
            }
          }];

          return { ...event, triggered: true };
        }
        return event;
      });

      const triggeredEvent = updatedEvents.find(e => e.triggered && !patient.reassessEvents.find(pe => pe.triggered && pe.triggerTime === e.triggerTime));
      
      if (triggeredEvent) {
        return {
          ...patient,
          symptoms: [...patient.symptoms, ...triggeredEvent.newSymptoms],
          vitalSigns: { ...patient.vitalSigns, ...triggeredEvent.newVitalSigns },
          currentEsi: triggeredEvent.newCorrectEsi,
          correctEsi: triggeredEvent.newCorrectEsi,
          status: 'reassess' as const,
          triageDecision: undefined,
          reassessEvents: updatedEvents,
          pendingReassessBonus: true,
          arrivalTime: newState.timeElapsed,
          maxWaitTime: Math.max(30, Math.floor(patient.maxWaitTime * 0.5))
        };
      }

      return { ...patient, reassessEvents: updatedEvents };
    });

    newState.rooms = newState.rooms.map(room => {
      if (room.status !== 'occupied' || !room.patientId) return room;

      const patient = newState.patients.find(p => p.id === room.patientId);
      if (!patient) return { ...room, status: 'idle' };

      const progressIncrement = 100 / patient.processingTime;
      const newProgress = room.processingProgress + progressIncrement;

      if (newProgress >= 100) {
        newState.patientsProcessed += 1;
        newState.actionHistory = [...newState.actionHistory, {
          timestamp: newState.timeElapsed,
          type: 'patient_discharge',
          patientId: room.patientId,
          details: { patientName: patient.name, roomName: room.name }
        }];

        newState.patients = newState.patients.map(p =>
          p.id === room.patientId ? { ...p, status: 'discharged' } : p
        );

        return { ...room, status: 'idle', patientId: undefined, processingProgress: 0 };
      }

      return { ...room, processingProgress: newProgress };
    });

    newState.failReasons = failReasons;

    const deceasedPatients = newState.patients.filter(p => p.status === 'deceased');
    if (deceasedPatients.length > 0) {
      newState.status = 'lost';
    }

    if (newState.patientsProcessed >= newState.targetPatients && newState.status === 'playing') {
      newState.status = 'won';
    }

    set({ gameState: newState });
  },

  endGame: (status: 'won' | 'lost') => {
    const { gameState } = get();
    if (!gameState) return;

    set({
      gameState: { ...gameState, status }
    });
  },

  saveGameRecord: () => {
    const { gameState, gameRecords } = get();
    if (!gameState) return;

    const levelConfig = levelConfigs.find(l => l.id === gameState.levelId);
    
    const record: GameRecord = {
      id: gameState.id,
      levelId: gameState.levelId,
      levelName: levelConfig?.name || '未知关卡',
      score: gameState.score,
      status: gameState.status,
      patientsProcessed: gameState.patientsProcessed,
      targetPatients: gameState.targetPatients,
      timestamp: Date.now(),
      duration: gameState.timeElapsed,
      failReasons: gameState.failReasons,
      actionHistory: gameState.actionHistory
    };

    const updatedRecords = [record, ...gameRecords].slice(0, 10);
    localStorage.setItem('triage_game_records', JSON.stringify(updatedRecords));
    set({ gameRecords: updatedRecords });
  },

  loadGameRecord: (gameId: string) => {
    const { gameRecords } = get();
    const record = gameRecords.find(r => r.id === gameId);
    if (!record) return;

    set({
      isReplayMode: true,
      currentReplayIndex: 0
    });
  },

  setReplayIndex: (index: number) => set({ currentReplayIndex: index }),
  clearReplay: () => set({ isReplayMode: false, currentReplayIndex: 0 })
}));
