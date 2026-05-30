import { create } from 'zustand';
import {
  GameRecord,
  TrajectoryPoint,
  ParticleConfig,
  TrackElement,
  MagneticField,
  SimulationResult,
  MAX_SIMULATION_FRAMES,
} from '../types';
import {
  runFullSimulation,
  createInitialTrajectoryPoint,
  simulateStep,
} from '../engine/physics/lorentz';
import {
  checkTrackCollision,
  checkSuccess,
  isPointInTrack,
  findEndElement,
  findStartElement,
} from '../engine/collision/detector';
import { useHistoryStore } from './useHistoryStore';
import { diagnoseFailure } from '../utils/diagnosis';

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  currentFrame: number;
  playbackSpeed: number;
  showVectors: boolean;
  currentTrajectory: TrajectoryPoint[];
  currentRecord: GameRecord | null;
  simulationResult: SimulationResult | null;
  error: string | null;

  startSimulation: (
    trackElements: TrackElement[],
    magneticFields: MagneticField[],
    particleConfig: ParticleConfig,
    sampleSource: string | null,
    name?: string
  ) => void;
  runSimulationStep: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  stopSimulation: () => void;
  resetSimulation: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setShowVectors: (show: boolean) => void;
  seekToFrame: (frame: number) => void;
  loadRecordForReplay: (record: GameRecord) => void;
  setCurrentRecord: (record: GameRecord | null) => void;
  setCurrentTrajectory: (trajectory: TrajectoryPoint[]) => void;
  setSimulationResult: (result: SimulationResult | null) => void;
  clear: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  isRunning: false,
  isPaused: false,
  currentFrame: 0,
  playbackSpeed: 1,
  showVectors: true,
  currentTrajectory: [],
  currentRecord: null,
  simulationResult: null,
  error: null,

  startSimulation: (trackElements, magneticFields, particleConfig, sampleSource, name) => {
    const startElement = findStartElement(trackElements);
    const endElement = findEndElement(trackElements);

    if (!startElement) {
      set({ error: '缺少粒子源（起点），请先放置起点轨道片。' });
      return;
    }

    if (!endElement) {
      set({ error: '缺少终点靶，请先放置终点轨道片。' });
      return;
    }

    const startPos = {
      x: startElement.x + startElement.width / 2,
      y: startElement.y + startElement.height / 2,
    };

    const configWithStart: ParticleConfig = {
      ...particleConfig,
      startPosition: startPos,
    };

    const simResult = runFullSimulation(
      configWithStart,
      magneticFields,
      MAX_SIMULATION_FRAMES,
      (point) => checkTrackCollision(point, trackElements),
      (point) => checkSuccess(point, endElement),
      (point) => isPointInTrack(point.position, trackElements)
    );

    const trajectory = simResult.trajectory;
    const lastPoint = trajectory[trajectory.length - 1];

    let failureType: SimulationResult['failureType'] = null;
    let failureReason: string | null = null;

    if (!simResult.result.success) {
      if (simResult.result.collision) {
        const fieldEntry = trajectory.find((p) => p.magneticField !== null);
        if (fieldEntry && fieldEntry.magneticField) {
          const velStart = trajectory[0].velocity;
          const expectedDir = velStart.x > 0 ? 'outof' : 'into';

          if (
            (fieldEntry.magneticField.direction === 'into' && expectedDir === 'outof') ||
            (fieldEntry.magneticField.direction === 'outof' && expectedDir === 'into')
          ) {
            failureType = 'magnetic_direction';
            failureReason = '磁场方向与预期相反，导致粒子向错误方向偏转。';
          } else {
            const speed = Math.sqrt(
              lastPoint.velocity.x ** 2 + lastPoint.velocity.y ** 2
            );
            if (speed > 8e5) {
              failureType = 'high_energy';
              failureReason = '粒子初始能量过大，偏转半径超过轨道宽度。';
            } else {
              const outOfTrack = trajectory.find((p) => !p.inTrack);
              if (outOfTrack) {
                failureType = 'track_broken';
                failureReason = '轨道不连续，粒子飞出轨道范围。';
              } else {
                failureType = 'wall_collision';
                failureReason = '粒子碰撞轨道管壁。';
              }
            }
          }
        } else {
          failureType = 'wall_collision';
          failureReason = '粒子碰撞轨道管壁。';
        }
      } else if (simResult.result.maxFramesReached) {
        failureType = 'wall_collision';
        failureReason = '模拟超时，粒子未能在限定帧数内到达终点。';
      }
    }

    const result: SimulationResult = {
      success: simResult.result.success,
      failureType,
      failureReason,
      collisionPoint: simResult.result.collisionPoint,
      totalFrames: trajectory.length,
      totalTime: trajectory.length * 0.000001,
      finalEnergy: 0.5 * configWithStart.mass * (lastPoint.velocity.x ** 2 + lastPoint.velocity.y ** 2),
      finalPosition: { ...lastPoint.position },
    };

    const record: GameRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || `模拟记录 ${new Date().toLocaleString()}`,
      timestamp: Date.now(),
      sampleSource,
      trackElements: JSON.parse(JSON.stringify(trackElements)),
      magneticFields: JSON.parse(JSON.stringify(magneticFields)),
      particleConfig: JSON.parse(JSON.stringify(configWithStart)),
      trajectory,
      result,
    };

    const diagnosis = diagnoseFailure(
      record.result,
      record.trajectory,
      record.trackElements,
      record.magneticFields,
      record.particleConfig
    );
    if (!diagnosis.success) {
      record.result.failureType = diagnosis.failureType;
      record.result.failureReason = diagnosis.summary;
    }

    useHistoryStore.getState().addRecord(record);

    set({
      isRunning: true,
      isPaused: false,
      currentFrame: 0,
      currentTrajectory: trajectory,
      currentRecord: record,
      simulationResult: result,
      error: null,
    });
  },

  runSimulationStep: () => {
    const { currentFrame, currentTrajectory, isRunning, isPaused } = get();
    if (!isRunning || isPaused) return;
    if (currentFrame >= currentTrajectory.length - 1) {
      set({ isRunning: false });
      return;
    }
    set({ currentFrame: currentFrame + 1 });
  },

  pauseSimulation: () => set({ isPaused: true }),

  resumeSimulation: () => set({ isPaused: false }),

  stopSimulation: () => set({ isRunning: false, isPaused: false }),

  resetSimulation: () =>
    set({
      currentFrame: 0,
      isRunning: false,
      isPaused: false,
    }),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setShowVectors: (show) => set({ showVectors: show }),

  seekToFrame: (frame) => {
    const { currentTrajectory } = get();
    const clampedFrame = Math.max(0, Math.min(frame, currentTrajectory.length - 1));
    set({ currentFrame: clampedFrame });
  },

  loadRecordForReplay: (record) => {
    set({
      isRunning: false,
      isPaused: false,
      currentFrame: 0,
      currentTrajectory: record.trajectory,
      currentRecord: record,
      simulationResult: record.result,
      error: null,
    });
  },

  setCurrentRecord: (record) =>
    set({
      currentRecord: record,
    }),

  setCurrentTrajectory: (trajectory) =>
    set({
      currentTrajectory: trajectory,
    }),

  setSimulationResult: (result) =>
    set({
      simulationResult: result,
    }),

  clear: () =>
    set({
      isRunning: false,
      isPaused: false,
      currentFrame: 0,
      currentTrajectory: [],
      currentRecord: null,
      simulationResult: null,
      error: null,
    }),
}));
