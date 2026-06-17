import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ShelterPoint, ProcessRecord, ShelterStatus, ConflictType, ConflictItem, ImportPreviewItem } from '../types';
import { mockSheltersWithAnalysis } from '../data/shelters';
import { mockFeedbacks } from '../data/feedbacks';
import { mockRecords } from '../data/records';
import { generateCapacityAnalysis, generateConflictSuggestion } from '../utils/nlGenerator';
import { checkCoordinateOffset } from '../utils/geo';
import { buildSheltersFromImport } from '../utils/csvImport';

interface ShelterState {
  shelters: ShelterPoint[];
  feedbacks: typeof mockFeedbacks;
  records: ProcessRecord[];
  conflicts: ConflictItem[];
  selectedShelterId: string | null;
  filterStatus: ShelterStatus | 'all';
  searchKeyword: string;
  is3DMode: boolean;
}

interface ShelterActions {
  setSelectedShelter: (id: string | null) => void;
  setFilterStatus: (status: ShelterStatus | 'all') => void;
  setSearchKeyword: (keyword: string) => void;
  toggle3DMode: () => void;
  updateShelterStatus: (shelterId: string, newStatus: ShelterStatus, remark: string, operator?: string) => void;
  addProcessRecord: (record: Omit<ProcessRecord, 'id' | 'operateTime'>) => void;
  addSupplementMaterial: (shelterId: string, material: string, operator?: string) => void;
  resolveConflict: (conflictId: string, resolution: 'left' | 'right' | 'pending', operator?: string) => void;
  getFilteredShelters: () => ShelterPoint[];
  getShelterFeedbacks: (shelterId: string) => typeof mockFeedbacks;
  getShelterRecords: (shelterId: string) => ProcessRecord[];
  getUnresolvedConflicts: () => ConflictItem[];
  reanalyzeShelter: (shelterId: string) => void;
  importFromCsv: (previews: ImportPreviewItem[], operator?: string) => {
    addedCount: number;
    updatedCount: number;
    feedbackCount: number;
  };
  resetToDefault: () => void;
}

function detectConflicts(shelters: ShelterPoint[]): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  shelters.forEach(shelter => {
    if (shelter.conflictType === ConflictType.NONE) return;

    const leftEvidences: string[] = [];
    const rightEvidences: string[] = [];
    let severity = 1;

    if (shelter.conflictType === ConflictType.CAPACITY || shelter.conflictType === ConflictType.MIXED) {
      if (shelter.oldDesignCapacity && shelter.newDesignCapacity) {
        leftEvidences.push(`【容量标准】居民反馈表（旧口径）：${shelter.oldCapacityYear}设计容量${shelter.oldDesignCapacity}人，当前反馈${shelter.reportedCount}人，占比${Math.round((shelter.reportedCount / shelter.oldDesignCapacity) * 100)}%，容量充足。`);
        rightEvidences.push(`【容量标准】官方导入数据（新口径）：${shelter.newCapacityYear}设计容量${shelter.newDesignCapacity}人，当前反馈${shelter.reportedCount}人，占比${Math.round((shelter.reportedCount / shelter.newDesignCapacity) * 100)}%，已超限${Math.round((shelter.reportedCount / shelter.newDesignCapacity - 1) * 100)}%。`);
        severity = 3;
      } else {
        leftEvidences.push(`【容量反馈】居民反馈：${shelter.reportedCount}人`);
        rightEvidences.push(`【容量标准】官方容量：${shelter.designCapacity}人，超限${Math.round((shelter.reportedCount / shelter.designCapacity - 1) * 100)}%`);
        severity = shelter.reportedCount > shelter.designCapacity * 1.5 ? 4 : 2;
      }
    }

    if (shelter.conflictType === ConflictType.COORDINATE || shelter.conflictType === ConflictType.MIXED) {
      if (shelter.reportedLatitude && shelter.reportedLongitude) {
        const offset = checkCoordinateOffset(
          shelter.latitude,
          shelter.longitude,
          shelter.reportedLatitude,
          shelter.reportedLongitude
        );
        leftEvidences.push(`【坐标位置】居民反馈坐标：${shelter.reportedLongitude.toFixed(6)}, ${shelter.reportedLatitude.toFixed(6)}`);
        rightEvidences.push(`【坐标位置】官方坐标：${shelter.longitude.toFixed(6)}, ${shelter.latitude.toFixed(6)}，偏移约${Math.round(offset.distance)}米`);
        severity = Math.max(severity, offset.distance > 100 ? 3 : 2);
      }
    }

    const leftEvidence = leftEvidences.join('\n');
    const rightEvidence = rightEvidences.join('\n');

    conflicts.push({
      id: `conflict-${shelter.id}`,
      shelterId: shelter.id,
      shelterName: shelter.standardName,
      type: shelter.conflictType,
      severity,
      leftEvidence,
      rightEvidence,
      suggestion: generateConflictSuggestion(shelter.conflictType, shelter.standardName),
      resolved: shelter.status === ShelterStatus.PROCESSED,
      resolution: shelter.status === ShelterStatus.PROCESSED ? 'right' : 'pending'
    });
  });

  return conflicts;
}

