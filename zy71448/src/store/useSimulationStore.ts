import { create } from 'zustand';
import * as THREE from 'three';
import { SimulationState, Attitude, EvidenceItem, TrajectoryPoint } from '../types';
import {
  getSailNormal,
  calculateRadiationPressure,
  calculateGravitationalAcceleration,
  verletIntegration,
  checkTrajectoryDivergence,
  calculateConclusion,
} from '../physics/solarSailPhysics';

const initialAttitude: Attitude = {
  alpha: 0,
  beta: 0,
  gamma: 0,
  unit: 'deg',
};

const initialPosition = new THREE.Vector3(5, 0, 0);
const initialVelocity = new THREE.Vector3(0, 2, 0);

export const useSimulationStore = create<SimulationState & {
  setIsPlaying: (playing: boolean) => void;
  setTimeScale: (scale: number) => void;
  setCurrentTime: (time: number) => void;
  setAttitude: (attitude: Partial<Attitude>) => void;
  setPressureReversed: (reversed: boolean) => void;
  resetSimulation: () => void;
  updateSimulation: (deltaTime: number) => void;
  addEvidence: (type: EvidenceItem['type'], description: string, data: Record<string, unknown>) => void;
  clearEvidence: () => void;
}>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  timeScale: 1,
  attitude: initialAttitude,
  radiationPressure: {
    direction: new THREE.Vector3(-1, 0, 0),
    magnitude: 0,
    isReversed: false,
  },
  trajectory: [],
  spacecraftPosition: initialPosition.clone(),
  spacecraftVelocity: initialVelocity.clone(),
  evidenceLog: [],
  conclusion: 'consistent',

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  setTimeScale: (scale) => set({ timeScale: scale }),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  
  setAttitude: (newAttitude) => {
    const current = get();
    const updatedAttitude = { ...current.attitude, ...newAttitude };
    
    set({ attitude: updatedAttitude });
    
    get().addEvidence('attitude-change', '姿态角已更新', {
      old: current.attitude,
      new: updatedAttitude,
    });
  },
  
  setPressureReversed: (reversed) => {
    const current = get();
    set({
      radiationPressure: { ...current.radiationPressure, isReversed: reversed },
    });
    
    get().addEvidence('pressure-calc', `光压方向${reversed ? '已反向' : '已恢复'}`, {
      isReversed: reversed,
    });
  },
  
  resetSimulation: () => {
    set({
      isPlaying: false,
      currentTime: 0,
      trajectory: [],
      spacecraftPosition: initialPosition.clone(),
      spacecraftVelocity: initialVelocity.clone(),
      evidenceLog: [],
      conclusion: 'consistent',
    });
  },
  
  updateSimulation: (deltaTime) => {
    const state = get();
    if (!state.isPlaying) return;
    
    const dt = deltaTime * state.timeScale * 0.5;
    const newTime = state.currentTime + dt;
    
    const sunDirection = new THREE.Vector3(-1, 0, 0);
    const sailNormal = getSailNormal(state.attitude);
    
    const { acceleration: pressureAccel, magnitude } = calculateRadiationPressure(
      sailNormal,
      sunDirection,
      state.radiationPressure.isReversed
    );
    
    const gravityAccel = calculateGravitationalAcceleration(state.spacecraftPosition);
    const totalAccel = pressureAccel.add(gravityAccel).multiplyScalar(1000);
    
    const { newPosition, newVelocity } = verletIntegration(
      state.spacecraftPosition,
      state.spacecraftVelocity,
      totalAccel,
      dt
    );
    
    const newTrajectoryPoint: TrajectoryPoint = {
      position: newPosition.clone(),
      velocity: newVelocity.clone(),
      timestamp: newTime,
    };
    
    const newTrajectory = [...state.trajectory, newTrajectoryPoint];
    if (newTrajectory.length > 1000) {
      newTrajectory.shift();
    }
    
    const { isDivergent } = checkTrajectoryDivergence(newTrajectory);
    const conclusion = calculateConclusion(
      state.attitude,
      state.radiationPressure.isReversed,
      isDivergent
    );
    
    if (isDivergent && state.conclusion !== 'inconsistent') {
      get().addEvidence('trajectory-event', '检测到轨迹发散', {
        time: newTime,
        position: { x: newPosition.x, y: newPosition.y, z: newPosition.z },
      });
    }
    
    set({
      currentTime: newTime,
      spacecraftPosition: newPosition,
      spacecraftVelocity: newVelocity,
      trajectory: newTrajectory,
      radiationPressure: {
        ...state.radiationPressure,
        magnitude,
      },
      conclusion,
    });
  },
  
  addEvidence: (type, description, data) => {
    const state = get();
    const evidence: EvidenceItem = {
      timestamp: state.currentTime,
      type,
      description,
      data,
    };
    set({ evidenceLog: [...state.evidenceLog, evidence] });
  },
  
  clearEvidence: () => set({ evidenceLog: [] }),
}));
