import { create } from 'zustand';
import { Alert, CameraView, DriftReport, OrchardScene, ParticleData, SimulationParams } from '@/types';
import { sampleScenes } from '@/data/sampleScenes';

interface SimulationState {
  currentScene: OrchardScene;
  params: SimulationParams;
  isPlaying: boolean;
  simulationTime: number;
  particles: ParticleData[];
  alerts: Alert[];
  maxDriftDistance: number;
  cameraView: CameraView;
  windSpeedUnit: 'm_s' | 'km_h' | 'mph';

  setScene: (scene: OrchardScene) => void;
  setParams: (params: Partial<SimulationParams>) => void;
  setPlaying: (playing: boolean) => void;
  setSimulationTime: (time: number) => void;
  addParticles: (particles: ParticleData[]) => void;
  updateParticles: (particles: ParticleData[]) => void;
  clearParticles: () => void;
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp'>) => void;
  clearAlerts: () => void;
  setMaxDriftDistance: (distance: number) => void;
  setCameraView: (view: CameraView) => void;
  setWindSpeedUnit: (unit: 'm_s' | 'km_h' | 'mph') => void;
  resetSimulation: () => void;
  generateReport: () => DriftReport;
}

const defaultScene = sampleScenes[0];

export const useSimulationStore = create<SimulationState>((set, get) => ({
  currentScene: defaultScene,
  params: { ...defaultScene.defaultParams },
  isPlaying: false,
  simulationTime: 0,
  particles: [],
  alerts: [],
  maxDriftDistance: 0,
  cameraView: 'default',
  windSpeedUnit: 'm_s',

  setScene: (scene) => set({
    currentScene: scene,
    params: { ...scene.defaultParams },
    simulationTime: 0,
    particles: [],
    alerts: [],
    maxDriftDistance: 0,
    isPlaying: false,
  }),

  setParams: (newParams) => set((state) => ({
    params: { ...state.params, ...newParams },
  })),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setSimulationTime: (time) => set({ simulationTime: time }),

  addParticles: (newParticles) => set((state) => ({
    particles: [...state.particles, ...newParticles].slice(-2000),
  })),

  updateParticles: (particles) => set({ particles }),

  clearParticles: () => set({ particles: [] }),

  addAlert: (alert) => set((state) => {
    const exists = state.alerts.some(
      (a) => a.type === alert.type && a.fieldName === alert.fieldName &&
        Date.now() - a.timestamp < 2000
    );
    if (exists) return state;
    return {
      alerts: [
        ...state.alerts,
        {
          ...alert,
          id: `${alert.type}-${Date.now()}`,
          timestamp: Date.now(),
        },
      ].slice(-10),
    };
  }),

  clearAlerts: () => set({ alerts: [] }),

  setMaxDriftDistance: (distance) => set({ maxDriftDistance: distance }),

  setCameraView: (view) => set({ cameraView: view }),

  setWindSpeedUnit: (unit) => set({ windSpeedUnit: unit }),

  resetSimulation: () => set((state) => ({
    isPlaying: false,
    simulationTime: 0,
    particles: [],
    alerts: [],
    maxDriftDistance: 0,
  })),

  generateReport: () => {
    const state = get();
    const { currentScene, params, alerts, maxDriftDistance, simulationTime } = state;

    const affectedAreas = [...new Set(alerts.map((a) => a.fieldName).filter(Boolean) as string[])];

    let conclusion: 'safe' | 'warning' | 'unsafe' = 'safe';
    if (alerts.some((a) => a.severity === 'danger')) {
      conclusion = 'unsafe';
    } else if (alerts.some((a) => a.severity === 'warning')) {
      conclusion = 'warning';
    }

    const recommendations: string[] = [];
    if (conclusion === 'unsafe') {
      recommendations.push('立即调整喷药时间，选择风力较小的时段');
      recommendations.push('更换漂移风险较低的药剂类型');
      recommendations.push('降低喷头高度，减少雾化程度');
      recommendations.push('设置更大的安全缓冲区');
    } else if (conclusion === 'warning') {
      recommendations.push('建议在风力减弱后进行喷药');
      recommendations.push('可适当增加邻田侧的缓冲区');
    } else {
      recommendations.push('当前条件适宜喷药，可按计划进行');
      recommendations.push('建议持续监测风向变化');
    }

    return {
      sceneId: currentScene.id,
      sceneName: currentScene.name,
      simulationTime,
      params: { ...params },
      alerts: [...alerts],
      maxDriftDistance,
      affectedAreas,
      conclusion,
      recommendations,
      generatedAt: new Date().toLocaleString('zh-CN'),
    };
  },
}));