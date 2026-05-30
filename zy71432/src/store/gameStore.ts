import { create } from 'zustand';
import type {
  CarParams,
  WingConfig,
  WindConfig,
  GameStatus,
  LapRecord,
  FrameData,
  DiagnosticIssue,
  PhysicsState,
  Position
} from '../types';
import {
  DEFAULT_CAR,
  DEFAULT_WING,
  DEFAULT_WIND,
  wingAngleToFactors,
  PHYSICS_DT
} from '../physics/constants';
import { calculateAerodynamics } from '../physics/aerodynamics';
import { calculateGrip, updatePhysicsState } from '../physics/dynamics';
import { getCurvature, getSector, moveAlongTrack, getTrackPoint, getSectorStartProgress, getTrackLength } from '../physics/track';
import { detectIssues } from '../diagnostics/detectors';

interface GameState {
  status: GameStatus;
  carParams: CarParams;
  wingConfig: WingConfig;
  windConfig: WindConfig;
  currentPhysics: PhysicsState;
  trackProgress: number;
  position: Position;
  heading: number;
  currentTime: number;
  sectorTimes: [number, number, number];
  lastSector: number;
  frameCount: number;
  currentLap: LapRecord | null;
  lapHistory: LapRecord[];
  currentIssues: DiagnosticIssue[];
  isPaused: boolean;
  lockedParams: {
    car: boolean;
    wing: boolean;
    wind: boolean;
  };
  showResults: boolean;

  setCarParams: (params: Partial<CarParams>, source?: string) => void;
  setWingAngle: (angle: number, source?: string) => void;
  setWindSpeed: (speed: number, source?: string) => void;
  setWindDirection: (direction: number, source?: string) => void;
  importCarData: (data: Partial<CarParams>, source: string) => void;
  importWingData: (data: { angle: number }, source: string) => void;
  importWindData: (data: { speed: number; direction?: number }, source: string) => void;
  toggleParamLock: (param: 'car' | 'wing' | 'wind') => void;

  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  finishGame: () => void;
  closeResults: () => void;

  updateGame: () => void;
  resetToIdle: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const createInitialPhysics = (): PhysicsState => ({
  speed: 0,
  acceleration: 0,
  dragForce: 0,
  downForce: 0,
  grip: DEFAULT_CAR.tireGrip,
  effectivePower: 0,
  relativeWindSpeed: 0
});

const createInitialCar = (): CarParams => ({
  id: generateId(),
  source: 'default',
  importTime: Date.now(),
  rawData: JSON.stringify(DEFAULT_CAR),
  ...DEFAULT_CAR
});

const createInitialWing = (): WingConfig => {
  const { dragFactor, liftFactor } = wingAngleToFactors(DEFAULT_WING.angle);
  return {
    id: generateId(),
    source: 'default',
    importTime: Date.now(),
    rawData: JSON.stringify({ angle: DEFAULT_WING.angle }),
    angle: DEFAULT_WING.angle,
    dragFactor,
    liftFactor
  };
};

const createInitialWind = (): WindConfig => ({
  id: generateId(),
  source: 'default',
  importTime: Date.now(),
  rawData: JSON.stringify(DEFAULT_WIND),
  ...DEFAULT_WIND
});

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  carParams: createInitialCar(),
  wingConfig: createInitialWing(),
  windConfig: createInitialWind(),
  currentPhysics: createInitialPhysics(),
  trackProgress: 0,
  position: { x: getTrackPoint(0).x, y: getTrackPoint(0).y },
  heading: 0,
  currentTime: 0,
  sectorTimes: [0, 0, 0],
  lastSector: 0,
  frameCount: 0,
  currentLap: null,
  lapHistory: [],
  currentIssues: [],
  isPaused: false,
  lockedParams: { car: false, wing: false, wind: false },
  showResults: false,

  setCarParams: (params, source = 'manual') => {
    const state = get();
    if (state.lockedParams.car) return;
    
    const newParams = { ...state.carParams, ...params };
    newParams.rawData = JSON.stringify(params);
    newParams.source = source;
    newParams.importTime = Date.now();
    if (source !== state.carParams.source) {
      newParams.id = generateId();
    }
    set({ carParams: newParams });
  },

