import { create } from 'zustand';
import { SimulationParams, SimulationResult, SourceInfo, RiskType } from '../types';
import { createSimulationEngine } from '../engine/simulationEngine';

const defaultSourceInfo: SourceInfo = {
  documentName: '',
  documentVersion: '',
  provider: '',
  remarks: ''
};

interface SimulationState {
  params: SimulationParams;
  result: SimulationResult | null;
  isRunning: boolean;
  selectedRisk: RiskType | null;
  selectedPointIndex: number | null;
  
  setParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  setSourceInfo: (paramKey: string, sourceInfo: Partial<SourceInfo>) => void;
  runSimulation: () => void;
  clearResult: () => void;
  setSelectedRisk: (risk: RiskType | null) => void;
  setSelectedPointIndex: (index: number | null) => void;
  resetParams: () => void;
}

const getDefaultParams = (): SimulationParams => ({
  probeMass: 800,
  probeMassSource: { ...defaultSourceInfo, documentName: '探测器质量规格书', documentVersion: 'v1.0', provider: '航天八院' },
  
  parachuteArea: 200,
  parachuteAreaSource: { ...defaultSourceInfo, documentName: '降落伞设计报告', documentVersion: 'v2.1', provider: '航天气动院' },
  deploymentAltitude: 8000,
  deploymentAltitudeSource: { ...defaultSourceInfo, documentName: 'EDL方案设计', documentVersion: 'v1.5', provider: '总体设计部' },
  
  atmosphericDensity: 0.02,
  atmosphericDensitySource: { ...defaultSourceInfo, documentName: '火星大气模型', documentVersion: 'v3.0', provider: '天文观测中心' },
  
  initialVelocity: 1500,
  initialVelocitySource: { ...defaultSourceInfo, documentName: '轨道参数报告', documentVersion: 'v1.2', provider: '测控中心' },
  initialAltitude: 125000,
  initialAltitudeSource: { ...defaultSourceInfo, documentName: '轨道参数报告', documentVersion: 'v1.2', provider: '测控中心' },
  
  batchId: `BATCH-${Date.now().toString().slice(-6)}`,
  operator: '演示员',
  timestamp: new Date()
});

export const useSimulationStore = create<SimulationState>((set, get) => ({
  params: getDefaultParams(),
  result: null,
  isRunning: false,
  selectedRisk: null,
  selectedPointIndex: null,

  setParam: (key, value) => set((state) => ({
    params: { ...state.params, [key]: value }
  })),

  setSourceInfo: (paramKey, sourceInfo) => set((state) => {
    const sourceKey = `${paramKey}Source` as keyof SimulationParams;
    const currentSource = state.params[sourceKey] as SourceInfo;
    return {
      params: {
        ...state.params,
        [sourceKey]: { ...currentSource, ...sourceInfo }
      }
    };
  }),

  runSimulation: () => {
    set({ isRunning: true });
    const engine = createSimulationEngine(0.1);
    const result = engine.run(get().params);
    set({ result, isRunning: false });
  },

  clearResult: () => set({ result: null }),

  setSelectedRisk: (risk) => set({ selectedRisk: risk }),

  setSelectedPointIndex: (index) => set({ selectedPointIndex: index }),

  resetParams: () => set({ params: getDefaultParams(), result: null })
}));
