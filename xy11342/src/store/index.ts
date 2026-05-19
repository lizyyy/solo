import { create } from 'zustand';
import {
  PickupOrder,
  RepairOrder,
  ClaimOrder,
  ClaimRule,
  ImportError,
  AuditLog,
  BatchResult,
  FilterParams
} from '@/types';
import {
  generateId,
  generateOrderNo,
  getCurrentUser,
  validatePickupOrder,
  validateRepairOrder,
  validateClaimRule,
  recordAuditLog
} from '@/utils';

interface AppState {
  pickupOrders: PickupOrder[];
  repairOrders: RepairOrder[];
  claimOrders: ClaimOrder[];
  claimRules: ClaimRule[];
  importErrors: ImportError[];
  auditLogs: AuditLog[];

  addPickupOrder: (order: Omit<PickupOrder, 'id' | 'orderNo' | 'createdAt' | 'createdBy' | 'createdRole'>) => void;
  updatePickupOrder: (id: string, updates: Partial<PickupOrder>) => void;
  batchImportPickupOrders: (data: Record<string, any>[]) => BatchResult<PickupOrder>;
  filterPickupOrders: (params: FilterParams) => PickupOrder[];

  addRepairOrder: (order: Omit<RepairOrder, 'id' | 'repairNo' | 'createdAt' | 'createdBy' | 'createdRole'>) => void;
  updateRepairOrder: (id: string, updates: Partial<RepairOrder>) => void;
  batchImportRepairOrders: (data: Record<string, any>[]) => BatchResult<RepairOrder>;
  filterRepairOrders: (params: FilterParams) => RepairOrder[];

  addClaimOrder: (order: Omit<ClaimOrder, 'id' | 'claimNo' | 'createdAt' | 'createdBy' | 'createdRole'>) => void;
  updateClaimOrder: (id: string, updates: Partial<ClaimOrder>) => void;
  generateClaimFromRepair: (repairOrderId: string) => ClaimOrder | null;
  filterClaimOrders: (params: FilterParams) => ClaimOrder[];

  addClaimRule: (rule: Omit<ClaimRule, 'id' | 'createdAt'>) => void;
  updateClaimRule: (id: string, updates: Partial<ClaimRule>) => void;
  batchImportClaimRules: (data: Record<string, any>[]) => BatchResult<ClaimRule>;

  updateImportError: (id: string, updates: Partial<ImportError>) => void;
  retryImportError: (id: string) => boolean;
  retryAllImportErrors: () => { success: number; failed: number };

  addAuditLog: (log: Omit<AuditLog, 'id' | 'operateTime'>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  pickupOrders: [],
  repairOrders: [],
  claimOrders: [],
  claimRules: [],
  importErrors: [],
  auditLogs: [],

  addPickupOrder: (order) => {
    const user = getCurrentUser();
    const newOrder: PickupOrder = {
      ...order,
      id: generateId(),
      orderNo: generateOrderNo('PJ'),
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdRole: user.role
    };
    set((state) => ({ pickupOrders: [newOrder, ...state.pickupOrders] }));
    recordAuditLog('领件管理', '新增领件单', { orderNo: newOrder.orderNo });
  },

  updatePickupOrder: (id, updates) => {
    set((state) => ({
      pickupOrders: state.pickupOrders.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
      )
    }));
    recordAuditLog('领件管理', '更新领件单', { orderId: id, updates });
  },

  batchImportPickupOrders: (data) => {
    const user = getCurrentUser();
    const successItems: PickupOrder[] = [];
    const failedItems: { item: Record<string, any>; error: string; suggestion?: string }[] = [];

    data.forEach((row, index) => {
      const validation = validatePickupOrder(row);
      if (validation.valid) {
        const newOrder: PickupOrder = {
          id: generateId(),
          orderNo: generateOrderNo('PJ'),
          engineerId: row.engineerId || generateId(),
          engineerName: row.engineerName,
          partCode: row.partCode,
          partName: row.partName,
          quantity: Number(row.quantity),
          pickupDate: row.pickupDate,
          status: row.status || 'pending',
          remark: row.remark,
          createdAt: new Date().toISOString(),
          createdBy: user.id,
          createdRole: user.role
        };
        successItems.push(newOrder);
      } else {
        const importError: ImportError = {
          id: generateId(),
          importType: 'pickup',
          rowNumber: index + 2,
          originalData: row,
          errorReason: validation.errors.join('; '),
          suggestion: validation.suggestion || '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        set((state) => ({ importErrors: [...state.importErrors, importError] }));
        failedItems.push({
          item: row,
          error: validation.errors.join('; '),
          suggestion: validation.suggestion
        });
      }
    });

    if (successItems.length > 0) {
      set((state) => ({ pickupOrders: [...successItems, ...state.pickupOrders] }));
    }

    recordAuditLog('领件管理', '批量导入领件单', {
      total: data.length,
      success: successItems.length,
      failed: failedItems.length
    });

    return {
      success: successItems.length,
      failed: failedItems.length,
      total: data.length,
      successItems,
      failedItems
    };
  },

  filterPickupOrders: (params) => {
    let result = [...get().pickupOrders];
    if (params.operator) {
      result = result.filter((o) => o.engineerName.includes(params.operator!));
    }
    if (params.startDate) {
      result = result.filter((o) => o.pickupDate >= params.startDate!);
    }
    if (params.endDate) {
      result = result.filter((o) => o.pickupDate <= params.endDate!);
    }
    if (params.status) {
      result = result.filter((o) => o.status === params.status);
    }
    return result;
  },

  addRepairOrder: (order) => {
    const user = getCurrentUser();
    const newOrder: RepairOrder = {
      ...order,
      id: generateId(),
      repairNo: generateOrderNo('WX'),
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdRole: user.role
    };
    set((state) => ({ repairOrders: [newOrder, ...state.repairOrders] }));
    recordAuditLog('返修管理', '新增返修单', { repairNo: newOrder.repairNo });
  },

  updateRepairOrder: (id, updates) => {
    set((state) => ({
      repairOrders: state.repairOrders.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
      )
    }));
    recordAuditLog('返修管理', '更新返修单', { repairId: id, updates });
  },