  setWingAngle: (angle, source = 'manual') => {
    const state = get();
    if (state.lockedParams.wing) return;
    
    const { dragFactor, liftFactor } = wingAngleToFactors(angle);
    const newConfig: WingConfig = {
      ...state.wingConfig,
      angle,
      dragFactor,
      liftFactor,
      source,
      importTime: Date.now(),
      rawData: JSON.stringify({ angle }),
      id: source !== state.wingConfig.source ? generateId() : state.wingConfig.id
    };
    set({ wingConfig: newConfig });
  },

  setWindSpeed: (speed, source = 'manual') => {
    const state = get();
    if (state.lockedParams.wind) return;
    
    const newConfig: WindConfig = {
      ...state.windConfig,
      speed,
      source,
      importTime: Date.now(),
      rawData: JSON.stringify({ speed, direction: state.windConfig.direction }),
      id: source !== state.windConfig.source ? generateId() : state.windConfig.id
    };
    set({ windConfig: newConfig });
  },

  setWindDirection: (direction, source = 'manual') => {
    const state = get();
    if (state.lockedParams.wind) return;
    
    const newConfig: WindConfig = {
      ...state.windConfig,
      direction,
      source,
      importTime: Date.now(),
      rawData: JSON.stringify({ speed: state.windConfig.speed, direction }),
      id: source !== state.windConfig.source ? generateId() : state.windConfig.id
    };
    set({ windConfig: newConfig });
  },

  importCarData: (data, source) => {
    const state = get();
    const newParams = {
      ...state.carParams,
      ...data,
      id: generateId(),
      source,
      importTime: Date.now(),
      rawData: JSON.stringify(data)
    };
    set({ carParams: newParams });
  },

  importWingData: (data, source) => {
    const { dragFactor, liftFactor } = wingAngleToFactors(data.angle);
    const newConfig: WingConfig = {
      id: generateId(),
      angle: data.angle,
      dragFactor,
      liftFactor,
      source,
      importTime: Date.now(),
      rawData: JSON.stringify(data)
    };
    set({ wingConfig: newConfig });
  },

  importWindData: (data, source) => {
    const newConfig: WindConfig = {
      id: generateId(),
      speed: data.speed,
      direction: data.direction ?? 0,
      source,
      importTime: Date.now(),
      rawData: JSON.stringify(data)
    };
    set({ windConfig: newConfig });
  },

  toggleParamLock: (param) => {
    set((state) => ({
      lockedParams: {
        ...state.lockedParams,
        [param]: !state.lockedParams[param]
      }
    }));
  },

  startGame: () => {
    const state = get();
    const startPos = getTrackPoint(0);
    const startHeading = Math.atan2(
      getTrackPoint(0.002).y - startPos.y,
      getTrackPoint(0.002).x - startPos.x
    ) * 180 / Math.PI;

    const newLap: LapRecord = {
      id: generateId(),
      carId: state.carParams.id,
      wingId: state.wingConfig.id,
      windId: state.windConfig.id,
      totalTime: 0,
      sectorTimes: [0, 0, 0],
      maxSpeed: 0,
      avgSpeed: 0,
      status: 'running',
      startTime: Date.now(),
      endTime: 0,
      frameData: [],
      issues: [],
      carParams: { ...state.carParams },
      wingConfig: { ...state.wingConfig },
      windConfig: { ...state.windConfig }
    };

    set({
      status: 'running',
      isPaused: false,
      currentTime: 0,
      trackProgress: 0,
      position: { x: startPos.x, y: startPos.y },
      heading: startHeading,
      currentPhysics: createInitialPhysics(),
      sectorTimes: [0, 0, 0],
      lastSector: 0,
      frameCount: 0,
      currentLap: newLap,
      currentIssues: [],
      showResults: false
    });
  },

  pauseGame: () => {
    set((state) => ({
      status: 'paused',
      isPaused: true,
      currentLap: state.currentLap ? { ...state.currentLap, status: 'paused' } : null
    }));
  },

  resumeGame: () => {
    set((state) => ({
      status: 'running',
      isPaused: false,
      currentLap: state.currentLap ? { ...state.currentLap, status: 'running' } : null
    }));
  },

  restartGame: () => {
    get().startGame();
  },

