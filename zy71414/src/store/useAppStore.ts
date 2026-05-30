import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DiscountApplication,
  ApplicationFilters,
  Supplier,
  Payable,
  StatusTransition,
  PaymentRecord,
  EvidenceItem,
  ApplicationStatus,
} from '../types';
import {
  SUPPLIERS,
  PAYABLES,
  APPLICATIONS,
  TRANSITIONS,
  PAYMENTS,
  EVIDENCE,
} from '../data/mockData';
import { ApprovalStateMachine } from '../services/ApprovalStateMachine';
import { PaymentIdempotency } from '../services/PaymentIdempotency';
import { ExportService } from '../services/ExportService';
import { generateApplicationNo, generateId } from '../utils/format';
import { DiscountCalculator } from '../services/DiscountCalculator';

interface AppState {
  applications: DiscountApplication[];
  suppliers: Supplier[];
  payables: Payable[];
  statusTransitions: StatusTransition[];
  paymentRecords: PaymentRecord[];
  evidenceItems: EvidenceItem[];
  filters: ApplicationFilters;
  selectedIds: string[];
  currentOperator: string;

  setFilters: (filters: Partial<ApplicationFilters>) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  selectAll: () => void;

  getFilteredApplications: () => DiscountApplication[];
  getApplicationById: (id: string) => DiscountApplication | undefined;
  getTransitionsByApplicationId: (id: string) => StatusTransition[];
  getPaymentsByApplicationId: (id: string) => PaymentRecord[];
  getEvidenceByApplicationId: (id: string) => EvidenceItem[];
  getSupplierById: (id: string) => Supplier | undefined;
  getPayableById: (id: string) => Payable | undefined;

  createApplication: (data: Partial<DiscountApplication>) => string;
  updateApplication: (id: string, data: Partial<DiscountApplication>) => void;
  transitionStatus: (id: string, to: ApplicationStatus, remark: string) => void;
  recordPayment: (applicationId: string, amount: number) => PaymentRecord;
  addEvidence: (item: Omit<EvidenceItem, 'id' | 'timestamp'>) => void;

  exportSelectedCSV: () => void;
  exportSelectedExcel: () => void;

