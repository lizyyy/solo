import { create } from 'zustand';
import type { 
  ValuationRecord, 
  Fund, 
  ShareRecord, 
  SidePocketAsset, 
  FilterConditions, 
  RecordStatus,
  OperationLog 
} from '../types';
import { funds as mockFunds } from '../data/funds';
import { shares as mockShares } from '../data/shares';
import { sidePockets as mockSidePockets } from '../data/sidePockets';
import { valuations as mockValuations } from '../data/valuations';
import { operationLogs as mockLogs } from '../data/operationLogs';
import { executeStatusTransition, getInitialStatusForAnomalies } from '../utils/statusFlow';
import { batchDetectAnomalies } from '../utils/anomalyDetector';

interface ValuationState {
  funds: Fund[];
  shares: ShareRecord[];
  sidePockets: SidePocketAsset[];
  valuations: ValuationRecord[];
  operationLogs: OperationLog[];
  filters: FilterConditions;
  selectedValuationId: string | null;
  expandedRows: Set<string>;
  currentUser: string;
  
  setFilters: (filters: Partial<FilterConditions>) => void;
  resetFilters: () => void;
  toggleRowExpanded: (valuationId: string) => void;
  selectValuation: (valuationId: string | null) => void;
  
  getFilteredValuations: () => ValuationRecord[];
  getLogsForValuation: (valuationId: string) => OperationLog[];
  getSharesForValuation: (valuationId: string) => ShareRecord[];
  getAssetsForValuation: (valuationId: string) => SidePocketAsset[];
  
  transitionStatus: (valuationId: string, targetStatus: RecordStatus, remark?: string) => boolean;
  
  getStats: () => {
    totalFunds: number;
    totalValuation: number;
    pendingCount: number;
    anomalyCount: number;
    returnedCount: number;
    processedCount: number;
  };
  
  getTrendData: () => Array<{
    date: string;
    normalValue: number;
    sidePocketValue: number;
    totalValue: number;
  }>;
  
  getDistributionData: () => Array<{
    fundName: string;
    normalShares: number;
    sidePocketShares: number;
    totalShares: number;
  }>;
  
  runAnomalyDetection: () => void;
}

const defaultFilters: FilterConditions = {
  fundIds: [],
  dateRange: null,
  statuses: [],
  valuationVersions: [],
  submitTypes: [],
  hasAnomaly: null,
};

