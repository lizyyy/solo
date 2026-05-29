import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BondPosition,
  RedemptionAnnouncement,
  ExerciseApplication,
  ConflictRecord,
  StatusChangeLog,
  RedemptionListItem,
  FilterConditions,
  OperationLog,
  ExportRecord,
  ApplicationStatus,
  ConflictType,
  ExportConfig,
} from '@/types';
import { mockData } from '@/data/mockData';
import { generateId } from '@/utils/format';
import { canTransitionStatus } from '@/utils/validation';
import { exportToExcel, generateExportSummary } from '@/utils/export';

interface AppState {
  positions: BondPosition[];
  announcements: RedemptionAnnouncement[];
  applications: ExerciseApplication[];
  conflictRecords: ConflictRecord[];
  statusChangeLogs: StatusChangeLog[];
  listItems: RedemptionListItem[];
  operationLogs: OperationLog[];
  exportRecords: ExportRecord[];
  filterConditions: FilterConditions;
  selectedIds: string[];
  currentOperator: string;
  isLoading: boolean;
  filterAndSortListItems: () => RedemptionListItem[];
  setFilterConditions: (conditions: Partial<FilterConditions>) => void;
  clearFilterConditions: () => void;
  toggleSelectedId: (id: string) => void;
  clearSelectedIds: () => void;
  selectAll: (ids: string[]) => void;
  updateApplicationStatus: (
    applicationId: string,
    newStatus: ApplicationStatus,
    remark?: string
  ) => boolean;
  updateConflictJudgment: (
    conflictId: string,
    manualJudgment: string,
    operator: string
  ) => void;
  recordOperation: (
    type: OperationLog['operationType'],
    description: string,
    detail?: Record<string, unknown>
  ) => void;
  exportData: (
    items: RedemptionListItem[],
    config?: Partial<ExportConfig>
  ) => string;
  getConflictRecordsForApplication: (applicationId: string) => ConflictRecord[];
  getStatusLogsForApplication: (applicationId: string) => StatusChangeLog[];
  getPositionForApplication: (applicationId: string) => BondPosition | undefined;
  getAnnouncementForApplication: (applicationId: string) => RedemptionAnnouncement | undefined;
  getApplicationById: (applicationId: string) => ExerciseApplication | undefined;
  getConflictStats: () => Record<ConflictType, number> & { total: number; normal: number };
  getStatusStats: () => Record<ApplicationStatus, number>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      positions: mockData.positions,
      announcements: mockData.announcements,
      applications: mockData.applications,
      conflictRecords: mockData.conflictRecords,
      statusChangeLogs: mockData.statusChangeLogs,
      listItems: mockData.listItems,
      operationLogs: mockData.operationLogs,
      exportRecords: mockData.exportRecords,
      filterConditions: {},
      selectedIds: [],
      currentOperator: '张运营',
      isLoading: false,

      filterAndSortListItems: () => {
        const { listItems, filterConditions } = get();
        let filtered = [...listItems];

        if (filterConditions.bondCode) {
          filtered = filtered.filter((item) =>
            item.bondCode.toLowerCase().includes(filterConditions.bondCode!.toLowerCase())
          );
        }

        if (filterConditions.customerName) {
          filtered = filtered.filter((item) =>
            item.customerName.includes(filterConditions.customerName!)
          );
        }

        if (filterConditions.exerciseDateStart) {
          filtered = filtered.filter(
            (item) => item.announcementExerciseDate >= filterConditions.exerciseDateStart!
          );
        }

        if (filterConditions.exerciseDateEnd) {
          filtered = filtered.filter(
            (item) => item.announcementExerciseDate <= filterConditions.exerciseDateEnd!
          );
        }

        if (filterConditions.applicationStatus?.length) {
          filtered = filtered.filter((item) =>
            filterConditions.applicationStatus!.includes(item.applicationStatus)
          );
        }

        if (filterConditions.conflictTypes?.length) {
          filtered = filtered.filter((item) =>
            filterConditions.conflictTypes!.some((type) => item.conflicts.includes(type))
          );
        }

        if (filterConditions.positionQuantityMin !== undefined) {
          filtered = filtered.filter(
            (item) => item.positionQuantity >= filterConditions.positionQuantityMin!
          );
        }

        if (filterConditions.applyQuantityMin !== undefined) {
          filtered = filtered.filter(
            (item) => item.applyQuantity >= filterConditions.applyQuantityMin!
          );
        }

        filtered.sort((a, b) => {
          if (a.conflicts.length > 0 && b.conflicts.length === 0) return -1;
          if (a.conflicts.length === 0 && b.conflicts.length > 0) return 1;
          return new Date(b.lastUpdateTime).getTime() - new Date(a.lastUpdateTime).getTime();
        });

        return filtered;
      },

      setFilterConditions: (conditions) => {
        set((state) => ({
          filterConditions: { ...state.filterConditions, ...conditions },
        }));
        get().recordOperation('filter', '设置筛选条件', conditions);
      },

      clearFilterConditions: () => {
        set({ filterConditions: {} });
        get().recordOperation('filter', '清除筛选条件');
      },