  finishGame: () => {
    const state = get();
    if (!state.currentLap) return;

    const completedLap: LapRecord = {
      ...state.currentLap,
      status: 'completed',
      endTime: Date.now(),
      totalTime: state.currentTime,
      maxSpeed: Math.max(...state.currentLap.frameData.map(f => f.physics.speed * 3.6)),
      avgSpeed: state.currentTime > 0 
        ? (get().trackProgress * getTrackLength() / 1000) / (state.currentTime / 3600)
        : 0
    };

    set((state) => ({
      status: 'finished',
      currentLap: completedLap,
      lapHistory: [...state.lapHistory, completedLap],
      showResults: true
    }));
  },

  closeResults: () => {
    set({ showResults: false });
  },

  updateGame: () => {
    const state = get();
    if (state.status !== 'running' || state.isPaused) return;

    const curvature = getCurvature(state.trackProgress);
    
    const aero = calculateAerodynamics(
      state.currentPhysics.speed,
      state.carParams,
      state.wingConfig,
      state.windConfig,
      state.heading
    );

    const gripResult = calculateGrip(state.carParams, aero.downForce);
    
    const newPhysics = updatePhysicsState(
      state.currentPhysics,
      state.carParams,
      aero.dragForce,
      aero.downForce,
      gripResult.grip,
      curvature,
      aero.relativeWindSpeed
    );

    const distance = newPhysics.speed * PHYSICS_DT;
    const { newProgress, position, heading } = moveAlongTrack(state.trackProgress, distance);
    
    const sector = getSector(newProgress);
    let newSectorTimes = [...state.sectorTimes] as [number, number, number];
    
    if (sector !== state.lastSector) {
      const sectorStart = getSectorStartProgress(state.lastSector + 1);
      if (newProgress >= sectorStart || state.lastSector === 2) {
        newSectorTimes[state.lastSector] = state.currentTime - state.sectorTimes.slice(0, state.lastSector).reduce((a, b) => a + b, 0);
      }
    }

    const frameData: FrameData = {
      frameNumber: state.frameCount,
      timestamp: state.currentTime,
      position,
      heading,
      physics: { ...newPhysics },
      params: {
        wingAngle: state.wingConfig.angle,
        windSpeed: state.windConfig.speed,
        windDirection: state.windConfig.direction
      },
      sourceTag: `${state.carParams.source}-${state.wingConfig.source}-${state.windConfig.source}`,
      trackProgress: newProgress,
      sector
    };

    const issues = detectIssues(
      frameData,
      state.currentLap?.issues || [],
      state.carParams,
      state.wingConfig,
      state.windConfig,
      curvature
    );

    const newLap = state.currentLap ? {
      ...state.currentLap,
      frameData: [...state.currentLap.frameData, frameData],
      issues
    } : null;

    const lapComplete = newProgress < state.trackProgress && state.currentTime > 5;

    if (lapComplete) {
      const finalLap = newLap ? {
        ...newLap,
        status: 'completed' as const,
        endTime: Date.now(),
        totalTime: state.currentTime,
        sectorTimes: newSectorTimes,
        maxSpeed: Math.max(...newLap.frameData.map(f => f.physics.speed * 3.6)),
        avgSpeed: state.currentTime > 0 
          ? (getTrackLength() / 1000) / (state.currentTime / 3600)
          : 0
      } : null;

      set((state) => ({
        status: 'finished',
        currentLap: finalLap,
        lapHistory: finalLap ? [...state.lapHistory, finalLap] : state.lapHistory,
        currentIssues: issues,
        showResults: true
      }));
      return;
    }

    set({
      currentPhysics: newPhysics,
      trackProgress: newProgress,
      position,
      heading,
      currentTime: state.currentTime + PHYSICS_DT,
      frameCount: state.frameCount + 1,
      lastSector: sector,
      sectorTimes: newSectorTimes,
      currentLap: newLap,
      currentIssues: issues.filter(i => i.endTime === -1 || i.endTime >= state.currentTime - 0.5)
    });
  },

  resetToIdle: () => {
    set({
      status: 'idle',
      currentTime: 0,
      trackProgress: 0,
      position: { x: getTrackPoint(0).x, y: getTrackPoint(0).y },
      heading: 0,
      currentPhysics: createInitialPhysics(),
      sectorTimes: [0, 0, 0],
      lastSector: 0,
      frameCount: 0,
      currentLap: null,
      currentIssues: [],
      isPaused: false,
      showResults: false
    });
  }
}));
