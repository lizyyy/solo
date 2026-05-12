import { v4 as uuidv4 } from 'uuid';
import {
  initialServices,
  initialDependencies,
  initialRules,
  initialDrillPlans,
  cacheStore,
} from './initialData.js';
import { DrillStatus, DegradeAction } from './types.js';

let services = JSON.parse(JSON.stringify(initialServices));
let dependencies = JSON.parse(JSON.stringify(initialDependencies));
let rules = JSON.parse(JSON.stringify(initialRules));
let drillPlans = JSON.parse(JSON.stringify(initialDrillPlans));
let cache = JSON.parse(JSON.stringify(cacheStore));
let drillResults = [];
let currentDrill = null;

export const Store = {
  getServices: () => services,
  setServices: (newServices) => (services = newServices),
  getDependencies: () => dependencies,
  setDependencies: (newDeps) => (dependencies = newDeps),

  getRules: () => rules,
  getRuleById: (id) => rules.find((r) => r.id === id),
  createRule: (rule) => {
    const newRule = { ...rule, id: uuidv4() };
    rules.push(newRule);
    return newRule;
  },
  updateRule: (id, updates) => {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rules[idx] = { ...rules[idx], ...updates };
      return rules[idx];
    }
    return null;
  },
  deleteRule: (id) => {
    rules = rules.filter((r) => r.id !== id);
  },

  getDrillPlans: () => drillPlans,
  getDrillPlanById: (id) => drillPlans.find((p) => p.id === id),
  createDrillPlan: (plan) => {
    const newPlan = { ...plan, id: uuidv4(), status: DrillStatus.IDLE };
    drillPlans.push(newPlan);
    return newPlan;
  },
  updateDrillPlan: (id, updates) => {
    const idx = drillPlans.findIndex((p) => p.id === id);
    if (idx >= 0) {
      drillPlans[idx] = { ...drillPlans[idx], ...updates };
      return drillPlans[idx];
    }
    return null;
  },

  getCurrentDrill: () => currentDrill,
  setCurrentDrill: (drill) => (currentDrill = drill),

  getDrillResults: () => drillResults,
  getDrillResultById: (id) => drillResults.find((r) => r.id === id),
  saveDrillResult: (result) => {
    const existingIdx = drillResults.findIndex((r) => r.id === result.id);
    if (existingIdx >= 0) {
      drillResults[existingIdx] = result;
    } else {
      drillResults.push(result);
    }
    return result;
  },

  getCache: () => cache,
  setCache: (serviceId, data, ttl = 300) => {
    cache[serviceId] = {
      data,
      timestamp: Date.now(),
      ttl,
    };
  },
  getCacheEntry: (serviceId) => cache[serviceId],
  isCacheValid: (serviceId) => {
    const entry = cache[serviceId];
    if (!entry) return false;
    const elapsed = (Date.now() - entry.timestamp) / 1000;
    return elapsed < entry.ttl;
  },

  findMatchingRule: (serviceId, faultStatus) => {
    return rules.find(
      (rule) =>
        rule.enabled &&
        rule.targetService === serviceId &&
        rule.conditions?.status?.includes(faultStatus)
    );
  },

  isCoreService: (serviceId) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.role === 'core';
  },
};
