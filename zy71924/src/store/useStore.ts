import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { InspectionRecord, RecordStatus, CurationNote, LightingScheme, BatchOperationResult } from '../types';
import { mockRecords, mockCurationNotes, mockLightingSchemes } from '../data/mockData';

interface AppState {
  records: InspectionRecord[];
  curationNotes: CurationNote[];
  lightingSchemes: LightingScheme[];
  selectedRecords: string[];
  currentUser: string;
  
  setSelectedRecords: (ids: string[]) => void;
  toggleRecordSelection: (id: string) => void;
  clearSelection: () => void;
  
  updateRecordStatus: (id: string, status: RecordStatus, reason: string) => void;
  batchUpdateStatus: (ids: string[], status: RecordStatus, reason: string) => BatchOperationResult;
  
  addRecord: (record: Omit<InspectionRecord, 'id' | 'createdAt' | 'updatedAt' | 'versions'>) => void;
  getRecordById: (id: string) => InspectionRecord | undefined;
  
  addCurationNote: (note: Omit<CurationNote, 'id' | 'uploadedAt'>) => void;
  deleteCurationNote: (id: string) => void;
  
  getStatistics: () => { normal: number; pending: number; abnormal: number };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      records: mockRecords,
      curationNotes: mockCurationNotes,
      lightingSchemes: mockLightingSchemes,
      selectedRecords: [],
      currentUser: '李工（布展）',
      
      setSelectedRecords: (ids) => set({ selectedRecords: ids }),
      toggleRecordSelection: (id) => set((state) => ({
        selectedRecords: state.selectedRecords.includes(id)
          ? state.selectedRecords.filter(i => i !== id)
          : [...state.selectedRecords, id]
      })),
      clearSelection: () => set({ selectedRecords: [] }),
      
      updateRecordStatus: (id, status, reason) => {
        const now = new Date().toLocaleString('zh-CN', { 
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).replace(/\//g, '-');
        
        set((state) => ({
          records: state.records.map(record => {
            if (record.id === id) {
              const newVersion = {
                id: `v${Date.now()}`,
                versionNumber: record.versions.length + 1,
                status,
                operator: state.currentUser,
                operatedAt: now,
                reason
              };
              return {
                ...record,
                currentStatus: status,
                updatedBy: state.currentUser,
                updatedAt: now,
                versions: [...record.versions, newVersion]
              };
            }
            return record;
          })
        }));
      },
      
      batchUpdateStatus: (ids, status, reason) => {
        const result: BatchOperationResult = {
          successCount: 0,
          failedCount: 0,
          errors: []
        };
        
        ids.forEach(id => {
          const record = get().records.find(r => r.id === id);
          if (record) {
            get().updateRecordStatus(id, status, reason);
            result.successCount++;
          } else {
            result.failedCount++;
            result.errors.push(`记录 ${id} 不存在`);
          }
        });
        
        return result;
      },
      
      addRecord: (recordData) => {
        const now = new Date().toLocaleString('zh-CN', { 
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).replace(/\//g, '-');
        
        const existingRecord = get().records.find(r => r.materialCode === recordData.materialCode);
        
        if (existingRecord) {
          get().updateRecordStatus(existingRecord.id, recordData.currentStatus, '二次进场，状态更新');
          return;
        }
        
        const newRecord: InspectionRecord = {
          ...recordData,
          id: `${Date.now()}`,
          createdAt: now,
          updatedAt: now,
          versions: [{
            id: `v${Date.now()}`,
            versionNumber: 1,
            status: recordData.currentStatus,
            operator: recordData.createdBy,
            operatedAt: now,
            reason: '首次录入'
          }]
        };
        
        set((state) => ({
          records: [...state.records, newRecord]
        }));
      },
      
      getRecordById: (id) => {
        return get().records.find(r => r.id === id);
      },
      
      addCurationNote: (note) => {
        const now = new Date().toLocaleString('zh-CN', { 
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).replace(/\//g, '-');
        
        const newNote: CurationNote = {
          ...note,
          id: `note-${Date.now()}`,
          uploadedAt: now
        };
        
        set((state) => ({
          curationNotes: [...state.curationNotes, newNote]
        }));
      },
      
      deleteCurationNote: (id) => {
        set((state) => ({
          curationNotes: state.curationNotes.filter(n => n.id !== id)
        }));
      },
      
      getStatistics: () => {
        const records = get().records;
        return {
          normal: records.filter(r => r.currentStatus === 'normal').length,
          pending: records.filter(r => r.currentStatus === 'pending').length,
          abnormal: records.filter(r => r.currentStatus === 'abnormal').length
        };
      }
    }),
    {
      name: 'inspection-storage',
      partialize: (state) => ({
        records: state.records,
        curationNotes: state.curationNotes
      })
    }
  )
);
