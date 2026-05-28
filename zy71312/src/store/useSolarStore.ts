import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SolarParams,
  SolarResults,
  Scenario,
  ShadingPeriod,
  SeasonWeights,
  Warnings,
  OptimizationStrategy,
} from '../types';
import { optimizeAngle, findOptimalAngleBySeason } from '../engine/angleOptimize';
import { calculateShadingLoss, validateShadingPeriods } from '../engine/shadingCalc';
import {
  calculateAnnualEnergy,
  calculateProfit,
  calculateSystemCost,
} from '../engine/profitCalc';

interface SolarState {
  params: SolarParams;
  results: SolarResults;
  warnings: Warnings;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  optimizationStrategy: OptimizationStrategy;
  useCustomAngle: boolean;

  setCity: (city: string, latitude: number) => void;
  setLatitude: (latitude: number) => void;
  setRoofAngle: (angle: number) => void;
  setRoofAzimuth: (azimuth: number) => void;
  addShadingPeriod: (period: Omit<ShadingPeriod, 'id'>) => void;
  removeShadingPeriod: (id: string) => void;
  updateShadingPeriod: (id: string, period: Partial<ShadingPeriod>) => void;
  setPanelParams: (params: Partial<SolarParams>) => void;
  setElectricityPrice: (price: number) => void;
  setSeasonWeights: (weights: Partial<SeasonWeights>) => void;
  setOptimizationStrategy: (strategy: OptimizationStrategy) => void;
  setUseCustomAngle: (use: boolean) => void;
  setCustomAngle: (angle: number) => void;
  calculateAll: () => void;
  saveScenario: (name: string) => void;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  resetToDefaults: () => void;
}

const defaultParams: SolarParams = {
  city: '上海',
  latitude: 31.2,
  roofAngle: 30,
  roofAzimuth: 180,
  shadingPeriods: [],
  panelPower: 550,
  panelCount: 20,
  panelEfficiency: 21.6,
  panelPrice: 1.8,
  electricityPrice: 0.6,
  seasonWeights: {
    spring: 1,
    summer: 1,
    autumn: 1,
    winter: 1,
  },
  customAngle: undefined,
};

const defaultResults: SolarResults = {
  optimalAngle: 30,
  optimalAngleReason: '',
  annualEnergy: 0,
  shadingLoss: 0,
  shadingLossReason: '',
  annualProfit: 0,
  paybackYears: 0,
  monthlyEnergy: [],
  hourlyEnergy: [],
};

function validateLatitude(latitude: number): string | undefined {
  if (latitude < -90 || latitude > 90) {
    return '纬度应在-90°到90°之间';
  }
  if (latitude < 0) {
    return '注意：当前为南半球纬度，计算逻辑已自动适配';
  }
  if (latitude === 0) {
    return '位于赤道地区，倾角建议在0°-15°之间';
  }
  if (latitude > 60 || latitude < -60) {
    return '高纬度地区，冬季光照时间较短';
  }
  return undefined;
}

function validateSeasonWeights(weights: SeasonWeights): string | undefined {
  const total = weights.spring + weights.summer + weights.autumn + weights.winter;
  if (total === 0) {
    return '季节权重不能全部为0，已自动重置为默认值';
  }
  if (weights.summer > weights.winter * 3) {
    return '夏季权重显著高于冬季，建议确认是否需要夏季优化';
  }
  if (weights.winter > weights.summer * 3) {
    return '冬季权重显著高于夏季，建议确认是否需要冬季优化';
  }
  return undefined;
}

