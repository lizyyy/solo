import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BillStore, DashboardStats } from '@/types/store';
import { Bill, ImportResult } from '@/types/bill';
import { autoTransition } from '@/services/billStateMachine';
import { checkAllBillsForExceptions } from '@/services/exceptionDetector';
import { recalculateAllOccupancy } from '@/services/occupancyCalculator';
import { validateAndMergeBills } from '@/services/fileParser';
import { addAuditLogEntry } from '@/services/auditExport';

const STORAGE_KEY = 'bill-pool-management';

const useBillStore = create<BillStore>()(
  persist(
    (set, get) => ({
      bills: [],
      auditLogs: [],
      uploadFiles: [],
      selectedBillId: null,
      isLoading: false,
      error: null,

      setBills: (bills: Bill[]) => {
        set({ bills });
        get().saveToStorage();
      },

      addBill: (bill: Bill) => {
        const { bills, addAuditLog } = get();
        const newBills = [...bills, bill];
        set({ bills: newBills });
        addAuditLog({
          action: '新增票据',
          operator: 'User',
          details: `新增票据 ${bill.billNo}`,
          billId: bill.id,
          billNo: bill.billNo,
        });
        get().saveToStorage();
      },

      updateBill: (id: string, updates: Partial<Bill>) => {
        const { bills, addAuditLog } = get();
        const bill = bills.find(b => b.id === id);
        if (bill) {
          const updatedBills = bills.map(b =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          );
          set({ bills: updatedBills });
          addAuditLog({
            action: '更新票据',
            operator: 'User',
            details: `更新票据 ${bill.billNo}`,
            billId: id,
            billNo: bill.billNo,
          });
          get().saveToStorage();
        }
      },

      deleteBill: (id: string) => {
        const { bills, addAuditLog } = get();
        const bill = bills.find(b => b.id === id);
        if (bill) {
          const newBills = bills.filter(b => b.id !== id);
          set({ bills: newBills });
          addAuditLog({
            action: '删除票据',
            operator: 'User',
            details: `删除票据 ${bill.billNo}`,
            billId: id,
            billNo: bill.billNo,
          });
          get().saveToStorage();
        }
      },

      selectBill: (id: string | null) => {
        set({ selectedBillId: id });
      },

      addAuditLog: (entry) => {
        set(state => ({
          auditLogs: addAuditLogEntry(state.auditLogs, entry),
        }));
        get().saveToStorage();
      },

      addUploadFile: (item) => {
        set(state => ({
          uploadFiles: [...state.uploadFiles, item],
        }));
      },

      updateUploadFile: (fileName, updates) => {
        set(state => ({
          uploadFiles: state.uploadFiles.map(f =>
            f.name === fileName ? { ...f, ...updates } : f
          ),
        }));
      },

      clearUploadFiles: () => {
        set({ uploadFiles: [] });
      },

      importBills: async (result: ImportResult, sourceFile: string) => {
        const { bills, addAuditLog, checkExceptions, recalculateOccupancy } = get();
        set({ isLoading: true, error: null });

        try {
          const allNewBills = [...result.validBills, ...result.dirtyBills];
          
          let processedBills = allNewBills.map(bill => 
            autoTransition(bill, 'SYSTEM')
          );

          const mergedBills = validateAndMergeBills(bills, processedBills);
          
          set({ bills: mergedBills });
          
          checkExceptions();
          recalculateOccupancy();

          addAuditLog({
            action: '批量导入',
            operator: 'User',
            details: `导入文件 ${sourceFile}：共 ${result.total} 条，成功 ${result.validCount} 条，脏数据 ${result.dirtyCount} 条`,
          });

          set({ isLoading: false });
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : '导入失败' 
          });
          throw error;
        }
      },

      recalculateOccupancy: () => {
        const { bills } = get();
        const { bills: updatedBills } = recalculateAllOccupancy(bills);
        set({ bills: updatedBills });
        get().saveToStorage();
      },

      checkExceptions: () => {
        const { bills } = get();
        const checkedBills = checkAllBillsForExceptions(bills);
        set({ bills: checkedBills });
        get().saveToStorage();
      },

      checkMaturityReminders: () => {
        get().checkExceptions();
        get().recalculateOccupancy();
      },

      loadFromStorage: () => {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const data = JSON.parse(stored);
            set({
              bills: data.state?.bills || [],
              auditLogs: data.state?.auditLogs || [],
            });
          }
        } catch (e) {
          console.error('Failed to load from storage:', e);
        }
      },

      saveToStorage: () => {
      },

      clearAll: () => {
        set({
          bills: [],
          auditLogs: [],
          uploadFiles: [],
          selectedBillId: null,
        });
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        bills: state.bills,
        auditLogs: state.auditLogs,
      }),
    }
  )
);

export const useDashboardStats = (): DashboardStats => {
  const bills = useBillStore(state => state.bills);
  const validBills = bills.filter(b => !b.isDirty);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  const nextWeekStart = new Date(weekEnd);
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

  return {
    totalBills: validBills.length,
    pledgedBills: validBills.filter(b => b.status === 'pledged').length,
    maturedBills: validBills.filter(b => b.status === 'matured').length,
    releasedBills: validBills.filter(b => b.status === 'released').length,
    pendingBills: validBills.filter(b => b.status === 'pending').length,
    toConfirmBills: validBills.filter(b => b.status === 'to_confirm').length,
    totalMargin: validBills.reduce((sum, b) => sum + b.margin, 0),
    totalOccupancy: validBills.reduce((sum, b) => sum + (b.calculatedOccupancy || 0), 0),
    exceptionCount: validBills.filter(b => b.exceptions.some(e => !e.confirmed)).length,
    highSeverityCount: validBills.filter(b => 
      b.exceptions.some(e => !e.confirmed && e.severity === 'high')
    ).length,
    matureThisWeek: validBills.filter(b => 
      b.maturityDate >= today.toISOString().split('T')[0] && 
      b.maturityDate <= weekEnd.toISOString().split('T')[0] &&
      b.status !== 'released' && b.status !== 'closed'
    ).length,
    matureNextWeek: validBills.filter(b => 
      b.maturityDate >= nextWeekStart.toISOString().split('T')[0] && 
      b.maturityDate <= nextWeekEnd.toISOString().split('T')[0] &&
      b.status !== 'released' && b.status !== 'closed'
    ).length,
  };
};

export default useBillStore;
