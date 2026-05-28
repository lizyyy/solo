import { create } from 'zustand';
import dayjs from 'dayjs';
import type {
  ConvertibleBond,
  StockQuote,
  RedemptionAnnouncement,
  CustomerPosition,
  ReminderLog,
  DisposalTask,
  DataSourceTrace,
  TriggerWindowResult,
  SendReminderParams,
} from '@/types';
import {
  generateAllData,
  generateReminderLogs,
  generateDisposalTasks,
  generateDataTraces,
} from '@/mock/dataGenerator';
import { triggerWindowService } from '@/services/TriggerWindowService';
import { idempotencyService } from '@/services/IdempotencyService';

interface AppState {
  bonds: ConvertibleBond[];
  stockQuotes: Record<string, StockQuote[]>;
  announcements: Record<string, RedemptionAnnouncement[]>;
  positions: CustomerPosition[];
  reminderLogs: ReminderLog[];
  disposalTasks: DisposalTask[];
  dataTraces: DataSourceTrace[];
  triggerResults: Record<string, TriggerWindowResult>;
  selectedBondCode: string | null;
  activeTab: string;
  filters: Record<string, any>;
  isRefreshing: boolean;
  lastRefreshTime: string | null;
  selectedTaskIds: Set<string>;
  sidebarCollapsed: boolean;

  refreshAllData: () => Promise<void>;
  calculateTriggerWindows: () => void;
  createDisposalTask: (bondCode: string) => DisposalTask | null;
  sendReminder: (params: SendReminderParams) => ReminderLog;
  updateTaskStatus: (taskId: string, status: DisposalTask['status'], reason?: string, supplement?: string) => void;
  setSelectedBond: (bondCode: string | null) => void;
  setFilters: (filters: Record<string, any>) => void;
  setActiveTab: (tab: string) => void;
  toggleTaskSelection: (taskId: string) => void;
  clearTaskSelection: () => void;
  selectAllTasks: (taskIds: string[]) => void;
  toggleSidebar: () => void;
  getBondPositions: (bondCode: string) => CustomerPosition[];
  getBondAnnouncements: (bondCode: string) => RedemptionAnnouncement[];
  getBondTriggerResult: (bondCode: string) => TriggerWindowResult | null;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAppStore = create<AppState>((set, get) => ({
  bonds: [],
  stockQuotes: {},
  announcements: {},
  positions: [],
  reminderLogs: [],
  disposalTasks: [],
  dataTraces: [],
  triggerResults: {},
  selectedBondCode: null,
  activeTab: 'all',
  filters: {},
  isRefreshing: false,
  lastRefreshTime: null,
  selectedTaskIds: new Set(),
  sidebarCollapsed: false,

  refreshAllData: async () => {
    set({ isRefreshing: true });
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const { bonds, stockQuotes, announcements, positions } = generateAllData();
    
    const triggerResults: Record<string, TriggerWindowResult> = {};
    bonds.forEach(bond => {
      const quotes = stockQuotes[bond.stockCode] || [];
      const result = triggerWindowService.calculateTriggerWindow(bond.bondCode, quotes, '30_15');
      triggerResults[bond.bondCode] = result;
    });
    
    const reminderLogs = generateReminderLogs(bonds, positions);
    const disposalTasks = generateDisposalTasks(bonds, positions, triggerResults);
    const dataTraces = generateDataTraces(bonds, stockQuotes, announcements, positions);
    
    set({
      bonds,
      stockQuotes,
      announcements,
      positions,
      reminderLogs,
      disposalTasks,
      dataTraces,
      triggerResults,
      isRefreshing: false,
      lastRefreshTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
  },

  calculateTriggerWindows: () => {
    const { bonds, stockQuotes } = get();
    const triggerResults: Record<string, TriggerWindowResult> = {};
    
    bonds.forEach(bond => {
      const quotes = stockQuotes[bond.stockCode] || [];
      const result = triggerWindowService.calculateTriggerWindow(bond.bondCode, quotes, '30_15');
      triggerResults[bond.bondCode] = result;
    });
    
    set({ triggerResults });
  },

  createDisposalTask: (bondCode: string) => {
    const { bonds, positions, triggerResults, disposalTasks } = get();
    const bond = bonds.find(b => b.bondCode === bondCode);
    if (!bond) return null;
    
    const existingTask = disposalTasks.find(t => t.bondCode === bondCode && t.status !== 'PROCESSED');
    if (existingTask) return existingTask;
    
    const bondPositions = positions.filter(p => p.bondCode === bondCode);
    const totalPosition = bondPositions.reduce((sum, p) => sum + p.positionAmount, 0);
    const triggerResult = triggerResults[bondCode];
    
    const newTask: DisposalTask = {
      id: generateId(),
      bondCode: bond.bondCode,
      bondName: bond.bondName,
      taskType: 'REMIND_CUSTOMER',
      status: 'PENDING_CONFIRM',
      priority: totalPosition > 10000000 ? 'HIGH' : totalPosition > 1000000 ? 'MEDIUM' : 'LOW',
      customerCount: bondPositions.length,
      totalPosition: Number(totalPosition.toFixed(2)),
      assignedTo: '当前用户',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      confirmedAt: null,
      processedAt: null,
      returnedAt: null,
      returnReason: null,
      supplementRequirements: null,
      remarks: null,
      dataSourceSnapshot: {
        marketData: generateId(),
        announcement: generateId(),
        position: generateId(),
      },
    };
    
    set({ disposalTasks: [...disposalTasks, newTask] });
    return newTask;
  },

  sendReminder: (params: SendReminderParams) => {
    const { reminderLogs } = get();
    const idempotencyKey = idempotencyService.generateIdempotencyKey(
      params.bondCode,
      params.customerId,
      params.reminderType
    );
    
    const newLog: ReminderLog = {
      id: generateId(),
      ...params,
      remindedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      status: 'SENT',
      idempotencyKey,
    };
    
    set({ reminderLogs: [...reminderLogs, newLog] });
    return newLog;
  },

  updateTaskStatus: (taskId: string, status: DisposalTask['status'], reason?: string, supplement?: string) => {
    const { disposalTasks } = get();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    const updatedTasks = disposalTasks.map(task => {
      if (task.id !== taskId) return task;
      
      return {
        ...task,
        status,
        confirmedAt: status === 'PROCESSING' ? now : task.confirmedAt,
        processedAt: status === 'PROCESSED' ? now : task.processedAt,
        returnedAt: status === 'RETURNED' ? now : task.returnedAt,
        returnReason: reason || task.returnReason,
        supplementRequirements: supplement || task.supplementRequirements,
      };
    });
    
    set({ disposalTasks: updatedTasks });
  },

  setSelectedBond: (bondCode: string | null) => set({ selectedBondCode: bondCode }),
  setFilters: (filters: Record<string, any>) => set({ filters }),
  setActiveTab: (tab: string) => set({ activeTab: tab }),

  toggleTaskSelection: (taskId: string) => {
    const { selectedTaskIds } = get();
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    set({ selectedTaskIds: newSet });
  },

  clearTaskSelection: () => set({ selectedTaskIds: new Set() }),

  selectAllTasks: (taskIds: string[]) => {
    set({ selectedTaskIds: new Set(taskIds) });
  },

  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  getBondPositions: (bondCode: string) => {
    return get().positions.filter(p => p.bondCode === bondCode);
  },

  getBondAnnouncements: (bondCode: string) => {
    return get().announcements[bondCode] || [];
  },

  getBondTriggerResult: (bondCode: string) => {
    return get().triggerResults[bondCode] || null;
  },
}));
