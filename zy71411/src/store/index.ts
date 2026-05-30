import { create } from 'zustand';
import {
  ForwardContract,
  RolloverApplication,
  PaymentRecord,
  HistoryRecord,
  LinkValidationResult,
  PointsValidationResult,
  MatchValidationResult,
  ValidationError,
  FilterState,
  OverallStatus,
} from '../types';
import { ContractService, HistoryService } from '../services/contractService';
import { ValidationService } from '../services/validationService';

interface ContractState {
  contracts: ForwardContract[];
  rolloverApps: RolloverApplication[];
  payments: PaymentRecord[];
  history: HistoryRecord[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  updateContract: (
    id: string,
    data: Partial<ForwardContract>,
    reason: string,
    operator: string
  ) => Promise<void>;
  supplementApplication: (
    applicationId: string,
    data: Partial<RolloverApplication>,
    reason: string,
    operator: string
  ) => Promise<void>;
}

interface ValidationState {
  linkValidation: LinkValidationResult[];
  pointsValidation: PointsValidationResult[];
  matchValidation: MatchValidationResult[];
  overallStatus: OverallStatus;
  loading: boolean;
  runValidation: (
    contracts: ForwardContract[],
    applications: RolloverApplication[],
    payments: PaymentRecord[]
  ) => void;
  getErrorsByContract: (contractId: string) => ValidationError[];
  getErrorsByType: (type: 'link' | 'points' | 'match') => ValidationError[];
  getAllErrors: () => ValidationError[];
}

interface FilterStoreState extends FilterState {
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  getFilteredContracts: (contracts: ForwardContract[]) => ForwardContract[];
  getFilteredErrors: (errors: ValidationError[]) => ValidationError[];
}

const defaultFilters: FilterState = {
  contractNo: '',
  counterparty: '',
  currency: '',
  dateRange: null,
  status: [],
};

export const useContractStore = create<ContractState>((set) => ({
  contracts: [],
  rolloverApps: [],
  payments: [],
  history: [],
  loading: false,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const [contracts, rolloverApps, payments, history] = await Promise.all([
        ContractService.getContracts(),
        ContractService.getRolloverApplications(),
        ContractService.getPayments(),
        HistoryService.getHistory(),
      ]);
      set({ contracts, rolloverApps, payments, history, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateContract: async (id, data, reason, operator) => {
    try {
      const { contract, change } = await ContractService.updateContract(id, data, operator, reason);
      const historyRecord = await HistoryService.addRecord({
        operator,
        operationType: 'manual_correct',
        contractId: id,
        fieldChanges: change,
        reason,
      });

      set(state => ({
        contracts: state.contracts.map(c => (c.id === id ? contract : c)),
        history: [historyRecord, ...state.history],
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  supplementApplication: async (applicationId, data, reason, operator) => {
    try {
      const { application, change } = await ContractService.supplementApplicationData(
        applicationId,
        data,
        operator,
        reason
      );
      const historyRecord = await HistoryService.addRecord({
        operator,
        operationType: 'supplement',
        applicationId,
        fieldChanges: change,
        reason,
      });

      set(state => ({
        rolloverApps: state.rolloverApps.map(a => (a.id === applicationId ? application : a)),
        history: [historyRecord, ...state.history],
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
}));

export const useValidationStore = create<ValidationState>((set, get) => ({
  linkValidation: [],
  pointsValidation: [],
  matchValidation: [],
  overallStatus: 'pass',
  loading: false,

  runValidation: (contracts, applications, payments) => {
    set({ loading: true });

    const linkResults: LinkValidationResult[] = [];
    for (const contract of contracts) {
      const result = ValidationService.validateContractLink(
        contract,
        contracts,
        applications
      );
      linkResults.push(result);
    }

    const pointsResults: PointsValidationResult[] = [];
    for (const app of applications) {
      const originalContract = contracts.find(c => c.id === app.originalContractId);
      const newContract = app.newContractId ? contracts.find(c => c.id === app.newContractId) : undefined;
      const result = ValidationService.validatePointsCalculation(
        app,
        originalContract,
        newContract
      );
      pointsResults.push(result);
    }

    const matchResults: MatchValidationResult[] = [];
    for (const payment of payments) {
      const result = ValidationService.validatePaymentMatching(payment, contracts);
      matchResults.push(result);
    }

    const allErrors = [
      ...linkResults.flatMap(r => r.errors),
      ...pointsResults.flatMap(r => r.errors),
      ...matchResults.flatMap(r => r.errors),
    ];

    const hasError = allErrors.some(e => e.severity === 'error');
    const hasWarning = allErrors.some(e => e.severity === 'warning');
    const overallStatus: OverallStatus = hasError ? 'error' : hasWarning ? 'warning' : 'pass';

    set({
      linkValidation: linkResults,
      pointsValidation: pointsResults,
      matchValidation: matchResults,
      overallStatus,
      loading: false,
    });
  },

  getErrorsByContract: (contractId) => {
    const state = get();
    const errors: ValidationError[] = [];

    for (const result of state.linkValidation) {
      if (result.contractId === contractId) {
        errors.push(...result.errors);
      }
    }

    for (const result of state.pointsValidation) {
      const app = result.applicationId;
      if (app === contractId) {
        errors.push(...result.errors);
      }
    }

    return errors;
  },

  getErrorsByType: (type) => {
    const state = get();
    switch (type) {
      case 'link':
        return state.linkValidation.flatMap(r => r.errors);
      case 'points':
        return state.pointsValidation.flatMap(r => r.errors);
      case 'match':
        return state.matchValidation.flatMap(r => r.errors);
      default:
        return [];
    }
  },

  getAllErrors: () => {
    const state = get();
    return [
      ...state.linkValidation.flatMap(r => r.errors),
      ...state.pointsValidation.flatMap(r => r.errors),
      ...state.matchValidation.flatMap(r => r.errors),
    ];
  },
}));

export const useFilterStore = create<FilterStoreState>((set, get) => ({
  ...defaultFilters,

  setFilter: (key, value) => {
    set({ [key]: value } as Partial<FilterStoreState>);
  },

  resetFilters: () => {
    set(defaultFilters);
  },

  getFilteredContracts: (contracts) => {
    const state = get();
    let filtered = [...contracts];

    if (state.contractNo) {
      filtered = filtered.filter(c =>
        c.contractNo.toLowerCase().includes(state.contractNo.toLowerCase())
      );
    }

    if (state.counterparty) {
      filtered = filtered.filter(c => c.counterparty === state.counterparty);
    }

    if (state.currency) {
      filtered = filtered.filter(c => c.currencyPair.includes(state.currency));
    }

    if (state.dateRange && state.dateRange[0] && state.dateRange[1]) {
      const [start, end] = state.dateRange;
      filtered = filtered.filter(c => {
        const tradeDate = new Date(c.tradeDate);
        return tradeDate >= start && tradeDate <= end;
      });
    }

    return filtered;
  },

  getFilteredErrors: (errors) => {
    const state = get();
    let filtered = [...errors];

    if (state.status.length > 0) {
      filtered = filtered.filter(e => state.status.includes(e.severity));
    }

    if (state.contractNo) {
      filtered = filtered.filter(e =>
        e.contractNo?.toLowerCase().includes(state.contractNo.toLowerCase())
      );
    }

    return filtered;
  },
}));
