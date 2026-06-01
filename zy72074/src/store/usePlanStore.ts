import { create } from 'zustand';
import type { Plan, PointStatus, CameraState } from '../types';
import { defaultPlan, samplePoints } from '../data/sampleData';
import { getLocalStorageItem, setLocalStorageItem, STORAGE_KEYS } from '../hooks/useLocalStorage';
import { generateId, formatDateTime } from '../utils/export';

interface PlanStore {
  plans: Plan[];
  currentPlanId: string | null;
  setPlans: (plans: Plan[]) => void;
  createPlan: (name: string, description: string, cameraState: CameraState) => void;
  updatePlan: (id: string, updates: Partial<Plan>) => void;
  deletePlan: (id: string) => void;
  setCurrentPlan: (id: string | null) => void;
  saveCurrentState: (cameraState: CameraState, pointStates: Record<string, { status: PointStatus; isAnomaly: boolean }>) => void;
  getCurrentPlan: () => Plan | undefined;
  loadPlan: (id: string) => Plan | undefined;
  initializeFromStorage: () => void;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plans: [defaultPlan],
  currentPlanId: defaultPlan.id,

  setPlans: (plans) => {
    set({ plans });
    setLocalStorageItem(STORAGE_KEYS.PLANS, plans);
  },

  createPlan: (name, description, cameraState) => {
    const now = formatDateTime(new Date());
    const newPlan: Plan = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      cameraState,
      pointIds: samplePoints.map(p => p.id),
      pointStates: {},
    };
    const plans = [...get().plans, newPlan];
    set({ plans, currentPlanId: newPlan.id });
    setLocalStorageItem(STORAGE_KEYS.PLANS, plans);
    setLocalStorageItem(STORAGE_KEYS.CURRENT_PLAN, newPlan.id);
  },

  updatePlan: (id, updates) => {
    const plans = get().plans.map(p =>
      p.id === id
        ? { ...p, ...updates, updatedAt: formatDateTime(new Date()) }
        : p
    );
    set({ plans });
    setLocalStorageItem(STORAGE_KEYS.PLANS, plans);
  },

  deletePlan: (id) => {
    const plans = get().plans.filter(p => p.id !== id);
    const currentPlanId = get().currentPlanId === id
      ? (plans.length > 0 ? plans[0].id : null)
      : get().currentPlanId;
    set({ plans, currentPlanId });
    setLocalStorageItem(STORAGE_KEYS.PLANS, plans);
    setLocalStorageItem(STORAGE_KEYS.CURRENT_PLAN, currentPlanId);
  },

  setCurrentPlan: (id) => {
    set({ currentPlanId: id });
    if (id) {
      setLocalStorageItem(STORAGE_KEYS.CURRENT_PLAN, id);
    }
  },

  saveCurrentState: (cameraState, pointStates) => {
    const { currentPlanId, plans } = get();
    if (!currentPlanId) return;

    const updatedPlans = plans.map(p =>
      p.id === currentPlanId
        ? {
            ...p,
            cameraState,
            pointStates,
            updatedAt: formatDateTime(new Date()),
          }
        : p
    );
    set({ plans: updatedPlans });
    setLocalStorageItem(STORAGE_KEYS.PLANS, updatedPlans);
  },

  getCurrentPlan: () => {
    const { plans, currentPlanId } = get();
    return plans.find(p => p.id === currentPlanId);
  },

  loadPlan: (id) => {
    const plan = get().plans.find(p => p.id === id);
    if (plan) {
      set({ currentPlanId: id });
      setLocalStorageItem(STORAGE_KEYS.CURRENT_PLAN, id);
    }
    return plan;
  },

  initializeFromStorage: () => {
    const storedPlans = getLocalStorageItem<Plan[] | null>(STORAGE_KEYS.PLANS, null);
    const storedCurrentPlan = getLocalStorageItem<string | null>(STORAGE_KEYS.CURRENT_PLAN, null);
    
    if (storedPlans && storedPlans.length > 0) {
      set({ 
        plans: storedPlans,
        currentPlanId: storedCurrentPlan || storedPlans[0].id,
      });
    }
  },
}));
