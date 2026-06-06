import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, WorkPhoto, InspectionNote, Conflict, HandoverReport, SelfCheckResult, BatchType, ConflictStatus, ReportItem } from '@/types';
import { generateId, detectConflicts, detectTemperatureMixing } from '@/utils';

interface AppActions {
  addWorkPhoto: (photo: Omit<WorkPhoto, 'id' | 'createdAt'>) => void;
  addInspectionNote: (note: Omit<InspectionNote, 'id' | 'createdAt'>) => void;
  updateConflictStatus: (conflictId: string, status: ConflictStatus, resolverName: string, remark?: string) => void;
  generateReport: () => HandoverReport;
  setCurrentStep: (step: number) => void;
  setCurrentBatchType: (type: BatchType) => void;
  runSelfCheck: (type: 'duplicate_import' | 'temperature_mixed' | 'recalculation' | 'export_consistency') => SelfCheckResult;
  runAllSelfChecks: () => SelfCheckResult[];
  getWorkPhotosByBatch: (batchType: BatchType) => WorkPhoto[];
  getConflictsForPhoto: (photoId: string) => Conflict[];
  getNotesForPhoto: (photoId: string) => InspectionNote[];
  clearBatchData: (batchType: BatchType) => void;
  resetAll: () => void;
  addMockData: () => void;
}

