import { AppState, Question, ReviewRecord, ReviewSettings, MindMap, User } from '../types';
import { mockQuestions, mockReviewRecords, mockReviewSettings, mockMindMaps, mockUser } from '../data/mockData';

const STORAGE_KEY = 'memory-tree-app-state';

export const loadFromStorage = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  
  return getInitialState();
};

export const saveToStorage = (state: AppState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
};

export const getInitialState = (): AppState => ({
  questions: [...mockQuestions],
  reviewRecords: [...mockReviewRecords],
  reviewSettings: { ...mockReviewSettings },
  mindMaps: [...mockMindMaps],
  user: { ...mockUser },
  theme: 'light',
  loading: false,
  error: null
});

export const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