  resetToMockData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      applications: [...APPLICATIONS],
      suppliers: [...SUPPLIERS],
      payables: [...PAYABLES],
      statusTransitions: [...TRANSITIONS],
      paymentRecords: [...PAYMENTS],
      evidenceItems: [...EVIDENCE],
      filters: {},
      selectedIds: [],
      currentOperator: '当前用户',

      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),

      toggleSelected: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((i) => i !== id)
            : [...state.selectedIds, id],
        })),

      clearSelected: () => set({ selectedIds: [] }),

      selectAll: () =>
        set((state) => ({
          selectedIds: state.getFilteredApplications().map((a) => a.id),
        })),

      getFilteredApplications: () => {
        const { applications, filters } = get();
        return applications.filter((app) => {
          if (filters.supplierId && app.supplierId !== filters.supplierId) return false;
          if (filters.status && app.status !== filters.status) return false;
          if (filters.minDiscountRate && app.discountRate < filters.minDiscountRate) return false;
          if (filters.maxDiscountRate && app.discountRate > filters.maxDiscountRate) return false;
          if (filters.startDate && app.createdAt < filters.startDate) return false;
          if (filters.endDate && app.createdAt > filters.endDate) return false;
          if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            if (
              !app.applicationNo.toLowerCase().includes(kw) &&
              !app.supplierName.toLowerCase().includes(kw)
            )
              return false;
          }
          return true;
        });
      },

      getApplicationById: (id) => get().applications.find((a) => a.id === id),

      getTransitionsByApplicationId: (id) =>
        get()
          .statusTransitions.filter((t) => t.applicationId === id)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),

      getPaymentsByApplicationId: (id) =>
        get()
          .paymentRecords.filter((p) => p.applicationId === id)
          .sort((a, b) => b.version - a.version),

      getEvidenceByApplicationId: (id) =>
        get()
          .evidenceItems.filter((e) => e.applicationId === id)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),

      getSupplierById: (id) => get().suppliers.find((s) => s.id === id),

      getPayableById: (id) => get().payables.find((p) => p.id === id),

      createApplication: (data) => {
        const payable = get().payables.find((p) => p.id === data.payableId);
        const supplier = payable
          ? get().suppliers.find((s) => s.id === payable.supplierId)
          : undefined;

        const calc = DiscountCalculator.calculate(
          data.payableAmount || 0,
          data.originalDueDate || '',
          data.proposedDueDate || '',
          data.discountRate || 0
        );

        const newApp: DiscountApplication = {
          id: generateId('APP_'),
          applicationNo: generateApplicationNo(),
          supplierId: supplier?.id || '',
          supplierName: supplier?.name || '',
          supplierLevel: supplier?.level || 'C',
          payableId: data.payableId || '',
          payableAmount: data.payableAmount || 0,
          originalDueDate: data.originalDueDate || '',
          proposedDueDate: data.proposedDueDate || '',
          discountRate: data.discountRate || 0,
          discountAmount: calc.discountAmount,
          actualPaymentAmount: calc.actualPayment,
          status: 'DRAFT',
          currentVersion: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: get().currentOperator,
          remark: data.remark,
        };

        set((state) => ({ applications: [newApp, ...state.applications] }));

        get().addEvidence({
          applicationId: newApp.id,
          type: 'STATUS_CHANGE',
          content: `创建新申请，状态为草稿`,
          operator: get().currentOperator,
          metadata: { from: null, to: 'DRAFT' },
        });

        return newApp.id;
      },

      updateApplication: (id, data) => {
        const app = get().getApplicationById(id);
        if (!app) return;

        const calc = DiscountCalculator.calculate(
          data.payableAmount ?? app.payableAmount,
          data.originalDueDate ?? app.originalDueDate,
          data.proposedDueDate ?? app.proposedDueDate,
          data.discountRate ?? app.discountRate
        );

        set((state) => ({
          applications: state.applications.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...data,
                  discountAmount: calc.discountAmount,
                  actualPaymentAmount: calc.actualPayment,
                  currentVersion: a.currentVersion + 1,
                  updatedAt: new Date().toISOString(),
                }
              : a
          ),
        }));

        get().addEvidence({
          applicationId: id,
          type: 'FIELD_CHANGE',
          content: `修改申请信息，版本升级为 v${(app.currentVersion + 1)}`,
          operator: get().currentOperator,
          metadata: { newVersion: app.currentVersion + 1 },
        });
      },

      transitionStatus: (id, to, remark) => {
        const app = get().getApplicationById(id);
        if (!app) return;
        if (!ApprovalStateMachine.canTransition(app.status, to)) return;

        const transition = ApprovalStateMachine.createTransition(
          id,
          app.status,
          to,
          get().currentOperator,
          remark
        );

        set((state) => ({
          applications: state.applications.map((a) =>
            a.id === id ? { ...a, status: to, updatedAt: new Date().toISOString() } : a
          ),
          statusTransitions: [...state.statusTransitions, transition],
        }));

        get().addEvidence({
          applicationId: id,
          type: 'STATUS_CHANGE',
          content: `状态从 ${app.status} 变更为 ${to}`,
          operator: get().currentOperator,
          metadata: { from: app.status, to, remark },
        });
      },

      recordPayment: (applicationId, amount) => {
        const payment = PaymentIdempotency.createPaymentRecord(
          applicationId,
          amount,
          get().currentOperator,
          get().paymentRecords
        );

        set((state) => ({
          paymentRecords: [...state.paymentRecords, payment],
        }));

        if (payment.isDuplicate) {
          get().addEvidence({
            applicationId,
            type: 'PAYMENT',
            content: `检测到重复付款尝试，已标记但记录保留: ${payment.paymentNo}`,
            operator: get().currentOperator,
            metadata: { paymentNo: payment.paymentNo, amount, isDuplicate: true },
          });
        } else {
          get().transitionStatus(applicationId, 'PAID', '付款完成');
          get().addEvidence({
            applicationId,
            type: 'PAYMENT',
            content: `付款完成: ${payment.paymentNo}，金额 ${amount.toLocaleString()} 元`,
            operator: get().currentOperator,
            metadata: { paymentNo: payment.paymentNo, amount },
          });
        }

        return payment;
      },

      addEvidence: (item) => {
        const newItem: EvidenceItem = {
          ...item,
          id: generateId('EVD_'),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          evidenceItems: [...state.evidenceItems, newItem],
        }));
      },

      exportSelectedCSV: () => {
        const { selectedIds, applications } = get();
        const selectedApps = applications.filter((a) => selectedIds.includes(a.id));
        const blob = ExportService.exportToCSV(selectedApps);
        ExportService.downloadBlob(blob, ExportService.generateFilename('折扣申请', 'csv'));
      },

      exportSelectedExcel: () => {
        const { selectedIds, applications, paymentRecords } = get();
        const selectedApps = applications.filter((a) => selectedIds.includes(a.id));
        const selectedPayments = paymentRecords.filter((p) =>
          selectedIds.includes(p.applicationId)
        );
        const blob = ExportService.exportToExcel(selectedApps, selectedPayments);
        ExportService.downloadBlob(blob, ExportService.generateFilename('折扣申请', 'xlsx'));
      },

      resetToMockData: () => {
        set({
          applications: [...APPLICATIONS],
          suppliers: [...SUPPLIERS],
          payables: [...PAYABLES],
          statusTransitions: [...TRANSITIONS],
          paymentRecords: [...PAYMENTS],
          evidenceItems: [...EVIDENCE],
          filters: {},
          selectedIds: [],
        });
      },
    }),
    {
      name: 'discount-app-storage',
    }
  )
);
