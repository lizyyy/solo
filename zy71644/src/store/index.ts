import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import type { Bond, YieldCurve, Report, AppException, CalculationParams } from '@/types';
import { generateCashFlows, calculateDuration, calculateConvexity, calculateSensitivity } from '@/utils/calculationEngine';

interface AppState {
  bonds: Bond[];
  curves: YieldCurve[];
  reports: Report[];
  exceptions: AppException[];
  selectedBondId: string | null;
  selectedCurveId: string | null;
  selectedReportId: string | null;
  calculationParams: CalculationParams;
  showExceptionDrawer: boolean;
}

interface AppActions {
  addBond: (bond: Omit<Bond, 'id' | 'version' | 'createdAt' | 'updatedAt'>) => void;
  updateBond: (id: string, bond: Partial<Bond>) => void;
  deleteBond: (id: string) => void;
  selectBond: (id: string | null) => void;
  addCurve: (curve: Omit<YieldCurve, 'id' | 'version' | 'createdAt' | 'updatedAt'>) => void;
  updateCurve: (id: string, curve: Partial<YieldCurve>) => void;
  deleteCurve: (id: string) => void;
  selectCurve: (id: string | null) => void;
  setCalculationParams: (params: Partial<CalculationParams>) => void;
  generateReport: (bondId: string, curveId: string, params: CalculationParams) => void;
  updateReportStatus: (id: string, status: Report['status'], remark?: string) => void;
  addHandoverRecord: (reportId: string, fromUser: string, toUser: string, message: string) => void;
  deleteReport: (id: string) => void;
  selectReport: (id: string | null) => void;
  addException: (exception: Omit<AppException, 'id' | 'timestamp'>) => void;
  clearException: (id: string) => void;
  clearAllExceptions: () => void;
  toggleExceptionDrawer: () => void;
  importMockData: () => void;
}

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      bonds: [],
      curves: [],
      reports: [],
      exceptions: [],
      selectedBondId: null,
      selectedCurveId: null,
      selectedReportId: null,
      calculationParams: {
        valuationDate: new Date().toISOString().split('T')[0],
        yieldCurveId: '',
        spread: new Decimal(0),
        priceType: 'CLEAN',
        yieldShiftBpSmall: 1,
        yieldShiftBpLarge: 100
      },
      showExceptionDrawer: false,

      addBond: (bond) => set((state) => ({
        bonds: [...state.bonds, {
          ...bond,
          id: uuidv4(),
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updateBond: (id, bond) => set((state) => ({
        bonds: state.bonds.map((b) =>
          b.id === id ? { ...b, ...bond, version: b.version + 1, updatedAt: new Date().toISOString() } : b
        )
      })),

      deleteBond: (id) => set((state) => ({
        bonds: state.bonds.filter((b) => b.id !== id)
      })),

      selectBond: (id) => set({ selectedBondId: id }),

      addCurve: (curve) => set((state) => ({
        curves: [...state.curves, {
          ...curve,
          id: uuidv4(),
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      })),

      updateCurve: (id, curve) => set((state) => ({
        curves: state.curves.map((c) =>
          c.id === id ? { ...c, ...curve, version: c.version + 1, updatedAt: new Date().toISOString() } : c
        )
      })),

      deleteCurve: (id) => set((state) => ({
        curves: state.curves.filter((c) => c.id !== id)
      })),

      selectCurve: (id) => set({ selectedCurveId: id }),

      setCalculationParams: (params) => set((state) => ({
        calculationParams: { ...state.calculationParams, ...params }
      })),

      generateReport: (bondId, curveId, params) => {
        const { bonds, curves } = get();
        const bond = bonds.find((b) => b.id === bondId);
        const curve = curves.find((c) => c.id === curveId);

        if (!bond || !curve) return;

        const { cashFlows, exceptions: cfExceptions } = generateCashFlows(bond);
        
        cfExceptions.forEach((e) => get().addException(e));

        const ytm = curve.points.length > 0 ? curve.points[Math.floor(curve.points.length / 2)].rate : new Decimal(0.03);

        const { result: durationResult, exceptions: durExceptions } = calculateDuration(
          bond, cashFlows, ytm, params.valuationDate, curve
        );
        durExceptions.forEach((e) => get().addException(e));

        const { result: convexityResult, exceptions: convExceptions } = calculateConvexity(
          bond, cashFlows, ytm, params.valuationDate, curve
        );
        convExceptions.forEach((e) => get().addException(e));

        const sensitivityResult = calculateSensitivity(
          bond, cashFlows, ytm, params.valuationDate, params
        );

        const report: Report = {
          id: uuidv4(),
          bondId,
          bondVersion: bond.version,
          curveId,
          curveVersion: curve.version,
          params,
          duration: durationResult,
          convexity: convexityResult,
          sensitivity: sensitivityResult,
          cashFlows,
          status: 'PENDING_CONFIRM',
          handoverRecord: [],
          createdAt: new Date().toISOString(),
          createdBy: '当前用户',
          updatedAt: new Date().toISOString()
        };

        set((state) => ({
          reports: [...state.reports, report]
        }));
      },

      updateReportStatus: (id, status, remark) => set((state) => ({
        reports: state.reports.map((r) =>
          r.id === id ? { ...r, status, statusRemark: remark, updatedAt: new Date().toISOString() } : r
        )
      })),

      addHandoverRecord: (reportId, fromUser, toUser, message) => set((state) => ({
        reports: state.reports.map((r) =>
          r.id === reportId ? {
            ...r,
            handoverRecord: [...r.handoverRecord, {
              id: uuidv4(),
              fromUser,
              toUser,
              timestamp: new Date().toISOString(),
              message
            }],
            updatedAt: new Date().toISOString()
          } : r
        )
      })),

      deleteReport: (id) => set((state) => ({
        reports: state.reports.filter((r) => r.id !== id)
      })),

      selectReport: (id) => set({ selectedReportId: id }),

      addException: (exception) => set((state) => ({
        exceptions: [...state.exceptions, {
          ...exception,
          id: uuidv4(),
          timestamp: new Date().toISOString()
        }]
      })),

      clearException: (id) => set((state) => ({
        exceptions: state.exceptions.filter((e) => e.id !== id)
      })),

      clearAllExceptions: () => set({ exceptions: [] }),

      toggleExceptionDrawer: () => set((state) => ({
        showExceptionDrawer: !state.showExceptionDrawer
      })),

      importMockData: () => {
        const mockBond: Omit<Bond, 'id' | 'version' | 'createdAt' | 'updatedAt'> = {
          name: '23国债05',
          code: '019325',
          faceValue: new Decimal(100),
          couponRate: new Decimal(0.0285),
          couponFrequency: 2,
          issueDate: '2023-05-15',
          maturityDate: '2028-05-15',
          firstCouponDate: '2023-11-15',
          dayCountConvention: 'ACT/ACT',
          remarks: '5年期固定利率国债'
        };

        const mockCurve: Omit<YieldCurve, 'id' | 'version' | 'createdAt' | 'updatedAt'> = {
          name: '中债国债收益率曲线',
          valueDate: new Date().toISOString().split('T')[0],
          interpolationMethod: 'LINEAR',
          points: [
            { term: new Decimal(0.25), rate: new Decimal(0.021) },
            { term: new Decimal(0.5), rate: new Decimal(0.0235) },
            { term: new Decimal(1), rate: new Decimal(0.025) },
            { term: new Decimal(2), rate: new Decimal(0.0265) },
            { term: new Decimal(3), rate: new Decimal(0.0275) },
            { term: new Decimal(5), rate: new Decimal(0.0285) },
            { term: new Decimal(7), rate: new Decimal(0.0295) },
            { term: new Decimal(10), rate: new Decimal(0.0305) }
          ]
        };

        set((state) => ({
          bonds: [...state.bonds, {
            ...mockBond,
            id: uuidv4(),
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }],
          curves: [...state.curves, {
            ...mockCurve,
            id: uuidv4(),
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        }));
      }
    }),
    {
      name: 'bond-calculator-storage',
      partialize: (state) => ({
        bonds: state.bonds,
        curves: state.curves,
        reports: state.reports
      })
    }
  )
);
