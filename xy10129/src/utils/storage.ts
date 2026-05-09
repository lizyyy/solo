import { SavedPlan, YardConfig, PathPlan, ValidationResult } from '../types';

const STORAGE_KEY = 'yard-path-planner-plans';

export const savePlan = (
  name: string,
  yardConfig: YardConfig,
  pathPlan: PathPlan,
  validation: ValidationResult
): SavedPlan => {
  const savedPlan: SavedPlan = {
    id: pathPlan.id,
    name,
    createdAt: Date.now(),
    yardConfig: JSON.parse(JSON.stringify(yardConfig)),
    pathPlan: JSON.parse(JSON.stringify(pathPlan)),
    validation: JSON.parse(JSON.stringify(validation))
  };

  const allPlans = getAllPlans();
  const existingIdx = allPlans.findIndex(p => p.id === savedPlan.id);
  
  if (existingIdx >= 0) {
    allPlans[existingIdx] = savedPlan;
  } else {
    allPlans.push(savedPlan);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlans));
  return savedPlan;
};

export const getAllPlans = (): SavedPlan[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPlan[];
  } catch {
    return [];
  }
};

export const getPlan = (id: string): SavedPlan | undefined => {
  return getAllPlans().find(p => p.id === id);
};

export const deletePlan = (id: string): void => {
  const plans = getAllPlans().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
};

export const exportPlanAsJSON = (plan: SavedPlan): string => {
  return JSON.stringify(plan, null, 2);
};

export const importPlanFromJSON = (json: string): SavedPlan => {
  return JSON.parse(json) as SavedPlan;
};
