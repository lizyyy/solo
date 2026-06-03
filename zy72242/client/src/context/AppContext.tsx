import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ReconciliationRecord, TailAdjustment, AuditLog, Holiday } from '../types';
import { recordApi, adjustmentApi, auditApi, demoApi } from '../services/api';

interface AppState {
  records: ReconciliationRecord[];
  adjustments: TailAdjustment[];
  auditLogs: AuditLog[];
  holidays: Holiday[];
  loading: boolean;
  error: string | null;
  currentUser: {
    name: string;
    role: 'fund_manager' | 'product_manager';
  };
  demoMode: boolean;
  demoStep: number;
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_RECORDS'; payload: ReconciliationRecord[] }
  | { type: 'ADD_RECORD'; payload: ReconciliationRecord }
  | { type: 'UPDATE_RECORD'; payload: ReconciliationRecord }
  | { type: 'SET_ADJUSTMENTS'; payload: TailAdjustment[] }
  | { type: 'ADD_ADJUSTMENT'; payload: TailAdjustment }
  | { type: 'SET_AUDIT_LOGS'; payload: AuditLog[] }
  | { type: 'SET_HOLIDAYS'; payload: Holiday[] }
  | { type: 'SET_DEMO_MODE'; payload: boolean }
  | { type: 'SET_DEMO_STEP'; payload: number }
  | { type: 'SET_USER'; payload: { name: string; role: 'fund_manager' | 'product_manager' } };

const initialState: AppState = {
  records: [],
  adjustments: [],
  auditLogs: [],
  holidays: [],
  loading: false,
  error: null,
  currentUser: {
    name: '支付平台阿南',
    role: 'product_manager'
  },
  demoMode: false,
  demoStep: 0
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_RECORDS':
      return { ...state, records: action.payload };
    case 'ADD_RECORD':
      return { ...state, records: [action.payload, ...state.records] };
    case 'UPDATE_RECORD':
      return {
        ...state,
        records: state.records.map(r =>
          r.id === action.payload.id ? action.payload : r
        )
      };
    case 'SET_ADJUSTMENTS':
      return { ...state, adjustments: action.payload };
    case 'ADD_ADJUSTMENT':
      return { ...state, adjustments: [action.payload, ...state.adjustments] };
    case 'SET_AUDIT_LOGS':
      return { ...state, auditLogs: action.payload };
    case 'SET_HOLIDAYS':
      return { ...state, holidays: action.payload };
    case 'SET_DEMO_MODE':
      return { ...state, demoMode: action.payload };
    case 'SET_DEMO_STEP':
      return { ...state, demoStep: action.payload };
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  loadRecords: () => Promise<void>;
  loadAdjustments: () => Promise<void>;
  loadHolidays: () => Promise<void>;
  initDemo: (step?: number) => Promise<void>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const loadRecords = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await recordApi.getAllRecords();
      if (response.data.success) {
        dispatch({ type: 'SET_RECORDS', payload: response.data.data || [] });
      }
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || '加载记录失败' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const loadAdjustments = async () => {
    try {
      const response = await adjustmentApi.getAllAdjustments();
      if (response.data.success) {
        dispatch({ type: 'SET_ADJUSTMENTS', payload: response.data.data || [] });
      }
    } catch (error: any) {
      console.error('加载尾差调整失败:', error);
    }
  };

  const loadHolidays = async () => {
    try {
      const response = await demoApi.getHolidays();
      if (response.data.success) {
        dispatch({ type: 'SET_HOLIDAYS', payload: response.data.data || [] });
      }
    } catch (error: any) {
      console.error('加载节假日失败:', error);
    }
  };

  const initDemo = async (step?: number) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await demoApi.initDemo(step);
      if (response.data.success) {
        dispatch({ type: 'SET_DEMO_MODE', payload: true });
        if (step) {
          dispatch({ type: 'SET_DEMO_STEP', payload: step });
        }
        await loadRecords();
        await loadAdjustments();
      }
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || '初始化演示数据失败' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  useEffect(() => {
    loadRecords();
    loadAdjustments();
    loadHolidays();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, loadRecords, loadAdjustments, loadHolidays, initDemo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
