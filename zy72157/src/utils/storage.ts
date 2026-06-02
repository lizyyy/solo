import { MealPoint, MergeSuggestion, AppState } from '../types';

const STORAGE_KEY = 'meal_delivery_points';

interface StoredData {
  points: MealPoint[];
  suggestions: MergeSuggestion[];
  currentStep: AppState['currentStep'];
  savedAt: string;
}

export function saveToLocalStorage(data: Omit<StoredData, 'savedAt'>): void {
  try {
    const storedData: StoredData = {
      ...data,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
  } catch (error) {
    console.error('保存到本地存储失败:', error);
  }
}

export function loadFromLocalStorage(): StoredData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as StoredData;
      data.points = data.points.map((p) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        auditTrail: p.auditTrail.map((a) => ({
          ...a,
          timestamp: new Date(a.timestamp),
        })),
      }));
      data.suggestions = data.suggestions.map((s) => ({
        ...s,
        suggestedAt: new Date(s.suggestedAt),
      }));
      return data;
    }
  } catch (error) {
    console.error('从本地存储加载失败:', error);
  }
  return null;
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清除本地存储失败:', error);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
