import { AppState } from '../types';

const STORAGE_KEY = 'offline-form-sync-simulator';

export const storage = {
  save: (state: AppState): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  },

  load: (): AppState | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as AppState;
      }
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
    }
    return null;
  },

  clear: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear state from localStorage:', error);
    }
  }
};
