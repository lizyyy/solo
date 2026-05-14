import { create } from 'zustand';
import type { BoothApplication, FilterParams, BoothStatus } from '../types';
import { mockApplications, getStatsData } from '../data/mockData';
import dayjs from 'dayjs';

interface BoothStore {
  applications: BoothApplication[];
  selectedApplication: BoothApplication | null;
  filters: FilterParams;
  setFilters: (filters: FilterParams) => void;
  selectApplication: (app: BoothApplication | null) => void;
  approveApplication: (id: string) => void;
  rejectApplication: (id: string, reason: string) => void;
  approveMaterial: (appId: string, materialId: string) => void;
  rejectMaterial: (appId: string, materialId: string, reason: string) => void;
  approveElectricity: (id: string, approvedPower: number) => void;
  rejectElectricity: (id: string, reason: string) => void;
  confirmDeposit: (id: string) => void;
  confirmSetup: (id: string) => void;
  startTeardownInspection: (id: string) => void;
  completeTeardown: (id: string, passed: boolean, damageDescription?: string, repairCost?: number) => void;
  processDeduction: (id: string, deductionAmount: number, reason: string) => void;
  checkScheduleConflict: (boothId: string, startDate: string, endDate: string, excludeId?: string) => boolean;
  getFilteredApplications: () => BoothApplication[];
  getStats: () => ReturnType<typeof getStatsData>;
  getStatusText: (status: BoothStatus) => string;
  getStatusColor: (status: BoothStatus) => string;
}