      toggleSelectedId: (id) => {
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((i) => i !== id)
            : [...state.selectedIds, id],
        }));
      },

      clearSelectedIds: () => {
        set({ selectedIds: [] });
      },

      selectAll: (ids) => {
        set({ selectedIds: ids });
      },

      updateApplicationStatus: (applicationId, newStatus, remark) => {
        const { applications, currentOperator, getApplicationById } = get();
        const application = getApplicationById(applicationId);

        if (!application) return false;
        if (!canTransitionStatus(application.applicationStatus, newStatus)) return false;

        const oldStatus = application.applicationStatus;

        set((state) => ({
          applications: state.applications.map((app) =>
            app.applicationId === applicationId
              ? {
                  ...app,
                  applicationStatus: newStatus,
                  isWithdrawn: newStatus === 'withdrawn',
                  withdrawDate: newStatus === 'withdrawn' ? new Date().toISOString().split('T')[0] : app.withdrawDate,
                  updateTime: new Date().toISOString(),
                }
              : app
          ),
          listItems: state.listItems.map((item) =>
            item.applicationId === applicationId
              ? {
                  ...item,
                  applicationStatus: newStatus,
                  isWithdrawn: newStatus === 'withdrawn',
                  lastUpdateTime: new Date().toISOString(),
                }
              : item
          ),
          statusChangeLogs: [
            ...state.statusChangeLogs,
            {
              logId: generateId('log_'),
              applicationId,
              fromStatus: oldStatus,
              toStatus: newStatus,
              changeTime: new Date().toISOString(),
              operator: currentOperator,
              remark,
            },
          ],
        }));

        get().recordOperation('status_change', `更新申请状态: ${oldStatus} → ${newStatus}`, {
          applicationId,
          oldStatus,
          newStatus,
        });

        return true;
      },

      updateConflictJudgment: (conflictId, manualJudgment, operator) => {
        set((state) => ({
          conflictRecords: state.conflictRecords.map((cr) =>
            cr.conflictId === conflictId
              ? { ...cr, manualJudgment, operator, createTime: new Date().toISOString() }
              : cr
          ),
        }));

        get().recordOperation('manual_judgment', '提交人工判断', {
          conflictId,
          manualJudgment,
        });
      },

      recordOperation: (type, description, detail) => {
        const { currentOperator } = get();
        set((state) => ({
          operationLogs: [
            {
              logId: generateId('op_'),
              operationType: type,
              operator: currentOperator,
              operationTime: new Date().toISOString(),
              description,
              detail,
            },
            ...state.operationLogs,
          ],
        }));
      },

      exportData: (items, config = {}) => {
        const { conflictRecords, statusChangeLogs, filterConditions, currentOperator } = get();
        const fullConfig: ExportConfig = {
          includeConflicts: true,
          includeProcessingHistory: true,
          includeAnnouncementVersions: false,
          fileFormat: 'xlsx',
          ...config,
        };

        const fileName = exportToExcel(
          items,
          filterConditions,
          conflictRecords,
          statusChangeLogs,
          fullConfig
        );

        const summary = generateExportSummary(items, filterConditions);

        set((state) => ({
          exportRecords: [
            {
              recordId: generateId('exp_'),
              exportTime: new Date().toISOString(),
              operator: currentOperator,
              filterConditions: { ...filterConditions },
              recordCount: items.length,
              fileName,
            },
            ...state.exportRecords,
          ],
        }));

        get().recordOperation('export', summary, {
          recordCount: items.length,
          fileName,
          filterConditions,
        });

        return fileName;
      },

      getConflictRecordsForApplication: (applicationId) => {
        return get().conflictRecords.filter((cr) => cr.applicationId === applicationId);
      },

      getStatusLogsForApplication: (applicationId) => {
        return get()
          .statusChangeLogs.filter((log) => log.applicationId === applicationId)
          .sort((a, b) => new Date(a.changeTime).getTime() - new Date(b.changeTime).getTime());
      },

      getPositionForApplication: (applicationId) => {
        const application = get().getApplicationById(applicationId);
        if (!application) return undefined;
        return get().positions.find(
          (p) => p.bondCode === application.bondCode && p.customerId === application.customerId
        );
      },

      getAnnouncementForApplication: (applicationId) => {
        const application = get().getApplicationById(applicationId);
        if (!application) return undefined;
        return get().announcements.find((a) => a.bondCode === application.bondCode);
      },

      getApplicationById: (applicationId) => {
        return get().applications.find((app) => app.applicationId === applicationId);
      },

      getConflictStats: () => {
        const filtered = get().filterAndSortListItems();
        const stats = {
          exercise_date_mismatch: 0,
          withdrawn_still_in_list: 0,
          insufficient_position: 0,
          total: 0,
          normal: 0,
        };

        filtered.forEach((item) => {
          if (item.conflicts.length > 0) {
            stats.total++;
            item.conflicts.forEach((c) => {
              stats[c]++;
            });
          } else {
            stats.normal++;
          }
        });

        return stats;
      },

      getStatusStats: () => {
        const filtered = get().filterAndSortListItems();
        const stats = {
          pending: 0,
          confirmed: 0,
          exercised: 0,
          withdrawn: 0,
        };

        filtered.forEach((item) => {
          stats[item.applicationStatus]++;
        });

        return stats;
      },
    }),
    {
      name: 'redemption-list-storage',
      partialize: (state) => ({
        filterConditions: state.filterConditions,
        currentOperator: state.currentOperator,
      }),
    }
  )
);