export const useSolarStore = create<SolarState>()(
  persist(
    (set, get) => ({
      params: defaultParams,
      results: defaultResults,
      warnings: {},
      scenarios: [],
      activeScenarioId: null,
      optimizationStrategy: 'yearly',
      useCustomAngle: false,

      setCity: (city, latitude) => {
        set((state) => ({
          params: { ...state.params, city, latitude },
          warnings: {
            ...state.warnings,
            latitudeWarning: validateLatitude(latitude),
          },
        }));
        get().calculateAll();
      },

      setLatitude: (latitude) => {
        set((state) => ({
          params: { ...state.params, latitude },
          warnings: {
            ...state.warnings,
            latitudeWarning: validateLatitude(latitude),
          },
        }));
        get().calculateAll();
      },

      setRoofAngle: (angle) => {
        set((state) => ({
          params: { ...state.params, roofAngle: angle },
        }));
        get().calculateAll();
      },

      setRoofAzimuth: (azimuth) => {
        set((state) => ({
          params: { ...state.params, roofAzimuth: azimuth },
        }));
        get().calculateAll();
      },

      addShadingPeriod: (period) => {
        const newPeriod: ShadingPeriod = {
          ...period,
          id: Date.now().toString(),
        };
        set((state) => {
          const newPeriods = [...state.params.shadingPeriods, newPeriod];
          const validation = validateShadingPeriods(newPeriods);
          return {
            params: { ...state.params, shadingPeriods: newPeriods },
            warnings: {
              ...state.warnings,
              shadingWarning: validation.warning,
            },
          };
        });
        get().calculateAll();
      },

      removeShadingPeriod: (id) => {
        set((state) => {
          const newPeriods = state.params.shadingPeriods.filter((p) => p.id !== id);
          const validation = validateShadingPeriods(newPeriods);
          return {
            params: { ...state.params, shadingPeriods: newPeriods },
            warnings: {
              ...state.warnings,
              shadingWarning: validation.warning,
            },
          };
        });
        get().calculateAll();
      },

      updateShadingPeriod: (id, period) => {
        set((state) => {
          const newPeriods = state.params.shadingPeriods.map((p) =>
            p.id === id ? { ...p, ...period } : p
          );
          const validation = validateShadingPeriods(newPeriods);
          return {
            params: { ...state.params, shadingPeriods: newPeriods },
            warnings: {
              ...state.warnings,
              shadingWarning: validation.warning,
            },
          };
        });
        get().calculateAll();
      },

      setPanelParams: (params) => {
        set((state) => ({
          params: { ...state.params, ...params },
        }));
        get().calculateAll();
      },

      setElectricityPrice: (price) => {
        set((state) => ({
          params: { ...state.params, electricityPrice: price },
        }));
        get().calculateAll();
      },

      setSeasonWeights: (weights) => {
        set((state) => {
          const newWeights = { ...state.params.seasonWeights, ...weights };
          return {
            params: { ...state.params, seasonWeights: newWeights },
            warnings: {
              ...state.warnings,
              seasonWeightsWarning: validateSeasonWeights(newWeights),
            },
          };
        });
        get().calculateAll();
      },

      setOptimizationStrategy: (strategy) => {
        set({ optimizationStrategy: strategy });
        get().calculateAll();
      },

      setUseCustomAngle: (use) => {
        set({ useCustomAngle: use });
        get().calculateAll();
      },

      setCustomAngle: (angle) => {
        set((state) => ({
          params: { ...state.params, customAngle: angle },
        }));
        if (get().useCustomAngle) {
          get().calculateAll();
        }
      },

      calculateAll: () => {
        const { params, optimizationStrategy, useCustomAngle } = get();

        let angleResult;
        if (useCustomAngle && params.customAngle !== undefined) {
          angleResult = {
            angle: params.customAngle,
            reason: `自定义倾角：${params.customAngle}°`,
          };
        } else if (optimizationStrategy === 'yearly') {
          angleResult = findOptimalAngleBySeason(
            Math.abs(params.latitude),
            params.seasonWeights
          );
        } else {
          angleResult = optimizeAngle(Math.abs(params.latitude), optimizationStrategy);
        }

        const shadingResult = calculateShadingLoss(
          params.shadingPeriods,
          Math.abs(params.latitude)
        );

        const energyResult = calculateAnnualEnergy({
          latitude: Math.abs(params.latitude),
          tiltAngle: angleResult.angle,
          panelPower: params.panelPower,
          panelCount: params.panelCount,
          shadingLoss: shadingResult.lossPercent,
          seasonWeights: params.seasonWeights,
        });

        const systemCost = calculateSystemCost({
          panelPower: params.panelPower,
          panelCount: params.panelCount,
          panelPrice: params.panelPrice,
        });

        const profitResult = calculateProfit({
          annualEnergy: energyResult.annualEnergy,
          electricityPrice: params.electricityPrice,
          systemCost,
        });

        set({
          results: {
            optimalAngle: angleResult.angle,
            optimalAngleReason: angleResult.reason,
            annualEnergy: energyResult.annualEnergy,
            shadingLoss: shadingResult.lossPercent,
            shadingLossReason: shadingResult.reason,
            annualProfit: profitResult.annualProfit,
            paybackYears: profitResult.paybackYears,
            monthlyEnergy: energyResult.monthlyEnergy,
            hourlyEnergy: energyResult.hourlyEnergy,
          },
        });
      },

      saveScenario: (name) => {
        const { params, results } = get();
        const newScenario: Scenario = {
          id: Date.now().toString(),
          name,
          createdAt: Date.now(),
          params: JSON.parse(JSON.stringify(params)),
          results: JSON.parse(JSON.stringify(results)),
        };
        set((state) => ({
          scenarios: [...state.scenarios, newScenario],
          activeScenarioId: newScenario.id,
        }));
      },

      loadScenario: (id) => {
        const scenario = get().scenarios.find((s) => s.id === id);
        if (scenario) {
          set({
            params: JSON.parse(JSON.stringify(scenario.params)),
            results: JSON.parse(JSON.stringify(scenario.results)),
            activeScenarioId: id,
          });
        }
      },

      deleteScenario: (id) => {
        set((state) => ({
          scenarios: state.scenarios.filter((s) => s.id !== id),
          activeScenarioId:
            state.activeScenarioId === id ? null : state.activeScenarioId,
        }));
      },

      resetToDefaults: () => {
        set({
          params: { ...defaultParams },
          results: { ...defaultResults },
          warnings: {},
          activeScenarioId: null,
          useCustomAngle: false,
        });
        setTimeout(() => get().calculateAll(), 0);
      },
    }),
    {
      name: 'solar-calculator-storage',
    }
  )
);
