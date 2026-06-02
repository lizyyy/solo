import { AppData } from '../types';
import { mockData } from '../data/mockData';

const STORAGE_KEY = 'busSignalReviewData';

export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load data from localStorage:', e);
  }
  return JSON.parse(JSON.stringify(mockData));
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data to localStorage:', e);
  }
}

export function resetData(): AppData {
  const freshData = JSON.parse(JSON.stringify(mockData));
  saveData(freshData);
  return freshData;
}

export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString: string): AppData | null {
  try {
    const data = JSON.parse(jsonString);
    if (data.points && Array.isArray(data.points)) {
      return data;
    }
  } catch (e) {
    console.error('Failed to import data:', e);
  }
  return null;
}
