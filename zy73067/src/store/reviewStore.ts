import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AlertRecord,
  AlertStatus,
  ConclusionFile,
  DeviceIdMapping,
  FieldMapping,
  FilterState,
  PageSnapshot,
  SummaryStats,
} from "@/types";
import { mockRecords, deviceIdMappings, fieldMappings, initialPageSnapshot } from "@/data/mockData";
import { normalizeDeviceId } from "@/utils/deviceIdNormalizer";
import { validateConsistency } from "@/utils/consistencyChecker";
import type { ConsistencyResult } from "@/types";
import { generateExportRows } from "@/utils/exportGenerator";
import type { ExportRow } from "@/types";

interface ReviewStore {
  records: AlertRecord[];
  deviceMappings: DeviceIdMapping[];
  fieldMappings: FieldMapping[];
  pageSnapshot: PageSnapshot | null;
  filters: FilterState;
  selectedRecordId: string | null;
  expandedRowIds: string[];

  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  getFilteredRecords: () => AlertRecord[];
  getSummaryStats: () => SummaryStats;

  normalizeDeviceId: (rawId: string) => string;

  selectRecord: (id: string | null) => void;
  toggleRowExpanded: (id: string) => void;

  updateRecordStatus: (id: string, status: AlertStatus) => void;
  updateRecordRemark: (id: string, remark: string) => void;
  updateRecordConclusion: (id: string, file: ConclusionFile) => void;

  savePageSnapshot: (snapshot: Partial<PageSnapshot>) => void;
  restorePageSnapshot: () => PageSnapshot | null;
  clearPageSnapshot: () => void;

  validateConsistency: (recordId: string) => ConsistencyResult;
  generateExportData: () => ExportRow[];

  addFieldMapping: (mapping: Omit<FieldMapping, "id">) => void;
  removeFieldMapping: (id: string) => void;
  updateFieldMapping: (id: string, updates: Partial<FieldMapping>) => void;
}

const defaultFilters: FilterState = {
  searchQuery: "",
  status: "all",
  showTempAdjustedOnly: false,
  source: "",
};

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set, get) => ({
      records: mockRecords,
      deviceMappings: deviceIdMappings,
      fieldMappings: fieldMappings,
      pageSnapshot: initialPageSnapshot,
      filters: defaultFilters,
      selectedRecordId: null,
      expandedRowIds: [],

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      resetFilters: () => set({ filters: defaultFilters }),

      getFilteredRecords: () => {
        const { records, filters, deviceMappings } = get();
        const { searchQuery, status, showTempAdjustedOnly, source } = filters;
        return records.filter((r) => {
          if (showTempAdjustedOnly && !r.isTempThresholdAdjusted) return false;
          if (status !== "all" && r.status !== status) return false;
          if (source && !r.source.includes(source)) return false;
          if (searchQuery.trim()) {
            const cleaned = searchQuery.trim().toUpperCase().replace(/[\s\-_#/]/g, "");
            const unifiedClean = r.unifiedDeviceId.toUpperCase().replace(/[\s\-_#/]/g, "");
            const matchUnified =
              unifiedClean.includes(cleaned) ||
              r.unifiedDeviceId.toUpperCase().includes(searchQuery.trim().toUpperCase());
            const matchOriginal = r.originalDeviceIds.some(
              (id) =>
                id.toUpperCase().replace(/[\s\-_#/]/g, "").includes(cleaned) ||
                id.toUpperCase().includes(searchQuery.trim().toUpperCase())
            );
            if (!matchUnified && !matchOriginal) return false;
          }
          return true;
        });
      },

      getSummaryStats: () => {
        const { records } = get();
        const stats: SummaryStats = {
          pending: 0,
          approved: 0,
          rejected: 0,
          reviewing: 0,
          tempAdjusted: 0,
          total: records.length,
        };
        records.forEach((r) => {
          stats[r.status]++;
          if (r.isTempThresholdAdjusted) stats.tempAdjusted++;
        });
        return stats;
      },

      normalizeDeviceId: (rawId) => normalizeDeviceId(rawId, get().deviceMappings),

      selectRecord: (id) => set({ selectedRecordId: id }),

      toggleRowExpanded: (id) =>
        set((state) => ({
          expandedRowIds: state.expandedRowIds.includes(id)
            ? state.expandedRowIds.filter((i) => i !== id)
            : [...state.expandedRowIds, id],
        })),

      updateRecordStatus: (id, status) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r
          ),
        })),

      updateRecordRemark: (id, remark) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, remark, updatedAt: new Date().toISOString() } : r
          ),
        })),

      updateRecordConclusion: (id, file) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? { ...r, conclusionFile: file, updatedAt: new Date().toISOString() }
              : r
          ),
        })),

      savePageSnapshot: (snapshot) =>
        set((state) => ({
          pageSnapshot: {
            routePath: snapshot.routePath ?? state.pageSnapshot?.routePath ?? "/workbench",
            scrollPosition: snapshot.scrollPosition ?? state.pageSnapshot?.scrollPosition ?? 0,
            filters: snapshot.filters ?? state.pageSnapshot?.filters ?? {},
            selectedRecordId: snapshot.selectedRecordId ?? state.pageSnapshot?.selectedRecordId,
            expandedRowIds: snapshot.expandedRowIds ?? state.pageSnapshot?.expandedRowIds ?? [],
            timestamp: new Date().toISOString(),
          },
        })),

      restorePageSnapshot: () => get().pageSnapshot,

      clearPageSnapshot: () => set({ pageSnapshot: null }),

      validateConsistency: (recordId) => {
        const record = get().records.find((r) => r.id === recordId);
        if (!record) return { isConsistent: false, mismatches: [] };
        return validateConsistency(record);
      },

      generateExportData: () => generateExportRows(get().records),

      addFieldMapping: (mapping) =>
        set((state) => ({
          fieldMappings: [
            ...state.fieldMappings,
            { ...mapping, id: `fm-${Date.now()}` },
          ],
        })),

      removeFieldMapping: (id) =>
        set((state) => ({
          fieldMappings: state.fieldMappings.filter(
            (m) => m.id !== id || m.isProtected
          ),
        })),

      updateFieldMapping: (id, updates) =>
        set((state) => ({
          fieldMappings: state.fieldMappings.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
    }),
    {
      name: "blade-alert-review-store",
      partialize: (state) => ({
        records: state.records,
        fieldMappings: state.fieldMappings,
        pageSnapshot: state.pageSnapshot,
      }),
    }
  )
);
