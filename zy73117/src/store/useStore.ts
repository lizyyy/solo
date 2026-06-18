import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Material, TraceRecord, FilterState, NotificationItem, MaterialStatus } from '@/types';
import { mockMaterials, mockRecords, generateId } from '@/data/mockData';
import { detectExceptions, getRecordsForMaterial } from '@/utils/traceEngine';

interface StoreState {
  materials: Material[];
  records: TraceRecord[];
  filters: FilterState;
  selectedMaterialId: string | null;
  expandedRecordId: string | null;
  showFiltersRestored: boolean;
  notifications: NotificationItem[];
  filtersRestoredFromStorage: boolean;
  
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setShowFiltersRestored: (show: boolean) => void;
  
  selectMaterial: (id: string | null) => void;
  expandRecord: (id: string | null) => void;
  
  addMaterial: (material: Omit<Material, 'id' | 'recordIds' | 'importDate' | 'originalConclusion'>) => void;
  addRecord: (record: Omit<TraceRecord, 'id' | 'operateTime'>) => void;
  withdrawRecord: (materialId: string, reason: string, operator: string) => void;
  updateMaterialNote: (materialId: string, note: string) => void;
  updateMaterialScreenshot: (materialId: string, url: string, note: string) => void;
  resolvePending: (materialId: string) => void;
  
  addNotification: (notification: Omit<NotificationItem, 'id'>) => void;
  removeNotification: (id: string) => void;
  
  importMaterials: (materials: Omit<Material, 'id' | 'recordIds' | 'importDate' | 'originalConclusion'>[]) => void;
  resetToMockData: () => void;
  
  getFilteredMaterials: () => Material[];
  getSelectedMaterial: () => Material | undefined;
  getSelectedRecords: () => TraceRecord[];
}

