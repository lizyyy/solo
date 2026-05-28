import { create } from 'zustand';
import type {
  Customer,
  Pledge,
  MarketData,
  MarginCall,
  SupplementRecord,
  ExtensionRecord,
  DisposalReport,
  HistoryRecord,
  PledgeCalculation,
  Statistics,
  Filters,
  ImportResult,
  ImportDataType,
  NotificationMethod,
  TimelineEvent,
  SpecialFlag,
} from '../types';
import { calculatePledgeRatio, generateId } from '../utils/calculator';
import { checkMarginCallDuplicate, generateMarginCallContent } from '../utils/deduplicator';
import { updatePledgeFlags } from '../utils/flagDetector';
import { createHistoryRecord } from '../utils/history';
import {
  parseExcelFile,
  validateImportData,
  transformImportData,
  generateExportReport,
  downloadReport,
} from '../utils/excel';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  getDefaultStorageData,
} from '../utils/storage';
import { validateStatisticsConsistency } from '../utils/consistency';
import { initializeMockData } from '../data/mockData';

interface AppState {
  customers: Customer[];
  pledges: Pledge[];
  marketData: Record<string, MarketData>;
  marginCalls: MarginCall[];
  supplements: SupplementRecord[];
  extensions: ExtensionRecord[];
  disposals: DisposalReport[];
  history: HistoryRecord[];
  calculationCache: Map<string, PledgeCalculation>;
  filters: Filters;
  loading: boolean;
  selectedPledgeId: string | null;
  operator: string;

  init: () => void;
  saveToStorage: () => void;
  loadFromStorage: () => boolean;
  loadMockData: () => void;
  clearAllData: () => void;

  setFilters: (filters: Partial<Filters>) => void;
  setSelectedPledgeId: (id: string | null) => void;

  calculatePledge: (pledgeId: string) => PledgeCalculation | null;
  invalidateCalculationCache: (pledgeId?: string) => void;
  getStatistics: () => Statistics;
  getFilteredPledges: () => Pledge[];
  getPledgeCustomer: (pledgeId: string) => Customer | undefined;
  getTimelineEvents: (pledgeId: string) => TimelineEvent[];

  importData: (type: ImportDataType, file: File) => Promise<ImportResult>;
  exportReport: (filters?: Partial<Filters>) => void;

  updatePledgeStatus: (pledgeId: string, status: Pledge['status']) => void;
  addSupplement: (pledgeId: string, data: Partial<SupplementRecord>) => void;
  updateSupplementStatus: (supplementId: string, status: SupplementRecord['status']) => void;
  addExtension: (pledgeId: string, data: Partial<ExtensionRecord>) => void;
  updateExtensionStatus: (extensionId: string, status: ExtensionRecord['status']) => void;
  addDisposal: (pledgeId: string, data: Partial<DisposalReport>) => void;
  sendMarginCall: (pledgeId: string, method: NotificationMethod) => { success: boolean; isDuplicate: boolean; message?: string };

  validateConsistency: () => ReturnType<typeof validateStatisticsConsistency>;
}