  batchImportRepairOrders: (data) => {
    const user = getCurrentUser();
    const successItems: RepairOrder[] = [];
    const failedItems: { item: Record<string, any>; error: string; suggestion?: string }[] = [];

    data.forEach((row, index) => {
      const validation = validateRepairOrder(row);
      if (validation.valid) {
        const newOrder: RepairOrder = {
          id: generateId(),
          repairNo: generateOrderNo('WX'),
          pickupOrderId: row.pickupOrderId,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          faultType: row.faultType,
          faultDescription: row.faultDescription,
          repairDate: row.repairDate,
          engineerId: row.engineerId || generateId(),
          engineerName: row.engineerName,
          oldPartReturned: row.oldPartReturned || 'no',
          status: row.status || 'pending',
          createdAt: new Date().toISOString(),
          createdBy: user.id,
          createdRole: user.role
        };
        successItems.push(newOrder);
      } else {
        const importError: ImportError = {
          id: generateId(),
          importType: 'repair',
          rowNumber: index + 2,
          originalData: row,
          errorReason: validation.errors.join('; '),
          suggestion: validation.suggestion || '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        set((state) => ({ importErrors: [...state.importErrors, importError] }));
        failedItems.push({
          item: row,
          error: validation.errors.join('; '),
          suggestion: validation.suggestion
        });
      }
    });

    if (successItems.length > 0) {
      set((state) => ({ repairOrders: [...successItems, ...state.repairOrders] }));
    }

    recordAuditLog('返修管理', '批量导入返修单', {
      total: data.length,
      success: successItems.length,
      failed: failedItems.length
    });

    return {
      success: successItems.length,
      failed: failedItems.length,
      total: data.length,
      successItems,
      failedItems
    };
  },

  filterRepairOrders: (params) => {
    let result = [...get().repairOrders];
    if (params.operator) {
      result = result.filter((o) => o.engineerName.includes(params.operator!));
    }
    if (params.startDate) {
      result = result.filter((o) => o.repairDate >= params.startDate!);
    }
    if (params.endDate) {
      result = result.filter((o) => o.repairDate <= params.endDate!);
    }
    if (params.status) {
      result = result.filter((o) => o.status === params.status);
    }
    return result;
  },

  addClaimOrder: (order) => {
    const user = getCurrentUser();
    const newOrder: ClaimOrder = {
      ...order,
      id: generateId(),
      claimNo: generateOrderNo('SP'),
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdRole: user.role
    };
    set((state) => ({ claimOrders: [newOrder, ...state.claimOrders] }));
    recordAuditLog('索赔管理', '新增索赔单', { claimNo: newOrder.claimNo });
  },

  updateClaimOrder: (id, updates) => {
    set((state) => ({
      claimOrders: state.claimOrders.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o
      )
    }));
    recordAuditLog('索赔管理', '更新索赔单', { claimId: id, updates });
  },

  generateClaimFromRepair: (repairOrderId) => {
    const repairOrder = get().repairOrders.find((o) => o.id === repairOrderId);
    if (!repairOrder) return null;

    const rule = get().claimRules.find((r) => r.faultType === repairOrder.faultType && r.isActive);
    if (!rule) return null;

    const user = getCurrentUser();
    const newClaim: ClaimOrder = {
      id: generateId(),
      claimNo: generateOrderNo('SP'),
      repairOrderId,
      ruleId: rule.id,
      claimAmount: rule.amount,
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdRole: user.role
    };

    set((state) => ({ claimOrders: [newClaim, ...state.claimOrders] }));
    recordAuditLog('索赔管理', '生成索赔单', { claimNo: newClaim.claimNo, repairNo: repairOrder.repairNo });
    return newClaim;
  },