export const useBoothStore = create<BoothStore>((set, get) => ({
  applications: mockApplications,
  selectedApplication: null,
  filters: {},

  setFilters: (filters) => set({ filters }),

  selectApplication: (app) => set({ selectedApplication: app }),

  approveApplication: (id) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { ...app, status: 'material_review' as BoothStatus, currentStep: 2, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : app
    ),
  })),

  rejectApplication: (id, _reason) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { ...app, status: 'rejected' as BoothStatus, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : app
    ),
  })),

  approveMaterial: (appId, materialId) => set((state) => {
    const app = state.applications.find(a => a.id === appId);
    if (!app) return state;
    
    const updatedMaterials = app.materials.map(m => 
      m.id === materialId ? { ...m, status: 'approved' as const } : m
    );
    
    const allApproved = updatedMaterials.every(m => m.status === 'approved');
    const hasIssue = updatedMaterials.some(m => m.status === 'rejected');
    
    return {
      applications: state.applications.map(a => 
        a.id === appId ? { 
          ...a, 
          materials: updatedMaterials,
          status: allApproved ? 'electricity_approved' as BoothStatus : a.status,
          currentStep: allApproved ? 3 : a.currentStep,
          hasMaterialIssue: hasIssue,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
        } : a
      ),
    };
  }),

  rejectMaterial: (appId, materialId, reason) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === appId ? { 
        ...app, 
        materials: app.materials.map(m => m.id === materialId ? { ...m, status: 'rejected' as const, reviewRemark: reason } : m),
        hasMaterialIssue: true,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : app
    ),
  })),

  approveElectricity: (id, approvedPower) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { 
        ...app, 
        electricity: { ...app.electricity, status: 'approved' as const, approvedPower },
        status: 'deposit_paid' as BoothStatus,
        currentStep: 4,
        hasElectricityIssue: false,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : app
    ),
  })),

  rejectElectricity: (id, reason) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { 
        ...app, 
        electricity: { ...app.electricity, status: 'rejected' as const, reviewRemark: reason },
        hasElectricityIssue: true,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : app
    ),
  })),

  confirmDeposit: (id) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { 
        ...app, 
        deposit: { ...app.deposit, status: 'paid' as const, paidAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
        status: 'setup_confirmed' as BoothStatus,
        currentStep: 5,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : app
    ),
  })),

  confirmSetup: (id) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { 
        ...app, 
        status: 'in_use' as BoothStatus,
        currentStep: 6,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : app
    ),
  })),

  startTeardownInspection: (id) => set((state) => ({
    applications: state.applications.map(app => 
      app.id === id ? { 
        ...app, 
        teardown: { ...app.teardown, status: 'inspecting' as const },
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : app
    ),
  })),

  completeTeardown: (id, passed, damageDescription, repairCost) => set((state) => {
    const app = state.applications.find(a => a.id === id);
    if (!app) return state;
    
    return {
      applications: state.applications.map(a => 
        a.id === id ? { 
          ...a, 
          teardown: { 
            ...a.teardown, 
            status: passed ? 'passed' as const : 'failed' as const,
            groundScratches: !passed,
            damageDescription,
            repairCost,
            inspectedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            inspector: '当前用户'
          },
          deposit: {
            ...a.deposit,
            status: passed ? 'refunded' as const : 'refund_pending' as const,
            refundedAt: passed ? dayjs().format('YYYY-MM-DD HH:mm:ss') : undefined,
          },
          status: passed ? 'completed' as BoothStatus : 'teardown_pending',
          currentStep: passed ? 9 : 7,
          hasTeardownIssue: !passed,
          hasDepositIssue: !passed,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
        } : a
      ),
    };
  }),

  processDeduction: (id, deductionAmount, reason) => set((state) => {
    const app = state.applications.find(a => a.id === id);
    if (!app) return state;
    
    return {
      applications: state.applications.map(a => 
        a.id === id ? { 
          ...a, 
          deposit: {
            ...a.deposit,
            status: 'refunded' as const,
            deductionAmount,
            deductionReason: reason,
            refundedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          },
          status: 'completed' as BoothStatus,
          currentStep: 9,
          hasTeardownIssue: false,
          hasDepositIssue: false,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
        } : a
      ),
    };
  }),

  checkScheduleConflict: (boothId, startDate, endDate, excludeId) => {
    const { applications } = get();
    const newStart = dayjs(startDate);
    const newEnd = dayjs(endDate);
    
    return applications.some(app => {
      if (excludeId && app.id === excludeId) return false;
      if (app.boothId !== boothId) return false;
      if (app.status === 'rejected' || app.status === 'completed') return false;
      
      const appStart = dayjs(app.startDate);
      const appEnd = dayjs(app.endDate);
      
      return newStart.isBefore(appEnd) && newEnd.isAfter(appStart);
    });
  },

  getFilteredApplications: () => {
    const { applications, filters } = get();
    return applications.filter(app => {
      if (filters.status && app.status !== filters.status) return false;
      if (filters.brandName && !app.brandName.includes(filters.brandName)) return false;
      if (filters.boothCode && !app.boothCode.includes(filters.boothCode)) return false;
      if (filters.startDate && dayjs(app.startDate).isBefore(filters.startDate)) return false;
      if (filters.endDate && dayjs(app.endDate).isAfter(filters.endDate)) return false;
      if (filters.hasIssues) {
        const hasIssue = app.hasScheduleConflict || app.hasMaterialIssue || app.hasElectricityIssue || app.hasDepositIssue || app.hasTeardownIssue;
        if (!hasIssue) return false;
      }
      return true;
    });
  },

  getStats: () => {
    const { applications } = get();
    return getStatsData(applications);
  },

  getStatusText: (status) => {
    const statusMap: Record<BoothStatus, string> = {
      pending_approval: '待审核',
      material_review: '材料审核中',
      electricity_approved: '电力已审核',
      deposit_paid: '押金已缴纳',
      setup_confirmed: '搭建已确认',
      in_use: '使用中',
      teardown_pending: '待撤场验收',
      teardown_approved: '撤场已通过',
      completed: '已完成',
      rejected: '已拒绝',
    };
    return statusMap[status];
  },

  getStatusColor: (status) => {
    const colorMap: Record<BoothStatus, string> = {
      pending_approval: 'orange',
      material_review: 'blue',
      electricity_approved: 'cyan',
      deposit_paid: 'purple',
      setup_confirmed: 'geekblue',
      in_use: 'green',
      teardown_pending: 'orange',
      teardown_approved: 'green',
      completed: 'success',
      rejected: 'red',
    };
    return colorMap[status];
  },
}));
