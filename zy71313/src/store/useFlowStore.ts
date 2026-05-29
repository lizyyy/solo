import { create } from 'zustand';
import type {
  LengthUnit,
  VelocityUnit,
  DensityUnit,
  ViscosityUnit,
  TemperatureUnit,
  ParameterWithUnit,
  CalculationResult,
  SampleRecord,
} from '@/types';
import { calculate } from '@/utils/calculator';
import { sampleRecords } from '@/data/samples';

interface FlowStore {
  pipeDiameter: ParameterWithUnit<LengthUnit>;
  velocity: ParameterWithUnit<VelocityUnit>;
  density: ParameterWithUnit<DensityUnit>;
  viscosity: ParameterWithUnit<ViscosityUnit>;
  temperature: ParameterWithUnit<TemperatureUnit>;
  result: CalculationResult | null;
  currentSampleId: string | null;
  currentSampleName: string | null;
  calculationTime: string | null;

  setPipeDiameter: (value: number | null, unit?: LengthUnit) => void;
  setVelocity: (value: number | null, unit?: VelocityUnit) => void;
  setDensity: (value: number | null, unit?: DensityUnit) => void;
  setViscosity: (value: number | null, unit?: ViscosityUnit) => void;
  setTemperature: (value: number | null, unit?: TemperatureUnit) => void;
  calculateRe: () => void;
  loadSample: (sample: SampleRecord) => void;
  clearAll: () => void;
  getSamples: () => SampleRecord[];
}

const initialState = {
  pipeDiameter: { value: null, unit: 'mm' as LengthUnit },
  velocity: { value: null, unit: 'm/s' as VelocityUnit },
  density: { value: null, unit: 'kg/m³' as DensityUnit },
  viscosity: { value: null, unit: 'mPa·s' as ViscosityUnit },
  temperature: { value: null, unit: '℃' as TemperatureUnit },
  result: null as CalculationResult | null,
  currentSampleId: null as string | null,
  currentSampleName: null as string | null,
  calculationTime: null as string | null,
};

export const useFlowStore = create<FlowStore>((set, get) => ({
  ...initialState,

  setPipeDiameter: (value, unit) =>
    set((s) => ({ pipeDiameter: { value, unit: unit ?? s.pipeDiameter.unit }, result: null })),

  setVelocity: (value, unit) =>
    set((s) => ({ velocity: { value, unit: unit ?? s.velocity.unit }, result: null })),

  setDensity: (value, unit) =>
    set((s) => ({ density: { value, unit: unit ?? s.density.unit }, result: null })),

  setViscosity: (value, unit) =>
    set((s) => ({ viscosity: { value, unit: unit ?? s.viscosity.unit }, result: null })),

  setTemperature: (value, unit) =>
    set((s) => ({ temperature: { value, unit: unit ?? s.temperature.unit }, result: null })),

  calculateRe: () => {
    const s = get();
    const result = calculate(s.pipeDiameter, s.velocity, s.density, s.viscosity, s.temperature);
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    set({ result, calculationTime: timeStr });
  },

  loadSample: (sample) => {
    set({
      pipeDiameter: { ...sample.pipeDiameter },
      velocity: { ...sample.velocity },
      density: { ...sample.density },
      viscosity: { ...sample.viscosity },
      temperature: { ...sample.temperature },
      result: null,
      currentSampleId: sample.id,
      currentSampleName: sample.name,
      calculationTime: null,
    });
  },

  clearAll: () => set({ ...initialState }),

  getSamples: () => sampleRecords,
}));
