import { AppState, Aunt, Customer, Order, Assignment, Leave, HistoryRecord } from '../types';

let state: AppState = {
  aunts: [],
  customers: [],
  orders: [],
  assignments: [],
  leaves: [],
  history: []
};

export const getState = (): AppState => state;

export const setState = (newState: Partial<AppState>): void => {
  state = { ...state, ...newState };
};

export const addHistory = (record: Omit<HistoryRecord, 'id' | 'timestamp'>): void => {
  const historyRecord: HistoryRecord = {
    ...record,
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  };
  state.history = [historyRecord, ...state.history];
};
