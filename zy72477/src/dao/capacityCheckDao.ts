import { getStore } from '../database/memoryStore';
import { CapacityCheckResult, CalculationParam } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const capacityCheckDao = {
  create: (data: Omit<CapacityCheckResult, 'id'>): CapacityCheckResult => {
    const store = getStore();
    const id = generateId();
    const result: CapacityCheckResult = { ...data, id };
    store.capacityCheckResults.push(result);
    return result;
  },

  findById: (id: string): CapacityCheckResult | null => {
    const store = getStore();
    return store.capacityCheckResults.find(r => r.id === id) || null;
  },

  findByShelterId: (shelterId: string): CapacityCheckResult[] => {
    const store = getStore();
    return store.capacityCheckResults
      .filter(r => r.shelterId === shelterId)
      .sort((a, b) => b.checkTime.localeCompare(a.checkTime));
  },

  findLatestByShelterId: (shelterId: string): CapacityCheckResult | null => {
    const results = capacityCheckDao.findByShelterId(shelterId);
    return results[0] || null;
  },

  findLatestAll: (): CapacityCheckResult[] => {
    const store = getStore();
    const latestMap = new Map<string, CapacityCheckResult>();
    for (const r of store.capacityCheckResults) {
      const existing = latestMap.get(r.shelterId);
      if (!existing || new Date(r.checkTime) > new Date(existing.checkTime)) {
        latestMap.set(r.shelterId, r);
      }
    }
    return Array.from(latestMap.values()).sort((a, b) => b.checkTime.localeCompare(a.checkTime));
  },

  findAll: (): CapacityCheckResult[] => {
    const store = getStore();
    return [...store.capacityCheckResults].sort((a, b) => b.checkTime.localeCompare(a.checkTime));
  }
};

export const calculationParamDao = {
  create: (data: Omit<CalculationParam, 'id'>): CalculationParam => {
    const store = getStore();
    const id = generateId();
    const param: CalculationParam = { ...data, id };
    store.calculationParams.push(param);
    return param;
  },

  findAllActive: (): CalculationParam[] => {
    const store = getStore();
    return store.calculationParams
      .filter(p => p.effectiveTo === null)
      .sort((a, b) => a.paramName.localeCompare(b.paramName));
  },

  findAll: (): CalculationParam[] => {
    const store = getStore();
    return [...store.calculationParams].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }
};