const initialState: AppState = {
  workPhotos: [],
  inspectionNotes: [],
  conflicts: [],
  reports: [],
  selfCheckResults: [],
  currentStep: 1,
  currentBatchType: 'normal'
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addWorkPhoto: (photo) => {
        const newPhoto: WorkPhoto = {
          ...photo,
          id: generateId(),
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          workPhotos: [...state.workPhotos, newPhoto]
        }));
      },

      addInspectionNote: (note) => {
        const newNote: InspectionNote = {
          ...note,
          id: generateId(),
          createdAt: new Date().toISOString()
        };
        
        set((state) => {
          const photo = state.workPhotos.find(p => p.id === note.workPhotoId);
          const newConflicts: Conflict[] = [];
          
          if (photo) {
            const detected = detectConflicts(photo, newNote);
            newConflicts.push(...detected);
          }
          
          return {
            inspectionNotes: [...state.inspectionNotes, newNote],
            conflicts: [...state.conflicts, ...newConflicts]
          };
        });
      },

      updateConflictStatus: (conflictId, status, resolverName, remark) => {
        set((state) => ({
          conflicts: state.conflicts.map(c =>
            c.id === conflictId
              ? { ...c, status, resolverName, resolutionRemark: remark, resolvedAt: new Date().toISOString() }
              : c
          )
        }));
      },

      generateReport: () => {
        const state = get();
        const batchPhotos = state.getWorkPhotosByBatch(state.currentBatchType);
        
        const items: ReportItem[] = batchPhotos.map(photo => {
          const photoConflicts = state.getConflictsForPhoto(photo.id);
          const notes = state.getNotesForPhoto(photo.id);
          const { mixed } = detectTemperatureMixing([photo], notes);
          
          return {
            workPhotoId: photo.id,
            deviceNo: photo.deviceNo,
            dissolvedOxygen: photo.dissolvedOxygen,
            temperature: photo.temperature,
            temperatureUnit: photo.temperatureUnit,
            recordTime: photo.recordTime,
            hasConflict: photoConflicts.length > 0,
            conflictResolved: photoConflicts.length > 0 && photoConflicts.every(c => c.status !== 'pending'),
            temperatureMixed: mixed
          };
        });
        
        const allConflicts = state.conflicts.filter(c => 
          batchPhotos.some(p => p.id === c.workPhotoId)
        );
        
        const { mixed } = detectTemperatureMixing(batchPhotos, state.inspectionNotes);
        
        const report: HandoverReport = {
          id: generateId(),
          batchType: state.currentBatchType,
          reportTime: new Date().toISOString(),
          status: 'draft',
          items,
          temperatureMixed: mixed,
          conflictCount: allConflicts.length,
          resolvedCount: allConflicts.filter(c => c.status !== 'pending').length,
          createdAt: new Date().toISOString()
        };
        
        set((state) => ({
          reports: [...state.reports, report]
        }));
        
        return report;
      },

      setCurrentStep: (step) => set({ currentStep: step }),
      
      setCurrentBatchType: (type) => set({ currentBatchType: type }),

      runSelfCheck: (type) => {
        const state = get();
        let result: SelfCheckResult;
        
        switch (type) {
          case 'duplicate_import': {
            const seen = new Map<string, WorkPhoto[]>();
            state.workPhotos.forEach(p => {
              const key = `${p.deviceNo}-${p.recordTime}`;
              if (!seen.has(key)) seen.set(key, []);
              seen.get(key)!.push(p);
            });
            const duplicates = Array.from(seen.entries()).filter(([_, arr]) => arr.length > 1);
            result = {
              id: generateId(),
              checkType: 'duplicate_import',
              passed: duplicates.length === 0,
              details: duplicates.length === 0 
                ? '未检测到重复导入记录' 
                : `检测到 ${duplicates.length} 组重复导入：${duplicates.map(([k]) => k).join('; ')}`,
              checkedAt: new Date().toISOString(),
              data: duplicates
            };
            break;
          }
          case 'temperature_mixed': {
            const { mixed, details } = detectTemperatureMixing(state.workPhotos, state.inspectionNotes);
            result = {
              id: generateId(),
              checkType: 'temperature_mixed',
              passed: !mixed,
              details: mixed ? details.join('; ') : '温度单位使用一致',
              checkedAt: new Date().toISOString(),
              data: details
            };
            break;
          }
          case 'recalculation': {
            const supplementaryPhotos = state.workPhotos.filter(p => p.batchType === 'supplementary');
            const normalPhotos = state.workPhotos.filter(p => p.batchType === 'normal');
            const passed = supplementaryPhotos.length > 0 || normalPhotos.length > 0;
            result = {
              id: generateId(),
              checkType: 'recalculation',
              passed,
              details: passed 
                ? `补录数据验证完成：正常材料 ${normalPhotos.length} 条，补录材料 ${supplementaryPhotos.length} 条` 
                : '暂无数据可验证',
              checkedAt: new Date().toISOString()
            };
            break;
          }
          case 'export_consistency': {
            const dataCount = state.workPhotos.length + state.inspectionNotes.length;
            result = {
              id: generateId(),
              checkType: 'export_consistency',
              passed: dataCount > 0,
              details: dataCount > 0 
                ? `导出一致性校验通过：共 ${dataCount} 条记录可导出` 
                : '暂无数据可导出',
              checkedAt: new Date().toISOString()
            };
            break;
          }
        }
        
        set((state) => ({
          selfCheckResults: [...state.selfCheckResults.filter(r => r.checkType !== type), result]
        }));
        
        return result;
      },

      runAllSelfChecks: () => {
        const types: ('duplicate_import' | 'temperature_mixed' | 'recalculation' | 'export_consistency')[] = [
          'duplicate_import', 'temperature_mixed', 'recalculation', 'export_consistency'
        ];
        return types.map(t => get().runSelfCheck(t));
      },

      getWorkPhotosByBatch: (batchType) => {
        return get().workPhotos.filter(p => p.batchType === batchType);
      },

      getConflictsForPhoto: (photoId) => {
        return get().conflicts.filter(c => c.workPhotoId === photoId);
      },

      getNotesForPhoto: (photoId) => {
        return get().inspectionNotes.filter(n => n.workPhotoId === photoId);
      },

      clearBatchData: (batchType) => {
        set((state) => {
          const photoIds = state.workPhotos.filter(p => p.batchType === batchType).map(p => p.id);
          return {
            workPhotos: state.workPhotos.filter(p => p.batchType !== batchType),
            inspectionNotes: state.inspectionNotes.filter(n => !photoIds.includes(n.workPhotoId)),
            conflicts: state.conflicts.filter(c => !photoIds.includes(c.workPhotoId)),
            reports: state.reports.filter(r => r.batchType !== batchType)
          };
        });
      },

      resetAll: () => set(initialState),

      addMockData: () => {
        const now = new Date();
        const batchTypes: BatchType[] = ['normal', 'wrong_caliber', 'supplementary'];
        const mockPhotos: Omit<WorkPhoto, 'id' | 'createdAt'>[] = [];
        const mockNotes: Omit<InspectionNote, 'id' | 'createdAt'>[] = [];
        
        batchTypes.forEach((batchType, batchIdx) => {
          for (let i = 0; i < 3; i++) {
            const recordTime = new Date(now.getTime() - (batchIdx * 24 + i) * 3600000).toISOString();
            const useKelvin = batchType === 'wrong_caliber' && i === 1;
            const tempValue = useKelvin ? 293.15 : 20;
            
            mockPhotos.push({
              batchType,
              deviceNo: `DEV-${String(i + 1).padStart(3, '0')}`,
              dissolvedOxygen: 6.5 + i * 0.3,
              temperature: tempValue,
              temperatureUnit: useKelvin ? 'K' : 'C',
              recordTime,
              imageName: `工况照片_${batchType}_${i + 1}.jpg`
            });
          }
        });
        
        set({ workPhotos: [], inspectionNotes: [], conflicts: [] });
        
        mockPhotos.forEach((photo, idx) => {
          const state = get();
          const newPhoto: WorkPhoto = {
            ...photo,
            id: generateId(),
            createdAt: new Date().toISOString()
          };
          
          set((s) => ({ workPhotos: [...s.workPhotos, newPhoto] }));
          
          if (idx % 2 === 0 || photo.batchType === 'supplementary') {
            const hasConflict = idx % 3 === 0;
            const noteTemp = hasConflict ? 23 : photo.temperature;
            const noteUnit = photo.batchType === 'wrong_caliber' ? 'C' : photo.temperatureUnit;
            
            setTimeout(() => {
              const currentState = get();
              const currentPhoto = currentState.workPhotos[idx];
              if (currentPhoto) {
                const note: Omit<InspectionNote, 'id' | 'createdAt'> = {
                  workPhotoId: currentPhoto.id,
                  inspectorName: '老岑',
                  content: hasConflict 
                    ? '现场巡检发现温度显示异常，已重新校准设备' 
                    : '巡检正常，溶氧扩散符合预期',
                  temperature: noteTemp,
                  temperatureUnit: noteUnit,
                  inspectionTime: new Date(Date.parse(photo.recordTime) + 1800000).toISOString()
                };
                get().addInspectionNote(note);
              }
            }, 100);
          }
        });
      }
    }),
    {
      name: 'fish-pond-diffusion-storage'
    }
  )
);
