import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, FundUsageRecord, Discrepancy, ProcessingHistory, FilterOptions, SourceMeta, ProspectusData, LedgerData, PaymentVoucher } from '../types';
import { loadState, saveState } from '../utils/storage';
import { getSampleData } from '../utils/import';
import { matchAndCategorizeFunds, approveRecord, rejectRecord, requestExplanation, updateCategory } from '../utils/fundCategorization';
import { detectAllDiscrepancies, resolveDiscrepancy } from '../utils/discrepancyDetection';

type Action =
  | { type: 'INITIALIZE_STATE'; payload: AppState }
  | { type: 'LOAD_SAMPLE_DATA' }
  | { type: 'SET_FILTERS'; payload: Partial<FilterOptions> }
  | { type: 'SELECT_BOND'; payload: string | null }
  | { type: 'ADD_SOURCE'; payload: SourceMeta }
  | { type: 'ADD_PROSPECTUSES'; payload: ProspectusData[] }
  | { type: 'ADD_LEDGERS'; payload: LedgerData[] }
  | { type: 'ADD_VOUCHERS'; payload: PaymentVoucher[] }
  | { type: 'PROCESS_DATA' }
  | { type: 'APPROVE_RECORD'; payload: { recordId: string; operator: string; comments?: string } }
  | { type: 'REJECT_RECORD'; payload: { recordId: string; operator: string; reason: string } }
  | { type: 'REQUEST_EXPLANATION'; payload: { recordId: string; operator: string; reason: string } }
  | { type: 'UPDATE_CATEGORY'; payload: { recordId: string; newCategory: any; operator: string; reason: string } }
  | { type: 'RESOLVE_DISCREPANCY'; payload: { discrepancyId: string; resolution: string; operator: string } }
  | { type: 'CLEAR_STATE' };

const initialState: AppState = {
  sources: [],
  prospectuses: [],
  ledgers: [],
  vouchers: [],
  fundUsages: [],
  discrepancies: [],
  processingHistory: [],
  selectedBond: null,
  filters: {}
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'INITIALIZE_STATE':
      return action.payload;

    case 'LOAD_SAMPLE_DATA': {
      const sample = getSampleData();
      const { records, discrepancies } = matchAndCategorizeFunds(
        sample.prospectuses,
        sample.ledgers,
        sample.vouchers
      );
      return {
        ...state,
        sources: sample.sources,
        prospectuses: sample.prospectuses,
        ledgers: sample.ledgers,
        vouchers: sample.vouchers,
        fundUsages: records,
        discrepancies
      };
    }

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };

    case 'SELECT_BOND':
      return {
        ...state,
        selectedBond: action.payload
      };

    case 'ADD_SOURCE':
      return {
        ...state,
        sources: [...state.sources, action.payload]
      };

    case 'ADD_PROSPECTUSES':
      return {
        ...state,
        prospectuses: [...state.prospectuses, ...action.payload]
      };

    case 'ADD_LEDGERS':
      return {
        ...state,
        ledgers: [...state.ledgers, ...action.payload]
      };

    case 'ADD_VOUCHERS':
      return {
        ...state,
        vouchers: [...state.vouchers, ...action.payload]
      };

    case 'PROCESS_DATA': {
      const { records, discrepancies: newDiscrepancies } = matchAndCategorizeFunds(
        state.prospectuses,
        state.ledgers,
        state.vouchers
      );
      const additionalDiscrepancies = detectAllDiscrepancies(
        records,
        state.prospectuses,
        state.ledgers,
        state.vouchers
      );
      return {
        ...state,
        fundUsages: records,
        discrepancies: [...newDiscrepancies, ...additionalDiscrepancies]
      };
    }

    case 'APPROVE_RECORD': {
      const record = state.fundUsages.find(r => r.id === action.payload.recordId);
      if (!record) return state;
      const { record: updatedRecord, history } = approveRecord(
        record,
        action.payload.operator,
        action.payload.comments
      );
      return {
        ...state,
        fundUsages: state.fundUsages.map(r =>
          r.id === action.payload.recordId ? updatedRecord : r
        ),
        processingHistory: [...state.processingHistory, history]
      };
    }

    case 'REJECT_RECORD': {
      const record = state.fundUsages.find(r => r.id === action.payload.recordId);
      if (!record) return state;
      const { record: updatedRecord, history } = rejectRecord(
        record,
        action.payload.operator,
        action.payload.reason
      );
      return {
        ...state,
        fundUsages: state.fundUsages.map(r =>
          r.id === action.payload.recordId ? updatedRecord : r
        ),
        processingHistory: [...state.processingHistory, history]
      };
    }

    case 'REQUEST_EXPLANATION': {
      const record = state.fundUsages.find(r => r.id === action.payload.recordId);
      if (!record) return state;
      const { record: updatedRecord, history } = requestExplanation(
        record,
        action.payload.operator,
        action.payload.reason
      );
      return {
        ...state,
        fundUsages: state.fundUsages.map(r =>
          r.id === action.payload.recordId ? updatedRecord : r
        ),
        processingHistory: [...state.processingHistory, history]
      };
    }

    case 'UPDATE_CATEGORY': {
      const record = state.fundUsages.find(r => r.id === action.payload.recordId);
      if (!record) return state;
      const { record: updatedRecord, history } = updateCategory(
        record,
        action.payload.newCategory,
        action.payload.operator,
        action.payload.reason
      );
      return {
        ...state,
        fundUsages: state.fundUsages.map(r =>
          r.id === action.payload.recordId ? updatedRecord : r
        ),
        processingHistory: [...state.processingHistory, history]
      };
    }

    case 'RESOLVE_DISCREPANCY': {
      const discrepancy = state.discrepancies.find(d => d.id === action.payload.discrepancyId);
      if (!discrepancy) return state;
      const updated = resolveDiscrepancy(
        discrepancy,
        action.payload.resolution,
        action.payload.operator
      );
      return {
        ...state,
        discrepancies: state.discrepancies.map(d =>
          d.id === action.payload.discrepancyId ? updated : d
        )
      };
    }

    case 'CLEAR_STATE':
      return initialState;

    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      dispatch({ type: 'INITIALIZE_STATE', payload: saved });
    }
  }, []);

  useEffect(() => {
    if (state.sources.length > 0 || state.fundUsages.length > 0) {
      saveState(state);
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
