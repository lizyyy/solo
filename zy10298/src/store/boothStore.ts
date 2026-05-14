import { create } from 'zustand';
import type { BoothApplication, FilterParams, BoothStatus, MaterialItem } from '../types';
import { mockApplications, getStatsData } from '../data/mockData';
import dayjs from 'dayjs';

const STORAGE_KEY = 'booth-applications';

const loadFromStorage = (): BoothApplication[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load from localStorage');
  }
  return mockApplications;
};

const saveToStorage = (applications: BoothApplication[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
  } catch {
    console.warn('Failed to save to localStorage');
  }
};

export const boothList = [
  { id: 'BT001', code: 'A-01', name: '主入口展位', location: '一层正门入口处', area: 20, maxElectricity: 10, basePrice: 5000 },
  { id: 'BT002', code: 'A-02', name: '中庭展位A', location: '一层中庭北侧', area: 30, maxElectricity: 15, basePrice: 8000 },
  { id: 'BT003', code: 'A-03', name: '中庭展位B', location: '一层中庭南侧', area: 30, maxElectricity: 15, basePrice: 8000 },
  { id: 'BT004', code: 'B-01', name: '扶梯口展位', location: '二层扶梯口', area: 15, maxElectricity: 8, basePrice: 4000 },
  { id: 'BT005', code: 'B-02', name: '餐饮区展位', location: '三层餐饮区入口', area: 25, maxElectricity: 20, basePrice: 6000 },
];

export const brandList = [
  { id: 'B001', name: '星巴克' },
  { id: 'B002', name: '优衣库' },
  { id: 'B003', name: '苹果' },
  { id: 'B004', name: '耐克' },
  { id: 'B005', name: '阿迪达斯' },
];

interface CreateApplicationParams {
  brandId: string;
  brandName: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  boothLocation: string;
  startDate: string;
  endDate: string;
  purpose: string;
  estimatedSetupDate: string;
  estimatedTeardownDate: string;
  materials: MaterialItem[];
  appliedPower: number;
  depositAmount: number;
}

interface BatchImportResult {
  success: number;
  duplicates: number;
  conflicts: number;
  failed: number;
}

interface BoothStore {
  applications: BoothApplication[];
  selectedApplication: BoothApplication | null;
  filters: FilterParams;
  isInitialized: boolean;
  setFilters: (filters: FilterParams) => void;
  selectApplication: (app: BoothApplication | null) => void;
  createApplication: (params: CreateApplicationParams) => { success: boolean; conflict: boolean; app?: BoothApplication };
  batchImportApplications: (paramsList: CreateApplicationParams[]) => BatchImportResult;
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
  resetToMockData: () => void;
}

