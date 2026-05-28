import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  ProcessBatch,
  BankTransaction,
  Voucher,
  MatchRecord,
  DataSource,
  ImportConflict,
} from '../types';
import { dbOperations } from '../db';
import { performMatching, updateBatchStatistics } from '../services/matchService';

type AppState = {
  batches: ProcessBatch[];
  currentBatchId: string | null;
  transactions: BankTransaction[];
  vouchers: Voucher[];
  matchRecords: MatchRecord[];
  sources: DataSource[];
  importConflicts: ImportConflict[];
  loading: boolean;
  error: string | null;
  activeTab: string;
};

type AppAction =
  | { type: 'SET_BATCHES'; payload: ProcessBatch[] }
  | { type: 'SET_CURRENT_BATCH'; payload: string | null }
  | { type: 'SET_TRANSACTIONS'; payload: BankTransaction[] }
  | { type: 'SET_VOUCHERS'; payload: Voucher[] }
  | { type: 'SET_MATCH_RECORDS'; payload: MatchRecord[] }
  | { type: 'SET_SOURCES'; payload: DataSource[] }
  | { type: 'SET_IMPORT_CONFLICTS'; payload: ImportConflict[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'ADD_BATCH'; payload: ProcessBatch }
  | { type: 'UPDATE_BATCH'; payload: ProcessBatch };

const initialState: AppState = {
  batches: [],
  currentBatchId: null,
  transactions: [],
  vouchers: [],
  matchRecords: [],
  sources: [],
  importConflicts: [],
  loading: false,
  error: null,
  activeTab: 'import',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_BATCHES':
      return { ...state, batches: action.payload };
    case 'SET_CURRENT_BATCH':
      return { ...state, currentBatchId: action.payload };
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    case 'SET_VOUCHERS':
      return { ...state, vouchers: action.payload };
    case 'SET_MATCH_RECORDS':
      return { ...state, matchRecords: action.payload };
    case 'SET_SOURCES':
      return { ...state, sources: action.payload };
    case 'SET_IMPORT_CONFLICTS':
      return { ...state, importConflicts: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'ADD_BATCH':
      return { ...state, batches: [...state.batches, action.payload] };
    case 'UPDATE_BATCH':
      return {
        ...state,
        batches: state.batches.map(b =>
          b.id === action.payload.id ? action.payload : b
        ),
      };
    default:
      return state;
  }
}

type AppContextType = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  loadBatches: () => Promise<void>;
  createBatch: (name: string) => Promise<ProcessBatch>;
  selectBatch: (batchId: string | null) => Promise<void>;
  runMatching: () => Promise<void>;
  refreshBatch: () => Promise<void>;
  deleteBatch: (batchId: string) => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const loadBatches = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const batches = await dbOperations.batches.getAll();
      dispatch({ type: 'SET_BATCHES', payload: batches });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '加载批次失败' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const createBatch = useCallback(async (name: string): Promise<ProcessBatch> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const batch = await dbOperations.batches.create(name);
      dispatch({ type: 'ADD_BATCH', payload: batch });
      dispatch({ type: 'SET_CURRENT_BATCH', payload: batch.id });
      await selectBatch(batch.id);
      return batch;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const selectBatch = useCallback(async (batchId: string | null): Promise<void> => {
    dispatch({ type: 'SET_CURRENT_BATCH', payload: batchId });
    if (!batchId) {
      dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
      dispatch({ type: 'SET_VOUCHERS', payload: [] });
      dispatch({ type: 'SET_MATCH_RECORDS', payload: [] });
      dispatch({ type: 'SET_SOURCES', payload: [] });
      dispatch({ type: 'SET_IMPORT_CONFLICTS', payload: [] });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [transactions, vouchers, matchRecords, sources, importConflicts] = await Promise.all([
        dbOperations.transactions.getByBatch(batchId),
        dbOperations.vouchers.getByBatch(batchId),
        dbOperations.matchRecords.getByBatch(batchId),
        dbOperations.sources.getByBatch(batchId),
        dbOperations.importConflicts.getByBatch(batchId),
      ]);
      dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
      dispatch({ type: 'SET_VOUCHERS', payload: vouchers });
      dispatch({ type: 'SET_MATCH_RECORDS', payload: matchRecords });
      dispatch({ type: 'SET_SOURCES', payload: sources });
      dispatch({ type: 'SET_IMPORT_CONFLICTS', payload: importConflicts });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '加载批次数据失败' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const runMatching = useCallback(async (): Promise<void> => {
    if (!state.currentBatchId) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await performMatching(state.currentBatchId);
      await updateBatchStatistics(state.currentBatchId);
      await selectBatch(state.currentBatchId);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '匹配失败' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentBatchId, selectBatch]);

  const refreshBatch = useCallback(async (): Promise<void> => {
    if (!state.currentBatchId) return;
    await selectBatch(state.currentBatchId);
    await loadBatches();
  }, [state.currentBatchId, selectBatch, loadBatches]);

  const deleteBatch = useCallback(async (batchId: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await dbOperations.batches.delete(batchId);
      await loadBatches();
      if (state.currentBatchId === batchId) {
        dispatch({ type: 'SET_CURRENT_BATCH', payload: null });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentBatchId, loadBatches]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        loadBatches,
        createBatch,
        selectBatch,
        runMatching,
        refreshBatch,
        deleteBatch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