const defaultFilters: FilterState = {
  statuses: [],
  keyword: '',
  dateRange: { start: null, end: null },
  buildingNo: '',
  onlyPending: false,
  onlyException: false,
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      materials: mockMaterials,
      records: mockRecords,
      filters: defaultFilters,
      selectedMaterialId: null,
      expandedRecordId: null,
      showFiltersRestored: false,
      notifications: [],
      filtersRestoredFromStorage: false,

      setFilters: (newFilters) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        }));
      },

      resetFilters: () => {
        set({ filters: defaultFilters });
      },

      setShowFiltersRestored: (show) => {
        set({ showFiltersRestored: show });
      },

      selectMaterial: (id) => {
        set({ selectedMaterialId: id, expandedRecordId: null });
      },

      expandRecord: (id) => {
        set((state) => ({
          expandedRecordId: state.expandedRecordId === id ? null : id,
        }));
      },

      addMaterial: (materialData) => {
        const newMaterial: Material = {
          ...materialData,
          id: generateId('mat'),
          recordIds: [],
          importDate: new Date().toISOString(),
          originalConclusion: materialData.currentConclusion,
        };

        const createRecord: TraceRecord = {
          id: generateId('rec'),
          materialId: newMaterial.id,
          type: 'create',
          content: `${materialData.materialType}数据录入`,
          operator: '阿宁',
          operateTime: new Date().toISOString(),
          previousConclusion: '',
          newConclusion: materialData.currentConclusion,
          reason: '初始录入',
          changeOrderNo: '',
          hasChangeOrder: false,
          changeOrderLate: false,
          remark: '',
        };

        newMaterial.recordIds.push(createRecord.id);

        set((state) => ({
          materials: [...state.materials, newMaterial],
          records: [...state.records, createRecord],
          selectedMaterialId: newMaterial.id,
        }));

        get().addNotification({
          type: 'success',
          title: '材料已导入',
          message: `${newMaterial.projectName} ${newMaterial.buildingNo} ${newMaterial.materialType} 已成功导入`,
        });
      },

      addRecord: (recordData) => {
        const newRecord: TraceRecord = {
          ...recordData,
          id: generateId('rec'),
          operateTime: new Date().toISOString(),
        };

        set((state) => {
          const material = state.materials.find(m => m.id === recordData.materialId);
          if (!material) return state;

          const updatedMaterial = {
            ...material,
            currentConclusion: recordData.newConclusion,
            recordIds: [...material.recordIds, newRecord.id],
            status: recordData.type === 'change' ? 'changed' : 
                    recordData.type === 'withdraw' ? 'withdrawn' : material.status,
          } as Material;

          const { hasException, reason, nextStep } = detectExceptions(updatedMaterial, [...state.records, newRecord]);
          if (hasException) {
            updatedMaterial.status = 'exception';
            updatedMaterial.exceptionReason = reason;
            updatedMaterial.nextStep = nextStep;
            updatedMaterial.isPending = true;
          }

          return {
            materials: state.materials.map(m => m.id === material.id ? updatedMaterial : m),
            records: [...state.records, newRecord],
          };
        });

        const { hasException, reason, nextStep } = detectExceptions(
          get().materials.find(m => m.id === recordData.materialId)!,
          get().records
        );

        if (hasException) {
          get().addNotification({
            type: 'warning',
            title: '检测到异常',
            message: reason,
            nextStep,
            actions: [
              {
                label: '立即处理',
                onClick: () => get().selectMaterial(recordData.materialId),
              },
            ],
          });
        }
      },

      withdrawRecord: (materialId, reason, operator) => {
        const material = get().materials.find(m => m.id === materialId);
        if (!material) return;

        get().addRecord({
          materialId,
          type: 'withdraw',
          content: '撤回原结论',
          operator,
          previousConclusion: material.currentConclusion,
          newConclusion: '结论已撤回，待重新提交',
          reason,
          changeOrderNo: '',
          hasChangeOrder: false,
          changeOrderLate: false,
          remark: '已标记为待处理，等待重新提交',
        });
      },

      updateMaterialNote: (materialId, note) => {
        set((state) => ({
          materials: state.materials.map(m =>
            m.id === materialId ? { ...m, manualNote: note } : m
          ),
        }));
      },

      updateMaterialScreenshot: (materialId, url, note) => {
        set((state) => ({
          materials: state.materials.map(m =>
            m.id === materialId ? { ...m, screenshotUrl: url, screenshotNote: note } : m
          ),
        }));
      },

      resolvePending: (materialId) => {
        set((state) => ({
          materials: state.materials.map(m =>
            m.id === materialId
              ? { ...m, isPending: false, status: 'changed' as MaterialStatus, exceptionReason: '', nextStep: '' }
              : m
          ),
        }));

        get().addNotification({
          type: 'success',
          title: '异常已处理',
          message: '待处理状态已解除',
        });
      },

      addNotification: (notification) => {
        const id = generateId('notif');
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id }],
        }));

        setTimeout(() => {
          get().removeNotification(id);
        }, 8000);
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }));
      },

      importMaterials: (materialsData) => {
        materialsData.forEach(m => get().addMaterial(m));
      },

      resetToMockData: () => {
        set({
          materials: mockMaterials,
          records: mockRecords,
          filters: defaultFilters,
          selectedMaterialId: null,
          expandedRecordId: null,
        });
      },

      getFilteredMaterials: () => {
        const { materials, records, filters } = get();
        let result = [...materials];

        if (filters.statuses.length > 0) {
          result = result.filter(m => filters.statuses.includes(m.status));
        }

        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          result = result.filter(m =>
            m.projectName.toLowerCase().includes(keyword) ||
            m.buildingNo.toLowerCase().includes(keyword) ||
            m.materialType.toLowerCase().includes(keyword) ||
            m.surveyNo.toLowerCase().includes(keyword) ||
            m.currentConclusion.toLowerCase().includes(keyword)
          );
        }

        if (filters.dateRange.start) {
          result = result.filter(m => new Date(m.importDate) >= new Date(filters.dateRange.start!));
        }
        if (filters.dateRange.end) {
          result = result.filter(m => new Date(m.importDate) <= new Date(filters.dateRange.end!));
        }

        if (filters.buildingNo) {
          result = result.filter(m => m.buildingNo === filters.buildingNo);
        }

        if (filters.onlyPending) {
          result = result.filter(m => {
            if (m.isPending) return true;
            const { hasException } = detectExceptions(m, records);
            return hasException;
          });
        }

        if (filters.onlyException) {
          result = result.filter(m => m.status === 'exception');
        }

        return result.sort((a, b) => new Date(b.importDate).getTime() - new Date(a.importDate).getTime());
      },

      getSelectedMaterial: () => {
        const { materials, selectedMaterialId } = get();
        return materials.find(m => m.id === selectedMaterialId);
      },

      getSelectedRecords: () => {
        const { selectedMaterialId, records } = get();
        if (!selectedMaterialId) return [];
        return getRecordsForMaterial(selectedMaterialId, records);
      },
    }),
    {
      name: 'old-building-survey-tracker',
      partialize: (state) => ({
        materials: state.materials,
        records: state.records,
        filters: state.filters,
        selectedMaterialId: state.selectedMaterialId,
        filtersRestoredFromStorage: true,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.filtersRestoredFromStorage) {
          state.setShowFiltersRestored(true);
        }
      },
    }
  )
);