export const useBoothStore = create<BoothStore>((set, get) => ({
  applications: [],
  selectedApplication: null,
  filters: {},
  isInitialized: false,

  setFilters: (filters) => set({ filters }),

  selectApplication: (app) => set({ selectedApplication: app }),

  createApplication: (params) => {
    const { applications, checkScheduleConflict } = get();

    const hasConflict = checkScheduleConflict(params.boothId, params.startDate, params.endDate);

    const isDuplicate = applications.some(
      (app) =>
        app.brandId === params.brandId &&
        app.boothId === params.boothId &&
        app.startDate === params.startDate &&
        app.endDate === params.endDate
    );

    if (isDuplicate) {
      return { success: false, conflict: hasConflict };
    }

    const maxNo = applications.reduce(
      (max, app) => {
        const match = app.applicationNo.match(/-(\d+)$/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      },
      0
    );

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const newApp: BoothApplication = {
      id: `APP${String(Date.now()).slice(-6)}`,
      applicationNo: `BTH-${dayjs().format('YYYY-MM-DD')}-${String(maxNo + 1).padStart(3, '0')}`,
      ...params,
      status: 'pending_approval',
      electricity: {
        id: `E${Date.now()}`,
        appliedPower: params.appliedPower,
        status: 'pending',
      },
      deposit: {
        id: `D${Date.now()}`,
        amount: params.depositAmount,
        status: 'unpaid',
      },
      teardown: {
        id: `T${Date.now()}`,
        status: 'pending',
        groundScratches: false,
      },
      createdAt: now,
      updatedAt: now,
      hasScheduleConflict: hasConflict,
      hasMaterialIssue: false,
      hasElectricityIssue: false,
      hasDepositIssue: false,
      hasTeardownIssue: false,
      currentStep: 1,
    };

    const newApplications = [newApp, ...applications];
    saveToStorage(newApplications);
    set({ applications: newApplications });

    return { success: true, conflict: hasConflict, app: newApp };
  },

  batchImportApplications: (paramsList) => {
    const { applications, checkScheduleConflict } = get();
    const result: BatchImportResult = { success: 0, duplicates: 0, conflicts: 0, failed: 0 };
    const newApps: BoothApplication[] = [];

    let maxNo = applications.reduce(
      (max, app) => {
        const match = app.applicationNo.match(/-(\d+)$/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      },
      0
    );

    for (const params of paramsList) {
      const hasConflict = checkScheduleConflict(params.boothId, params.startDate, params.endDate);
      if (hasConflict) {
        result.conflicts++;
        continue;
      }

      const isDuplicate = [...applications, ...newApps].some(
        (app) =>
          app.brandId === params.brandId &&
          app.boothId === params.boothId &&
          app.startDate === params.startDate &&
          app.endDate === params.endDate
      );

      if (isDuplicate) {
        result.duplicates++;
        continue;
      }

      maxNo++;
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const newApp: BoothApplication = {
        id: `APP${String(Date.now() + maxNo).slice(-6)}`,
        applicationNo: `BTH-${dayjs().format('YYYY-MM-DD')}-${String(maxNo).padStart(3, '0')}`,
        ...params,
        status: 'pending_approval',
        electricity: {
          id: `E${Date.now() + maxNo}`,
          appliedPower: params.appliedPower,
          status: 'pending',
        },
        deposit: {
          id: `D${Date.now() + maxNo}`,
          amount: params.depositAmount,
          status: 'unpaid',
        },
        teardown: {
          id: `T${Date.now() + maxNo}`,
          status: 'pending',
          groundScratches: false,
        },
        createdAt: now,
        updatedAt: now,
        hasScheduleConflict: false,
        hasMaterialIssue: false,
        hasElectricityIssue: params.appliedPower > (boothList.find((b) => b.id === params.boothId)?.maxElectricity || 0),
        hasDepositIssue: false,
        hasTeardownIssue: false,
        currentStep: 1,
      };

      newApps.push(newApp);
      result.success++;
    }

    const newApplications = [...newApps, ...applications];
    saveToStorage(newApplications);
    set({ applications: newApplications });

    return result;
  },

  approveApplication: (id) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'pending_approval') return state;

      const newApplications = state.applications.map((a) =>
        a.id === id ? { ...a, status: 'material_review' as BoothStatus, currentStep: 2, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  rejectApplication: (id, reason) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'pending_approval') return state;

      const newApplications = state.applications.map((a) =>
        a.id === id ? { ...a, status: 'rejected' as BoothStatus, rejectReason: reason, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') } : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  approveMaterial: (appId, materialId) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === appId);
      if (!app || app.status !== 'material_review') return state;

      const updatedMaterials = app.materials.map((m) => (m.id === materialId ? { ...m, status: 'approved' as const } : m));

      const allApproved = updatedMaterials.every((m) => m.status === 'approved');
      const hasRejected = updatedMaterials.some((m) => m.status === 'rejected');

      const newApplications = state.applications.map((a) =>
        a.id === appId
          ? {
              ...a,
              materials: updatedMaterials,
              status: allApproved && !hasRejected ? ('electricity_approved' as BoothStatus) : a.status,
              currentStep: allApproved && !hasRejected ? 3 : a.currentStep,
              hasMaterialIssue: hasRejected,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  rejectMaterial: (appId, materialId, reason) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === appId);
      if (!app || app.status !== 'material_review') return state;

      const newApplications = state.applications.map((a) =>
        a.id === appId
          ? {
              ...a,
              materials: a.materials.map((m) => (m.id === materialId ? { ...m, status: 'rejected' as const, reviewRemark: reason } : m)),
              hasMaterialIssue: true,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  approveElectricity: (id, approvedPower) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'electricity_approved') return state;
      
      const booth = boothList.find((b) => b.id === app.boothId);
      const maxPower = booth?.maxElectricity || 0;
      
      const hasElectricityIssue = approvedPower > maxPower;

      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              electricity: { ...a.electricity, status: 'approved' as const, approvedPower },
              status: hasElectricityIssue ? a.status : ('deposit_paid' as BoothStatus),
              currentStep: hasElectricityIssue ? a.currentStep : 4,
              hasElectricityIssue,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  rejectElectricity: (id, reason) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'electricity_approved') return state;

      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              electricity: { ...a.electricity, status: 'rejected' as const, reviewRemark: reason },
              hasElectricityIssue: true,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  confirmDeposit: (id) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'deposit_paid') return state;
      if (app.hasMaterialIssue || app.hasElectricityIssue) return state;

      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              deposit: { ...a.deposit, status: 'paid' as const, paidAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
              status: 'setup_confirmed' as BoothStatus,
              currentStep: 5,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  confirmSetup: (id) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'setup_confirmed') return state;

      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'in_use' as BoothStatus,
              currentStep: 6,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  startTeardownInspection: (id) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app || app.status !== 'in_use') return state;

      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'teardown_pending' as BoothStatus,
              currentStep: 7,
              teardown: { ...a.teardown, status: 'inspecting' as const },
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  completeTeardown: (id, passed, damageDescription, repairCost) =>
    set((state) => {
      const app = state.applications.find((a) => a.id === id);
      if (!app) return state;

      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
              ...a,
              teardown: {
                ...a.teardown,
                status: passed ? ('passed' as const) : ('failed' as const),
                groundScratches: !passed,
                damageDescription,
                repairCost,
                inspectedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                inspector: '当前用户',
              },
              deposit: {
                ...a.deposit,
                status: passed ? ('refunded' as const) : ('refund_pending' as const),
                refundedAt: passed ? dayjs().format('YYYY-MM-DD HH:mm:ss') : undefined,
              },
              status: passed ? ('completed' as BoothStatus) : 'teardown_pending',
              currentStep: passed ? 9 : 7,
              hasTeardownIssue: !passed,
              hasDepositIssue: !passed,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  processDeduction: (id, deductionAmount, reason) =>
    set((state) => {
      const newApplications = state.applications.map((a) =>
        a.id === id
          ? {
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
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            }
          : a
      );
      saveToStorage(newApplications);
      return { applications: newApplications };
    }),

  checkScheduleConflict: (boothId, startDate, endDate, excludeId) => {
    const { applications } = get();
    const newStart = dayjs(startDate);
    const newEnd = dayjs(endDate);

    return applications.some((app) => {
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
    return applications.filter((app) => {
      if (filters.status && app.status !== filters.status) return false;
      if (filters.brandName && !app.brandName.includes(filters.brandName)) return false;
      if (filters.boothCode && !app.boothCode.includes(filters.boothCode)) return false;
      if (filters.startDate && dayjs(app.startDate).isBefore(filters.startDate)) return false;
      if (filters.endDate && dayjs(app.endDate).isAfter(filters.endDate)) return false;
      if (filters.hasIssues) {
        const hasIssue =
          app.hasScheduleConflict ||
          app.hasMaterialIssue ||
          app.hasElectricityIssue ||
          app.hasDepositIssue ||
          app.hasTeardownIssue;
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

  resetToMockData: () => {
    saveToStorage(mockApplications);
    set({ applications: mockApplications });
  },
}));

setTimeout(() => {
  useBoothStore.setState({ applications: loadFromStorage(), isInitialized: true });
}, 0);