export const useShelterStore = create<ShelterState & ShelterActions>()(
  persist(
    (set, get) => ({
      shelters: mockSheltersWithAnalysis,
      feedbacks: mockFeedbacks,
      records: mockRecords,
      conflicts: detectConflicts(mockSheltersWithAnalysis),
      selectedShelterId: null,
      filterStatus: 'all',
      searchKeyword: '',
      is3DMode: false,

      setSelectedShelter: (id) => set({ selectedShelterId: id }),
      setFilterStatus: (status) => set({ filterStatus: status }),
      setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
      toggle3DMode: () => set({ is3DMode: !get().is3DMode }),

      updateShelterStatus: (shelterId, newStatus, remark, operator = '阿宁') => {
        set(state => {
          const oldShelter = state.shelters.find(s => s.id === shelterId);
          if (!oldShelter) return state;

          const newRecord: ProcessRecord = {
            id: `r${Date.now()}`,
            shelterId,
            operator,
            operateTime: new Date().toLocaleString('zh-CN'),
            action: '状态更新',
            oldStatus: oldShelter.status,
            newStatus,
            remark
          };

          const updatedShelters = state.shelters.map(s =>
            s.id === shelterId
              ? { ...s, status: newStatus, updatedAt: new Date().toLocaleString('zh-CN') }
              : s
          );

          return {
            shelters: updatedShelters,
            records: [...state.records, newRecord],
            conflicts: detectConflicts(updatedShelters)
          };
        });
      },

      addProcessRecord: (record) => {
        set(state => ({
          records: [
            ...state.records,
            {
              ...record,
              id: `r${Date.now()}`,
              operateTime: new Date().toLocaleString('zh-CN')
            }
          ]
        }));
      },

      addSupplementMaterial: (shelterId, material, operator = '阿宁') => {
        set(state => {
          const oldShelter = state.shelters.find(s => s.id === shelterId);
          if (!oldShelter) return state;

          const newRecord: ProcessRecord = {
            id: `r${Date.now()}`,
            shelterId,
            operator,
            operateTime: new Date().toLocaleString('zh-CN'),
            action: '补充材料',
            oldStatus: oldShelter.status,
            newStatus: oldShelter.status,
            remark: '从居民反馈表补充历史数据',
            supplementMaterial: material
          };

          return {
            records: [...state.records, newRecord]
          };
        });
      },

      resolveConflict: (conflictId, resolution, operator = '阿宁') => {
        set(state => {
          const conflict = state.conflicts.find(c => c.id === conflictId);
          if (!conflict) return state;

          const newStatus = resolution === 'pending' ? ShelterStatus.PENDING_VERIFY : ShelterStatus.PROCESSED;
          const remark = resolution === 'left'
            ? '人工确认：采信居民反馈表数据'
            : resolution === 'right'
            ? '人工确认：采信官方导入数据'
            : '标记为待进一步核实';

          const updatedShelters = state.shelters.map(s =>
            s.id === conflict.shelterId
              ? {
                  ...s,
                  status: newStatus,
                  designCapacity: resolution === 'left' && s.oldDesignCapacity
                    ? s.oldDesignCapacity
                    : s.designCapacity,
                  updatedAt: new Date().toLocaleString('zh-CN')
                }
              : s
          );

          const newRecord: ProcessRecord = {
            id: `r${Date.now()}`,
            shelterId: conflict.shelterId,
            operator,
            operateTime: new Date().toLocaleString('zh-CN'),
            action: '冲突处理',
            oldStatus: state.shelters.find(s => s.id === conflict.shelterId)?.status,
            newStatus,
            remark
          };

          return {
            shelters: updatedShelters,
            records: [...state.records, newRecord],
            conflicts: state.conflicts.map(c =>
              c.id === conflictId
                ? { ...c, resolved: resolution !== 'pending', resolution }
                : c
            )
          };
        });
      },

      getFilteredShelters: () => {
        const { shelters, filterStatus, searchKeyword } = get();
        return shelters.filter(s => {
          const statusMatch = filterStatus === 'all' || s.status === filterStatus;
          const keywordMatch = !searchKeyword ||
            s.standardName.includes(searchKeyword) ||
            s.aliases.some(a => a.includes(searchKeyword));
          return statusMatch && keywordMatch;
        });
      },

      getShelterFeedbacks: (shelterId) => {
        return get().feedbacks.filter(f => f.shelterId === shelterId);
      },

      getShelterRecords: (shelterId) => {
        return get().records
          .filter(r => r.shelterId === shelterId)
          .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
      },

      getUnresolvedConflicts: () => {
        return get().conflicts.filter(c => !c.resolved);
      },

      reanalyzeShelter: (shelterId) => {
        set(state => ({
          shelters: state.shelters.map(s =>
            s.id === shelterId
              ? { ...s, naturalLanguageResult: generateCapacityAnalysis(s) }
              : s
          )
        }));
      },

      importFromCsv: (previews, operator = '阿宁') => {
        const result = buildSheltersFromImport(previews, get().shelters, operator);

        set(state => {
          const finalShelters = [...result.updatedShelters, ...result.newShelters];
          const finalFeedbacks = [...state.feedbacks, ...result.newFeedbacks];
          const finalRecords = [
            ...state.records,
            ...result.newRecords.map(r => ({
              ...r,
              id: `r${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              operateTime: new Date().toLocaleString('zh-CN'),
            })),
          ];

          return {
            shelters: finalShelters,
            feedbacks: finalFeedbacks,
            records: finalRecords,
            conflicts: detectConflicts(finalShelters),
          };
        });

        return {
          addedCount: result.newShelters.length,
          updatedCount: result.updatedShelters.filter(
            (s, i) => get().shelters[i]?.id === s.id && s.updatedAt !== get().shelters[i]?.updatedAt
          ).length,
          feedbackCount: result.newFeedbacks.length,
        };
      },

      resetToDefault: () => {
        set({
          shelters: mockSheltersWithAnalysis,
          feedbacks: mockFeedbacks,
          records: mockRecords,
          conflicts: detectConflicts(mockSheltersWithAnalysis),
          selectedShelterId: null,
          filterStatus: 'all',
          searchKeyword: '',
        });
      }
    }),
    {
      name: 'shelter-storage',
      partialize: (state) => ({
        shelters: state.shelters,
        feedbacks: state.feedbacks,
        records: state.records,
        conflicts: state.conflicts
      })
    }
  )
);