export const useValuationStore = create<ValuationState>((set, get) => ({
  funds: mockFunds,
  shares: mockShares,
  sidePockets: mockSidePockets,
  valuations: mockValuations,
  operationLogs: mockLogs,
  filters: defaultFilters,
  selectedValuationId: null,
  expandedRows: new Set(),
  currentUser: '估值-李明',
  
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },
  
  resetFilters: () => {
    set({ filters: defaultFilters });
  },
  
  toggleRowExpanded: (valuationId) => {
    set((state) => {
      const newExpanded = new Set(state.expandedRows);
      if (newExpanded.has(valuationId)) {
        newExpanded.delete(valuationId);
      } else {
        newExpanded.add(valuationId);
      }
      return { expandedRows: newExpanded };
    });
  },
  
  selectValuation: (valuationId) => {
    set({ selectedValuationId: valuationId });
  },
  
  getFilteredValuations: () => {
    const { valuations, filters } = get();
    let filtered = [...valuations];
    
    if (filters.fundIds.length > 0) {
      filtered = filtered.filter(v => filters.fundIds.includes(v.fundId));
    }
    
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      filtered = filtered.filter(v => v.valuationDate >= start && v.valuationDate <= end);
    }
    
    if (filters.statuses.length > 0) {
      filtered = filtered.filter(v => filters.statuses.includes(v.status));
    }
    
    if (filters.valuationVersions.length > 0) {
      filtered = filtered.filter(v => filters.valuationVersions.includes(v.valuationVersion));
    }
    
    if (filters.submitTypes.length > 0) {
      filtered = filtered.filter(v => filters.submitTypes.includes(v.submitType));
    }
    
    if (filters.hasAnomaly !== null) {
      filtered = filtered.filter(v => v.anomalies.length > 0 === filters.hasAnomaly);
    }
    
    return filtered.sort((a, b) => {
      if (a.valuationDate !== b.valuationDate) {
        return b.valuationDate.localeCompare(a.valuationDate);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  },
  
  getLogsForValuation: (valuationId) => {
    return get().operationLogs
      .filter(log => log.valuationId === valuationId)
      .sort((a, b) => b.operateTime.localeCompare(a.operateTime));
  },
  
  getSharesForValuation: (valuationId) => {
    const valuation = get().valuations.find(v => v.valuationId === valuationId);
    if (!valuation) return [];
    return get().shares.filter(s => s.fundId === valuation.fundId && s.shareDate === valuation.valuationDate);
  },
  
  getAssetsForValuation: (valuationId) => {
    const valuation = get().valuations.find(v => v.valuationId === valuationId);
    if (!valuation) return [];
    return get().sidePockets.filter(a => a.fundId === valuation.fundId);
  },
  
  transitionStatus: (valuationId, targetStatus, remark = '') => {
    const { valuations, operationLogs, currentUser } = get();
    const valuation = valuations.find(v => v.valuationId === valuationId);
    
    if (!valuation) return false;
    
    const result = executeStatusTransition(
      valuation.status,
      targetStatus,
      valuationId,
      currentUser,
      remark
    );
    
    if (!result.success || !result.newStatus || !result.log) {
      return false;
    }
    
    set({
      valuations: valuations.map(v => 
        v.valuationId === valuationId 
          ? { ...v, status: result.newStatus!, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) }
          : v
      ),
      operationLogs: [...operationLogs, result.log],
    });
    
    return true;
  },
  
  getStats: () => {
    const { valuations, funds } = get();
    const latestValuations = valuations.filter(v => v.isLatest);
    
    return {
      totalFunds: funds.length,
      totalValuation: latestValuations.reduce((sum, v) => sum + v.totalValue, 0),
      pendingCount: valuations.filter(v => v.status === 'pending').length,
      anomalyCount: valuations.filter(v => v.status === 'anomaly').length,
      returnedCount: valuations.filter(v => v.status === 'returned').length,
      processedCount: valuations.filter(v => v.status === 'processed').length,
    };
  },
  
  getTrendData: () => {
    const { valuations, filters } = get();
    let data = [...valuations];
    
    if (filters.fundIds.length > 0) {
      data = data.filter(v => filters.fundIds.includes(v.fundId));
    }
    
    const dateGroups = new Map<string, { normalValue: number; sidePocketValue: number; totalValue: number }>();
    
    data.forEach(v => {
      const existing = dateGroups.get(v.valuationDate) || { normalValue: 0, sidePocketValue: 0, totalValue: 0 };
      dateGroups.set(v.valuationDate, {
        normalValue: existing.normalValue + v.normalValue,
        sidePocketValue: existing.sidePocketValue + v.sidePocketValue,
        totalValue: existing.totalValue + v.totalValue,
      });
    });
    
    return Array.from(dateGroups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, values]) => ({
        date,
        ...values,
      }));
  },
  
  getDistributionData: () => {
    const { valuations, funds, shares, filters } = get();
    let data = [...valuations];
    
    if (filters.fundIds.length > 0) {
      data = data.filter(v => filters.fundIds.includes(v.fundId));
    }
    
    const latestByFund = new Map<string, ValuationRecord>();
    data.forEach(v => {
      const existing = latestByFund.get(v.fundId);
      if (!existing || v.valuationDate > existing.valuationDate) {
        latestByFund.set(v.fundId, v);
      }
    });
    
    return Array.from(latestByFund.entries()).map(([fundId, valuation]) => {
      const fund = funds.find(f => f.fundId === fundId);
      const fundShares = shares.filter(s => s.fundId === fundId && s.shareDate === valuation.valuationDate);
      const latestShare = fundShares[fundShares.length - 1];
      
      return {
        fundName: fund?.fundName || fundId,
        normalShares: latestShare?.normalShares || 0,
        sidePocketShares: latestShare?.sidePocketShares || 0,
        totalShares: latestShare?.totalShares || 0,
      };
    });
  },
  
  runAnomalyDetection: () => {
    const { valuations, shares, sidePockets } = get();
    const results = batchDetectAnomalies(valuations, shares, sidePockets);
    
    set({
      valuations: valuations.map(v => {
        const result = results.get(v.valuationId);
        if (!result) return v;
        
        const hasError = result.details.some(d => d.type === 'missing_field' || d.type === 'coverage_over');
        const hasWarning = result.details.some(d => d.type !== 'missing_field' && d.type !== 'coverage_over');
        const newStatus = getInitialStatusForAnomalies(hasError, hasWarning);
        
        return {
          ...v,
          anomalies: result.anomalies,
          status: v.status === 'processed' && result.hasAnomaly ? newStatus : v.status,
        };
      }),
    });
  },
}));
