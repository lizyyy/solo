import type { Plan, CheckReport } from '../models/types';

const STORAGE_KEYS = {
  CURRENT_PLAN: 'booth_planner_current_plan',
  SAVED_PLANS: 'booth_planner_saved_plans',
  SETTINGS: 'booth_planner_settings',
};

export class PlanStorage {
  private readonly storage: Storage;
  
  constructor() {
    this.storage = window.localStorage;
  }
  
  saveCurrentPlan(plan: Plan): void {
    try {
      const updatedPlan = { ...plan, updatedAt: Date.now() };
      this.storage.setItem(STORAGE_KEYS.CURRENT_PLAN, JSON.stringify(updatedPlan));
    } catch (e) {
      console.error('Failed to save current plan:', e);
    }
  }
  
  loadCurrentPlan(): Plan | null {
    try {
      const data = this.storage.getItem(STORAGE_KEYS.CURRENT_PLAN);
      if (data) {
        return JSON.parse(data) as Plan;
      }
    } catch (e) {
      console.error('Failed to load current plan:', e);
    }
    return null;
  }
  
  clearCurrentPlan(): void {
    this.storage.removeItem(STORAGE_KEYS.CURRENT_PLAN);
  }
  
  getSavedPlansList(): Array<{ id: string; name: string; updatedAt: number }> {
    try {
      const data = this.storage.getItem(STORAGE_KEYS.SAVED_PLANS);
      if (data) {
        return JSON.parse(data) as Array<{ id: string; name: string; updatedAt: number }>;
      }
    } catch (e) {
      console.error('Failed to get saved plans list:', e);
    }
    return [];
  }
  
  savePlanToLibrary(plan: Plan): void {
    try {
      const list = this.getSavedPlansList();
      const existingIndex = list.findIndex(p => p.id === plan.id);
      
      if (existingIndex >= 0) {
        list[existingIndex] = {
          id: plan.id,
          name: plan.name,
          updatedAt: Date.now(),
        };
      } else {
        list.push({
          id: plan.id,
          name: plan.name,
          updatedAt: Date.now(),
        });
      }
      
      this.storage.setItem(STORAGE_KEYS.SAVED_PLANS, JSON.stringify(list));
      this.storage.setItem(`plan_${plan.id}`, JSON.stringify({ ...plan, updatedAt: Date.now() }));
    } catch (e) {
      console.error('Failed to save plan to library:', e);
    }
  }
  
  loadPlanFromLibrary(id: string): Plan | null {
    try {
      const data = this.storage.getItem(`plan_${id}`);
      if (data) {
        return JSON.parse(data) as Plan;
      }
    } catch (e) {
      console.error('Failed to load plan from library:', e);
    }
    return null;
  }
  
  deletePlanFromLibrary(id: string): void {
    try {
      const list = this.getSavedPlansList().filter(p => p.id !== id);
      this.storage.setItem(STORAGE_KEYS.SAVED_PLANS, JSON.stringify(list));
      this.storage.removeItem(`plan_${id}`);
    } catch (e) {
      console.error('Failed to delete plan from library:', e);
    }
  }
}

export function exportPlanToJson(plan: Plan): string {
  const exportData = {
    ...plan,
    _exportMeta: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      app: 'Booth Planner 3D',
    },
  };
  return JSON.stringify(exportData, null, 2);
}

export function importPlanFromJson(jsonString: string): Plan | null {
  try {
    const data = JSON.parse(jsonString) as Plan & { _exportMeta?: unknown };
    if (data && typeof data === 'object' && 'id' in data && 'objects' in data) {
      const { _exportMeta, ...planData } = data;
      return planData as Plan;
    }
  } catch (e) {
    console.error('Failed to import plan from JSON:', e);
  }
  return null;
}

export function downloadJson(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadHtml(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function loadFileFromInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      resolve(file || null);
    };
    
    input.click();
  });
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export const planStorage = new PlanStorage();