export const useAppStore = create<AppState>((set, get) => ({
  customers: [],
  pledges: [],
  marketData: {},
  marginCalls: [],
  supplements: [],
  extensions: [],
  disposals: [],
  history: [],
  calculationCache: new Map(),
  filters: {
    searchText: '',
    riskLevel: '',
    status: '',
    specialFlag: '',
    dateRange: ['', ''],
  },
  loading: false,
  selectedPledgeId: null,
  operator: '风控人员',

  init: () => {
    const loaded = get().loadFromStorage();
    if (!loaded) {
      get().loadMockData();
    }
  },

  saveToStorage: () => {
    const state = get();
    saveToLocalStorage({
      version: '1.0',
      customers: state.customers,
      pledges: state.pledges,
      marketData: state.marketData,
      marginCalls: state.marginCalls,
      supplements: state.supplements,
      extensions: state.extensions,
      disposals: state.disposals,
      history: state.history,
      lastUpdateTime: new Date().toISOString(),
    });
  },

  loadFromStorage: () => {
    const data = loadFromLocalStorage();
    if (data) {
      set({
        customers: data.customers,
        pledges: data.pledges,
        marketData: data.marketData,
        marginCalls: data.marginCalls,
        supplements: data.supplements,
        extensions: data.extensions,
        disposals: data.disposals,
        history: data.history,
        calculationCache: new Map(),
      });
      return true;
    }
    return false;
  },

  loadMockData: () => {
    const mockData = initializeMockData();
    set({
      customers: mockData.customers,
      pledges: mockData.pledges,
      marketData: mockData.marketData,
      supplements: mockData.supplements,
      extensions: mockData.extensions,
      disposals: mockData.disposals,
      marginCalls: mockData.marginCalls,
      history: mockData.history,
      calculationCache: new Map(),
    });
    get().saveToStorage();
  },

  clearAllData: () => {
    const defaultData = getDefaultStorageData();
    set({
      customers: defaultData.customers,
      pledges: defaultData.pledges,
      marketData: defaultData.marketData,
      marginCalls: defaultData.marginCalls,
      supplements: defaultData.supplements,
      extensions: defaultData.extensions,
      disposals: defaultData.disposals,
      history: defaultData.history,
      calculationCache: new Map(),
    });
    get().saveToStorage();
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  setSelectedPledgeId: (id) => {
    set({ selectedPledgeId: id });
  },

  calculatePledge: (pledgeId) => {
    const state = get();
    const cache = state.calculationCache;

    if (cache.has(pledgeId)) {
      return cache.get(pledgeId)!;
    }

    const pledge = state.pledges.find((p) => p.id === pledgeId);
    if (!pledge) return null;

    const marketData = state.marketData[pledge.stockCode];
    const calculation = calculatePledgeRatio(
      pledge,
      marketData,
      state.supplements,
      state.extensions
    );

    cache.set(pledgeId, calculation);
    return calculation;
  },

  invalidateCalculationCache: (pledgeId) => {
    set((state) => {
      const newCache = new Map(state.calculationCache);
      if (pledgeId) {
        newCache.delete(pledgeId);
      } else {
        newCache.clear();
      }
      return { calculationCache: newCache };
    });
  },

  getStatistics: () => {
    const state = get();
    const warningPledges = state.pledges.filter((p) => {
      const calc = state.calculatePledge(p.id);
      return calc?.isWarning;
    });

    const pendingSupplement = state.pledges.filter((p) =>
      p.specialFlags.includes('supplement_pending')
    ).length;

    const pendingExtension = state.pledges.filter((p) =>
      p.specialFlags.includes('extension_pending')
    ).length;

    const pendingDisposal = state.pledges.filter((p) => p.status === 'close').length;

    const specialCases = state.pledges.filter((p) => p.specialFlags.length > 0).length;

    return {
      totalWarning: warningPledges.length,
      pendingSupplement,
      pendingExtension,
      pendingDisposal,
      specialCases,
      lastUpdateTime: new Date().toISOString(),
    };
  },

  getFilteredPledges: () => {
    const state = get();
    const { filters, pledges, customers } = state;

    return pledges.filter((pledge) => {
      const customer = customers.find((c) => c.id === pledge.customerId);

      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchesSearch =
          customer?.accountNo.toLowerCase().includes(searchLower) ||
          customer?.customerName.toLowerCase().includes(searchLower) ||
          pledge.stockCode.toLowerCase().includes(searchLower) ||
          pledge.stockName.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.riskLevel && customer?.riskLevel !== filters.riskLevel) {
        return false;
      }

      if (filters.status && pledge.status !== filters.status) {
        return false;
      }

      if (filters.specialFlag && !pledge.specialFlags.includes(filters.specialFlag as SpecialFlag)) {
        return false;
      }

      return true;
    });
  },

  getPledgeCustomer: (pledgeId) => {
    const state = get();
    const pledge = state.pledges.find((p) => p.id === pledgeId);
    return state.customers.find((c) => c.id === pledge?.customerId);
  },

  getTimelineEvents: (pledgeId) => {
    const state = get();
    const events: TimelineEvent[] = [];

    const pledgeSupplements = state.supplements.filter((s) => s.pledgeId === pledgeId);
    pledgeSupplements.forEach((s) => {
      events.push({
        id: s.id,
        type: 'supplement',
        date: s.actualDate || s.expectedDate,
        title: s.status === 'received' ? '补仓已到账' : '补仓登记',
        description: `补仓金额：${s.amount.toLocaleString()}元`,
        status: s.status,
        color: '#059669',
      });
    });

    const pledgeCalls = state.marginCalls.filter((m) => m.pledgeId === pledgeId);
    pledgeCalls.forEach((m) => {
      events.push({
        id: m.id,
        type: 'marginCall',
        date: m.sendTime.split('T')[0],
        title: m.isDuplicate ? '重复通知' : '补仓通知',
        description: `通知方式：${m.method === 'sms' ? '短信' : m.method === 'email' ? '邮件' : '电话'}，接收人：${m.receiver}`,
        status: m.isDuplicate ? 'duplicate' : 'sent',
        color: '#dc2626',
      });
    });

    const pledgeExtensions = state.extensions.filter((e) => e.pledgeId === pledgeId);
    pledgeExtensions.forEach((e) => {
      events.push({
        id: e.id,
        type: 'extension',
        date: e.approveDate || e.applyDate,
        title: e.status === 'approved' ? '展期已通过' : e.status === 'rejected' ? '展期已拒绝' : '展期申请',
        description: `新到期日：${e.newEndDate}，新警戒线：${e.newWarningLine.toFixed(2)}%`,
        status: e.status,
        color: '#9333ea',
      });
    });

    const pledgeDisposals = state.disposals.filter((d) => d.pledgeId === pledgeId);
    pledgeDisposals.forEach((d) => {
      events.push({
        id: d.id,
        type: 'disposal',
        date: d.reportDate,
        title: '处置报告',
        description: d.reportContent.substring(0, 50) + '...',
        status: d.status,
        color: '#dc2626',
      });
    });

    const pledgeHistory = state.history.filter((h) => h.pledgeId === pledgeId);
    pledgeHistory.forEach((h) => {
      if (h.operationType === 'status_update') {
        events.push({
          id: h.id,
          type: 'status',
          date: h.operateTime.split('T')[0],
          title: '状态变更',
          description: `${h.beforeValue} → ${h.afterValue}`,
          status: h.afterValue,
          color: '#3b82f6',
        });
      }
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  importData: async (type, file) => {
    const state = get();
    const rawData = await parseExcelFile(file);
    const { errors, warnings, validData } = validateImportData(
      rawData,
      type,
      state.pledges,
      state.customers
    );

    if (errors.length > 0) {
      return {
        success: false,
        total: rawData.length,
        imported: 0,
        errors,
        warnings,
      };
    }

    const transformed = transformImportData(validData, type, state.pledges, state.customers);

    set((prev) => {
      const newCustomers = [...prev.customers];
      transformed.customers.forEach((c) => {
        const existing = newCustomers.find((ec) => ec.accountNo === c.accountNo);
        if (!existing) {
          newCustomers.push(c);
        }
      });

      const newPledges = [...prev.pledges];
      transformed.pledges.forEach((p) => {
        const existingIndex = newPledges.findIndex(
          (ep) => ep.customerId === p.customerId && ep.stockCode === p.stockCode
        );
        if (existingIndex >= 0) {
          newPledges[existingIndex] = {
            ...newPledges[existingIndex],
            ...p,
            updatedAt: new Date().toISOString(),
          };
        } else {
          newPledges.push(p);
        }
      });

      const newMarketData = { ...prev.marketData };
      transformed.marketData.forEach((m) => {
        newMarketData[m.stockCode] = m;
      });

      const newSupplements = [...prev.supplements, ...transformed.supplements];
      const newExtensions = [...prev.extensions, ...transformed.extensions];
      const newDisposals = [...prev.disposals, ...transformed.disposals];

      const finalPledges = newPledges.map((p) =>
        updatePledgeFlags(p, newMarketData[p.stockCode], newSupplements, newExtensions)
      );

      const historyRecord = createHistoryRecord(
        'system',
        'import',
        'data_import',
        '原有数据',
        `导入${type}数据${validData.length}条`,
        state.operator
      );

      return {
        customers: newCustomers,
        pledges: finalPledges,
        marketData: newMarketData,
        supplements: newSupplements,
        extensions: newExtensions,
        disposals: newDisposals,
        history: [...prev.history, historyRecord],
        calculationCache: new Map(),
      };
    });

    get().saveToStorage();

    return {
      success: true,
      total: rawData.length,
      imported: validData.length,
      errors,
      warnings,
    };
  },

  exportReport: (filters) => {
    const state = get();
    const pledges = filters ? state.getFilteredPledges() : state.pledges;
    const calculations = new Map<string, PledgeCalculation>();
    pledges.forEach((p) => {
      const calc = state.calculatePledge(p.id);
      if (calc) {
        calculations.set(p.id, calc);
      }
    });

    const statistics = state.getStatistics();
    const consistencyCheck = state.validateConsistency();
    if (!consistencyCheck.passed) {
      console.warn('数据一致性校验未通过，仍继续导出', consistencyCheck);
    }

    const blob = generateExportReport({
      customers: state.customers,
      pledges,
      marketData: state.marketData,
      supplements: state.supplements,
      extensions: state.extensions,
      disposals: state.disposals,
      history: state.history,
      calculations,
      statistics: {
        ...statistics,
        exportTime: new Date().toISOString(),
      },
    });

    downloadReport(blob);
  },

  updatePledgeStatus: (pledgeId, status) => {
    const state = get();
    const pledge = state.pledges.find((p) => p.id === pledgeId);
    if (!pledge) return;

    const historyRecord = createHistoryRecord(
      pledgeId,
      'status_update',
      'status',
      pledge.status,
      status,
      state.operator
    );

    set((prev) => ({
      pledges: prev.pledges.map((p) =>
        p.id === pledgeId
          ? { ...p, status, updatedAt: new Date().toISOString() }
          : p
      ),
      history: [...prev.history, historyRecord],
    }));

    get().invalidateCalculationCache(pledgeId);
    get().saveToStorage();
  },

  addSupplement: (pledgeId, data) => {
    const state = get();
    const pledge = state.pledges.find((p) => p.id === pledgeId);
    if (!pledge) return;

    const newSupplement: SupplementRecord = {
      id: generateId(),
      pledgeId,
      amount: data.amount || 0,
      expectedDate: data.expectedDate || new Date().toISOString().split('T')[0],
      actualDate: data.actualDate,
      status: data.status || 'pending',
      afterPledgeRatio: 0,
    };

    const historyRecord = createHistoryRecord(
      pledgeId,
      'supplement',
      'supplement',
      '无',
      `补仓${(data.amount || 0).toLocaleString()}元，预计${newSupplement.expectedDate}到账`,
      state.operator
    );

    set((prev) => {
      const newSupplements = [...prev.supplements, newSupplement];
      const newPledges = prev.pledges.map((p) =>
        p.id === pledgeId
          ? updatePledgeFlags(p, prev.marketData[p.stockCode], newSupplements, prev.extensions)
          : p
      );

      return {
        supplements: newSupplements,
        pledges: newPledges,
        history: [...prev.history, historyRecord],
      };
    });

    get().invalidateCalculationCache(pledgeId);
    get().saveToStorage();
  },

  updateSupplementStatus: (supplementId, status) => {
    const state = get();
    const supplement = state.supplements.find((s) => s.id === supplementId);
    if (!supplement) return;

    const calc = state.calculatePledge(supplement.pledgeId);
    const afterPledgeRatio = calc?.pledgeRatio || 0;

    const historyRecord = createHistoryRecord(
      supplement.pledgeId,
      'supplement',
      'supplement_status',
      supplement.status,
      status,
      state.operator
    );

    set((prev) => {
      const newSupplements = prev.supplements.map((s) =>
        s.id === supplementId
          ? {
              ...s,
              status,
              actualDate: status === 'received' ? new Date().toISOString().split('T')[0] : s.actualDate,
              afterPledgeRatio,
            }
          : s
      );

      const newPledges = prev.pledges.map((p) =>
        p.id === supplement.pledgeId
          ? updatePledgeFlags(p, prev.marketData[p.stockCode], newSupplements, prev.extensions)
          : p
      );

      return {
        supplements: newSupplements,
        pledges: newPledges,
        history: [...prev.history, historyRecord],
      };
    });

    get().invalidateCalculationCache(supplement.pledgeId);
    get().saveToStorage();
  },

  addExtension: (pledgeId, data) => {
    const state = get();
    const pledge = state.pledges.find((p) => p.id === pledgeId);
    if (!pledge) return;

    const newExtension: ExtensionRecord = {
      id: generateId(),
      pledgeId,
      applyDate: data.applyDate || new Date().toISOString().split('T')[0],
      approveDate: data.approveDate,
      newEndDate: data.newEndDate || '',
      newWarningLine: data.newWarningLine || pledge.warningLine,
      status: data.status || 'pending',
    };

    const historyRecord = createHistoryRecord(
      pledgeId,
      'extension',
      'extension',
      '无',
      `申请展期至${newExtension.newEndDate}，警戒线${newExtension.newWarningLine.toFixed(2)}%`,
      state.operator
    );

    set((prev) => {
      const newExtensions = [...prev.extensions, newExtension];
      const newPledges = prev.pledges.map((p) =>
        p.id === pledgeId
          ? updatePledgeFlags(p, prev.marketData[p.stockCode], prev.supplements, newExtensions)
          : p
      );

      return {
        extensions: newExtensions,
        pledges: newPledges,
        history: [...prev.history, historyRecord],
      };
    });

    get().invalidateCalculationCache(pledgeId);
    get().saveToStorage();
  },

  updateExtensionStatus: (extensionId, status) => {
    const state = get();
    const extension = state.extensions.find((e) => e.id === extensionId);
    if (!extension) return;

    const historyRecord = createHistoryRecord(
      extension.pledgeId,
      'extension',
      'extension_status',
      extension.status,
      status,
      state.operator
    );

    set((prev) => {
      const newExtensions = prev.extensions.map((e) =>
        e.id === extensionId
          ? {
              ...e,
              status,
              approveDate: status === 'approved' ? new Date().toISOString().split('T')[0] : e.approveDate,
            }
          : e
      );

      const newPledges = prev.pledges.map((p) => {
        if (p.id === extension.pledgeId) {
          const updated = updatePledgeFlags(p, prev.marketData[p.stockCode], prev.supplements, newExtensions);
          if (status === 'approved') {
            return { ...updated, status: 'extended' as const, updatedAt: new Date().toISOString() };
          }
          return updated;
        }
        return p;
      });

      return {
        extensions: newExtensions,
        pledges: newPledges,
        history: [...prev.history, historyRecord],
      };
    });

    get().invalidateCalculationCache(extension.pledgeId);
    get().saveToStorage();
  },

  addDisposal: (pledgeId, data) => {
    const state = get();
    const pledge = state.pledges.find((p) => p.id === pledgeId);
    if (!pledge) return;

    const newDisposal: DisposalReport = {
      id: generateId(),
      pledgeId,
      reportDate: data.reportDate || new Date().toISOString().split('T')[0],
      reportContent: data.reportContent || '',
      operator: state.operator,
      status: data.status || 'draft',
    };

    const historyRecord = createHistoryRecord(
      pledgeId,
      'disposal',
      'disposal',
      '无',
      `提交处置报告：${newDisposal.reportContent.substring(0, 30)}...`,
      state.operator
    );

    set((prev) => ({
      disposals: [...prev.disposals, newDisposal],
      history: [...prev.history, historyRecord],
    }));

    get().saveToStorage();
  },

  sendMarginCall: (pledgeId, method) => {
    const state = get();
    const pledge = state.pledges.find((p) => p.id === pledgeId);
    const customer = state.getPledgeCustomer(pledgeId);
    if (!pledge || !customer) {
      return { success: false, isDuplicate: false, message: '找不到客户或质押记录' };
    }

    const dupCheck = checkMarginCallDuplicate(pledgeId, state.marginCalls);
    const calc = state.calculatePledge(pledgeId);
    if (!calc) {
      return { success: false, isDuplicate: false, message: '计算失败' };
    }

    const content = generateMarginCallContent(
      customer.customerName,
      pledge.stockName,
      pledge.stockCode,
      calc.pledgeRatio,
      calc.effectiveWarningLine
    );

    const newCall: MarginCall = {
      id: generateId(),
      pledgeId,
      sendTime: new Date().toISOString(),
      content,
      receiver: customer.customerName,
      method,
      isDuplicate: dupCheck.isDuplicate,
    };

    if (!dupCheck.shouldSend) {
      return {
        success: false,
        isDuplicate: true,
        message: dupCheck.reason,
      };
    }

    set((prev) => ({
      marginCalls: [...prev.marginCalls, newCall],
    }));

    get().saveToStorage();

    return {
      success: true,
      isDuplicate: false,
      message: `已通过${method === 'sms' ? '短信' : method === 'email' ? '邮件' : '电话'}发送通知`,
    };
  },

  validateConsistency: () => {
    const state = get();
    const calculations = new Map<string, PledgeCalculation>();
    state.pledges.forEach((p) => {
      const calc = state.calculatePledge(p.id);
      if (calc) {
        calculations.set(p.id, calc);
      }
    });

    const statistics = state.getStatistics();
    return validateStatisticsConsistency(state.pledges, calculations, statistics);
  },
}));