  filterClaimOrders: (params) => {
    let result = [...get().claimOrders];
    if (params.startDate) {
      result = result.filter((o) => (o.submitDate || o.createdAt) >= params.startDate!);
    }
    if (params.endDate) {
      result = result.filter((o) => (o.submitDate || o.createdAt) <= params.endDate!);
    }
    if (params.status) {
      result = result.filter((o) => o.status === params.status);
    }
    return result;
  },

  addClaimRule: (rule) => {
    const newRule: ClaimRule = {
      ...rule,
      id: generateId(),
      createdAt: new Date().toISOString()
    };
    set((state) => ({ claimRules: [newRule, ...state.claimRules] }));
    recordAuditLog('索赔规则', '新增索赔规则', { ruleName: newRule.ruleName });
  },

  updateClaimRule: (id, updates) => {
    set((state) => ({
      claimRules: state.claimRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      )
    }));
    recordAuditLog('索赔规则', '更新索赔规则', { ruleId: id, updates });
  },

  batchImportClaimRules: (data) => {
    const successItems: ClaimRule[] = [];
    const failedItems: { item: Record<string, any>; error: string; suggestion?: string }[] = [];

    data.forEach((row, index) => {
      const validation = validateClaimRule(row);
      if (validation.valid) {
        const newRule: ClaimRule = {
          id: generateId(),
          ruleName: row.ruleName,
          faultType: row.faultType,
          amount: Number(row.amount),
          conditions: row.conditions || '',
          isActive: row.isActive !== false,
          createdAt: new Date().toISOString()
        };
        successItems.push(newRule);
      } else {
        const importError: ImportError = {
          id: generateId(),
          importType: 'claim-rule',
          rowNumber: index + 2,
          originalData: row,
          errorReason: validation.errors.join('; '),
          suggestion: validation.suggestion || '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        set((state) => ({ importErrors: [...state.importErrors, importError] }));
        failedItems.push({
          item: row,
          error: validation.errors.join('; '),
          suggestion: validation.suggestion
        });
      }
    });

    if (successItems.length > 0) {
      set((state) => ({ claimRules: [...successItems, ...state.claimRules] }));
    }

    recordAuditLog('索赔规则', '批量导入索赔规则', {
      total: data.length,
      success: successItems.length,
      failed: failedItems.length
    });

    return {
      success: successItems.length,
      failed: failedItems.length,
      total: data.length,
      successItems,
      failedItems
    };
  },

  updateImportError: (id, updates) => {
    set((state) => ({
      importErrors: state.importErrors.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      )
    }));
  },

  retryImportError: (id) => {
    const error = get().importErrors.find((e) => e.id === id);
    if (!error || error.status !== 'pending') return false;

    if (error.importType === 'pickup') {
      const validation = validatePickupOrder(error.originalData);
      if (validation.valid) {
        get().batchImportPickupOrders([error.originalData]);
        set((state) => ({
          importErrors: state.importErrors.map((e) =>
            e.id === id ? { ...e, status: 'fixed' } : e
          )
        }));
        recordAuditLog('数据导入', '重试导入成功', { errorId: id });
        return true;
      }
    } else if (error.importType === 'repair') {
      const validation = validateRepairOrder(error.originalData);
      if (validation.valid) {
        get().batchImportRepairOrders([error.originalData]);
        set((state) => ({
          importErrors: state.importErrors.map((e) =>
            e.id === id ? { ...e, status: 'fixed' } : e
          )
        }));
        recordAuditLog('数据导入', '重试导入成功', { errorId: id });
        return true;
      }
    } else if (error.importType === 'claim-rule') {
      const validation = validateClaimRule(error.originalData);
      if (validation.valid) {
        get().batchImportClaimRules([error.originalData]);
        set((state) => ({
          importErrors: state.importErrors.map((e) =>
            e.id === id ? { ...e, status: 'fixed' } : e
          )
        }));
        recordAuditLog('数据导入', '重试导入成功', { errorId: id });
        return true;
      }
    }

    return false;
  },

  retryAllImportErrors: () => {
    const pendingErrors = get().importErrors.filter((e) => e.status === 'pending');
    let successCount = 0;
    let failedCount = 0;

    pendingErrors.forEach((error) => {
      const success = get().retryImportError(error.id);
      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    });

    recordAuditLog('数据导入', '批量重试导入', {
      total: pendingErrors.length,
      success: successCount,
      failed: failedCount
    });

    return { success: successCount, failed: failedCount };
  },

  addAuditLog: (log) => {
    const newLog: AuditLog = {
      ...log,
      id: generateId(),
      operateTime: new Date().toISOString()
    };
    set((state) => ({ auditLogs: [newLog, ...state.auditLogs] }));
  }
}));
