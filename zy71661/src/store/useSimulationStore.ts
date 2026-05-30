import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Simulation, DataPoint, Note, Attachment, PhysicsParams } from '@/types/simulation';
import { runPhysicsSimulation } from '@/utils/physics/engine';
import { detectAllAnomalies } from '@/utils/anomaly/detector';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';
import { DEFAULT_GRAVITY, DEFAULT_FRICTION_COEFF, DEFAULT_AIR_DRAG_COEFF, DEFAULT_FRONTAL_AREA, DEFAULT_AIR_DENSITY, DEFAULT_RAMP_ANGLE, DEFAULT_RAMP_LENGTH, DEFAULT_SKATEBOARD_MASS } from '@/constants/physics';
import { SIMULATION_TIME_STEP, MAX_SIMULATION_TIME } from '@/constants/config';

type ActiveTab = 'energy' | 'force' | 'velocity';

interface SimulationState {
  currentSimulation: Simulation | null;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  selectedObjectId: string | null;
  activeTab: ActiveTab;
  setSimulation: (sim: Simulation) => void;
  updatePhysicsParams: (params: Partial<PhysicsParams>) => void;
  supplementData: (pointId: string, data: Partial<DataPoint>) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  selectObject: (id: string | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  addNote: (content: string, type: Note['type'], createdBy: string, isVerbal: boolean, relatedDataPointId?: string) => void;
  addAttachment: (name: string, type: Attachment['type'], url: string, size: number, uploadedBy: string) => void;
  confirmAnomaly: (anomalyId: string, confirmed: boolean, confirmedBy: string) => void;
  runSimulation: () => void;
  resetSimulation: () => void;
  createNewSimulation: (name: string, createdBy: string) => void;
}

function createDefaultSimulation(name: string, createdBy: string): Simulation {
  return {
    id: nanoid(),
    name,
    physicsParams: {
      rampAngle: DEFAULT_RAMP_ANGLE,
      rampLength: DEFAULT_RAMP_LENGTH,
      skateboardMass: DEFAULT_SKATEBOARD_MASS,
      frictionCoeff: DEFAULT_FRICTION_COEFF,
      airDragCoeff: DEFAULT_AIR_DRAG_COEFF,
      gravity: DEFAULT_GRAVITY,
      frontalArea: DEFAULT_FRONTAL_AREA,
      airDensity: DEFAULT_AIR_DENSITY,
    },
    dataPoints: [],
    anomalies: [],
    versions: [],
    attachments: [],
    notes: [],
    status: 'draft',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    createdBy,
  };
}

export const useSimulationStore = create<SimulationState>()(
  immer((set, get) => ({
    currentSimulation: null,
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    selectedObjectId: null,
    activeTab: 'energy',

    createNewSimulation: (name, createdBy) => {
      const sim = createDefaultSimulation(name, createdBy);
      const dataPoints = runPhysicsSimulation(sim.physicsParams, SIMULATION_TIME_STEP, MAX_SIMULATION_TIME);
      sim.dataPoints = dataPoints;
      sim.anomalies = detectAllAnomalies(sim);
      sim.versions = [{
        id: nanoid(),
        versionNumber: 1,
        changeSummary: '初始创建',
        diffData: JSON.stringify(sim),
        createdAt: dayjs().toISOString(),
        createdBy,
        importStatus: 'new',
      }];
      sim.updatedAt = dayjs().toISOString();
      set({ currentSimulation: sim, currentTime: 0, isPlaying: false });
    },

    setSimulation: (sim) => set({ currentSimulation: sim }),

    updatePhysicsParams: (params) => {
      set((state) => {
        if (!state.currentSimulation) return;
        Object.assign(state.currentSimulation.physicsParams, params);
        state.currentSimulation.updatedAt = dayjs().toISOString();
      });
      get().runSimulation();
    },

    supplementData: (pointId, data) => {
      set((state) => {
        if (!state.currentSimulation) return;
        const point = state.currentSimulation.dataPoints.find(p => p.id === pointId);
        if (point) {
          Object.assign(point, data, { isSupplemented: true, supplementedAt: dayjs().toISOString(), supplementedBy: '当前用户' });
          state.currentSimulation.updatedAt = dayjs().toISOString();
        }
      });
    },

    setCurrentTime: (time) => set({ currentTime: time }),

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

    selectObject: (id) => set({ selectedObjectId: id }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    addNote: (content, type, createdBy, isVerbal, relatedDataPointId) => {
      set((state) => {
        if (!state.currentSimulation) return;
        state.currentSimulation.notes.push({
          id: nanoid(),
          content,
          type,
          createdAt: dayjs().toISOString(),
          createdBy,
          isVerbal,
          relatedDataPointId,
        });
        state.currentSimulation.updatedAt = dayjs().toISOString();
      });
    },

    addAttachment: (name, type, url, size, uploadedBy) => {
      set((state) => {
        if (!state.currentSimulation) return;
        state.currentSimulation.attachments.push({
          id: nanoid(),
          name,
          type,
          url,
          size,
          uploadedAt: dayjs().toISOString(),
          uploadedBy,
        });
        state.currentSimulation.updatedAt = dayjs().toISOString();
      });
    },

    confirmAnomaly: (anomalyId, confirmed, confirmedBy) => {
      set((state) => {
        if (!state.currentSimulation) return;
        const anomaly = state.currentSimulation.anomalies.find(a => a.id === anomalyId);
        if (anomaly) {
          anomaly.isConfirmed = confirmed;
          anomaly.confirmedBy = confirmedBy;
          anomaly.confirmedAt = dayjs().toISOString();
          anomaly.resolution = confirmed ? '已确认' : '已否决';
        }
        state.currentSimulation.updatedAt = dayjs().toISOString();
      });
    },

    runSimulation: () => {
      set((state) => {
        if (!state.currentSimulation) return;
        const dataPoints = runPhysicsSimulation(
          state.currentSimulation.physicsParams,
          SIMULATION_TIME_STEP,
          MAX_SIMULATION_TIME
        );
        state.currentSimulation.dataPoints = dataPoints;
        state.currentSimulation.anomalies = detectAllAnomalies(state.currentSimulation);
        state.currentSimulation.updatedAt = dayjs().toISOString();
      });
    },

    resetSimulation: () => {
      set((state) => {
        if (!state.currentSimulation) return;
        state.currentTime = 0;
        state.isPlaying = false;
        state.selectedObjectId = null;
      });
    },
  }))
);
