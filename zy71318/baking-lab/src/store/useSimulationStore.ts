import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SimulationResult, SimulationParams, SimulationStatus, ValidationError } from '../types';
import { runSimulation, generateCurveReport } from '../utils/heatTransfer';
import { validateSimulationParams, generateParamSignature, validateStateTransition } from '../utils/validation';
import { MOLD_MATERIALS } from '../data/materials';

interface SimulationStore {
  simulations: SimulationResult[];
  selectedSimulations: string[];
  status: SimulationStatus;
  currentSimulation: SimulationResult | null;
  progress: number;
  errors: ValidationError[];
  paramSignatures: string[];
  
  addSimulation: (params: SimulationParams) => Promise<SimulationResult | null>;
  removeSimulation: (id: string) => void;
  clearSimulations: () => void;
  toggleSimulationSelection: (id: string) => void;
  selectAllSimulations: () => void;
  deselectAllSimulations: () => void;
  validateParams: (params: Partial<SimulationParams>) => ValidationError[];
  exportReport: (id: string) => void;
  exportChartData: (ids: string[]) => string;
  setStatus: (status: SimulationStatus) => void;
}

export const useSimulationStore = create<SimulationStore>()(
  persist(
    (set, get) => ({
      simulations: [],
      selectedSimulations: [],
      status: 'idle',
      currentSimulation: null,
      progress: 0,
      errors: [],
      paramSignatures: [],

      validateParams: (params: Partial<SimulationParams>) => {
        const { paramSignatures } = get();
        const result = validateSimulationParams(params, paramSignatures);
        set({ errors: result.errors });
        return result.errors;
      },

      addSimulation: async (params: SimulationParams) => {
        const { status, paramSignatures } = get();
        
        if (!validateStateTransition(status, 'running')) {
          set({ errors: [{ field: 'status', message: '当前状态不允许运行新的模拟', code: 'INVALID_STATE' }] });
          return null;
        }

        const validation = validateSimulationParams(params, paramSignatures);
        if (!validation.valid) {
          set({ errors: validation.errors });
          return null;
        }

        const material = MOLD_MATERIALS.find(m => m.id === params.materialId);
        if (!material) {
          set({ errors: [{ field: 'materialId', message: '材料不存在', code: 'MATERIAL_NOT_FOUND' }] });
          return null;
        }

        set({ status: 'running', progress: 0, errors: [] });

        try {
          const result = await runSimulation(params, material, (progress) => {
            set({ progress });
          });

          const signature = generateParamSignature(params);
          
          set(state => ({
            simulations: [...state.simulations, result],
            selectedSimulations: [...state.selectedSimulations, result.id],
            paramSignatures: [...state.paramSignatures, signature],
            currentSimulation: result,
            status: 'completed',
            progress: 100
          }));

          return result;
        } catch (error) {
          set({ 
            status: 'idle', 
            progress: 0,
            errors: [{ field: 'simulation', message: '模拟运行失败: ' + (error as Error).message, code: 'SIMULATION_ERROR' }]
          });
          return null;
        }
      },

      removeSimulation: (id: string) => {
        set(state => {
          const simulation = state.simulations.find(s => s.id === id);
          if (!simulation) return state;
          
          const signature = generateParamSignature(simulation.params);
          
          return {
            simulations: state.simulations.filter(s => s.id !== id),
            selectedSimulations: state.selectedSimulations.filter(sid => sid !== id),
            paramSignatures: state.paramSignatures.filter(sig => sig !== signature),
            currentSimulation: state.currentSimulation?.id === id ? null : state.currentSimulation
          };
        });
      },

      clearSimulations: () => {
        set({ 
          simulations: [], 
          selectedSimulations: [], 
          currentSimulation: null,
          paramSignatures: [],
          status: 'idle'
        });
      },

      toggleSimulationSelection: (id: string) => {
        set(state => ({
          selectedSimulations: state.selectedSimulations.includes(id)
            ? state.selectedSimulations.filter(sid => sid !== id)
            : [...state.selectedSimulations, id]
        }));
      },

      selectAllSimulations: () => {
        set(state => ({
          selectedSimulations: state.simulations.map(s => s.id)
        }));
      },

      deselectAllSimulations: () => {
        set({ selectedSimulations: [] });
      },

      exportReport: (id: string) => {
        const { simulations } = get();
        const simulation = simulations.find(s => s.id === id);
        if (!simulation) return;

        const report = generateCurveReport(simulation);
        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `温度曲线报告_${simulation.material.name}_${new Date(simulation.createdAt).toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      exportChartData: (ids: string[]) => {
        const { simulations } = get();
        const selected = simulations.filter(s => ids.includes(s.id));
        
        const csvContent = [
          ['时间(秒)', ...selected.map(s => s.material.name + '(°C)')].join(','),
          ...selected[0]?.temperatureCurve.map((_, i) => {
            const time = selected[0].temperatureCurve[i]?.time.toFixed(1) || '';
            const temps = selected.map(s => s.temperatureCurve[i]?.temperature.toFixed(2) || '');
            return [time, ...temps].join(',');
          }) || []
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `温度曲线对比_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return csvContent;
      },

      setStatus: (status: SimulationStatus) => {
        set({ status });
      }
    }),
    {
      name: 'baking-simulation-storage',
      partialize: (state) => ({
        simulations: state.simulations,
        selectedSimulations: state.selectedSimulations,
        paramSignatures: state.paramSignatures
      })
    }
  )
);
