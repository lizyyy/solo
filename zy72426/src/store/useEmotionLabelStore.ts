import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SongRecord,
  SongGroup,
  SelfCheckResult,
  ImportLog,
  RecordStatus,
  ManualChange,
  ImportPreviewRow,
} from '@/types';
import { sampleRecords, sampleGroups, sampleImportHistory } from '@/data/sampleData';
import { parseCSVFile, generatePreview, convertToRecords, ParsedCSVRow } from '@/utils/csvParser';
import { findNameMappingCandidates } from '@/utils/nameMatcher';
import { recalculateEmotionForRecord } from '@/utils/emotionCalculator';
import { runAllSelfChecks } from '@/utils/selfCheckEngine';

interface EmotionLabelState {
  records: SongRecord[];
  groups: SongGroup[];
  selfCheckResults: SelfCheckResult[];
  importHistory: ImportLog[];
  previewRows: ImportPreviewRow[];
  isLoading: boolean;
  lastSelfCheckAt: number | null;

  importCSV: (file: File, operator: string) => Promise<void>;
  previewCSV: (file: File) => Promise<void>;
  clearPreview: () => void;

  updateRecord: (id: string, updates: Partial<SongRecord>, operator: string, reason?: string) => void;
  batchUpdateStatus: (ids: string[], status: RecordStatus) => void;

  createGroup: (recordIds: string[], canonicalName: string) => string;
  confirmGroup: (groupId: string, reviewer: string) => void;
  rejectGroup: (groupId: string) => void;
  removeFromGroup: (recordId: string) => void;

  runSelfCheck: () => void;
  resolveIssue: (issueId: string) => void;

  recalculateEmotion: (recordId: string) => void;
  recalculateAllEmotions: () => void;

  loadSampleData: () => void;
  clearAllData: () => void;
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useEmotionLabelStore = create<EmotionLabelState>()(
  persist(
    (set, get) => ({
      records: [],
      groups: [],
      selfCheckResults: [],
      importHistory: [],
      previewRows: [],
      isLoading: false,
      lastSelfCheckAt: null,

      previewCSV: async (file: File) => {
        set({ isLoading: true });
        try {
          const parsedRows = await parseCSVFile(file);
          const { records } = get();
          const preview = generatePreview(parsedRows, records);
          set({ previewRows: preview, isLoading: false });
        } catch (error) {
          console.error('Preview CSV error:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      clearPreview: () => {
        set({ previewRows: [] });
      },

      importCSV: async (file: File, operator: string) => {
        set({ isLoading: true });
        try {
          const parsedRows: ParsedCSVRow[] = await parseCSVFile(file);
          const importVersion = `v${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${String(get().importHistory.length + 1).padStart(2, '0')}`;

          const newRecords = convertToRecords(parsedRows, importVersion, operator);

          const nameMappingGroups = findNameMappingCandidates([...get().records, ...newRecords]);
          const existingGroupMap = new Map(get().groups.map((g) => [g.id, g]));

          nameMappingGroups.forEach((memberIds, tempGroupId) => {
            const newMemberIds = memberIds.filter((id) =>
              newRecords.some((r) => r.id === id)
            );
            const existingMemberIds = memberIds.filter((id) =>
              get().records.some((r) => r.id === id)
            );

            if (newMemberIds.length > 0) {
              let canonicalName = '';
              const allMembers = [...newMemberIds, ...existingMemberIds].map(
                (id) =>
                  newRecords.find((r) => r.id === id) ||
                  get().records.find((r) => r.id === id)
              );

              if (allMembers.length > 0 && allMembers[0]) {
                canonicalName = allMembers[0].liveName || allMembers[0].copyrightName;
              }

              if (existingMemberIds.length > 0) {
                const existingGroup = get().groups.find((g) =>
                  existingMemberIds.some((id) => g.memberIds.includes(id))
                );
                if (existingGroup) {
                  existingGroupMap.set(existingGroup.id, {
                    ...existingGroup,
                    memberIds: [...new Set([...existingGroup.memberIds, ...newMemberIds])],
                  });
                  newRecords.forEach((record) => {
                    if (newMemberIds.includes(record.id)) {
                      record.groupId = existingGroup.id;
                      record.status = 'reviewing';
                    }
                  });
                }
              } else {
                const groupId = `grp_${generateId()}`;
                existingGroupMap.set(groupId, {
                  id: groupId,
                  canonicalName,
                  memberIds: newMemberIds,
                  reviewStatus: 'pending',
                });
                newRecords.forEach((record) => {
                  if (newMemberIds.includes(record.id)) {
                    record.groupId = groupId;
                    record.status = 'reviewing';
                  }
                });
              }
            }
          });

          const importLog: ImportLog = {
            id: `imp_${generateId()}`,
            fileName: file.name,
            recordCount: newRecords.length,
            importVersion,
            operator,
            timestamp: Date.now(),
          };

          set((state) => ({
            records: [...state.records, ...newRecords],
            groups: Array.from(existingGroupMap.values()),
            importHistory: [...state.importHistory, importLog],
            previewRows: [],
            isLoading: false,
          }));

          get().runSelfCheck();
        } catch (error) {
          console.error('Import CSV error:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      updateRecord: (id: string, updates: Partial<SongRecord>, operator: string, reason?: string) => {
        set((state) => {
          const record = state.records.find((r) => r.id === id);
          if (!record) return state;

          const manualChanges: ManualChange[] = [];
          Object.entries(updates).forEach(([field, newValue]) => {
            const oldValue = record[field as keyof SongRecord];
            if (oldValue !== newValue && field !== 'updatedAt' && field !== 'manualChanges') {
              manualChanges.push({
                id: `chg_${generateId()}`,
                field,
                oldValue: String(oldValue),
                newValue: String(newValue),
                operator,
                timestamp: Date.now(),
                reason,
              });
            }
          });

          const updatedRecords = state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...updates,
                  manualChanges: [...r.manualChanges, ...manualChanges],
                  updatedAt: Date.now(),
                }
              : r
          );

          return { records: updatedRecords };
        });

        if (updates.audioNote !== undefined) {
          get().recalculateEmotion(id);
        }

        get().runSelfCheck();
      },

      batchUpdateStatus: (ids: string[], status: RecordStatus) => {
        set((state) => ({
          records: state.records.map((r) =>
            ids.includes(r.id) ? { ...r, status, updatedAt: Date.now() } : r
          ),
        }));
        get().runSelfCheck();
      },

      createGroup: (recordIds: string[], canonicalName: string) => {
        const groupId = `grp_${generateId()}`;
        set((state) => {
          const newGroup: SongGroup = {
            id: groupId,
            canonicalName,
            memberIds: recordIds,
            reviewStatus: 'pending',
          };

          const updatedRecords = state.records.map((r) =>
            recordIds.includes(r.id)
              ? { ...r, groupId, status: 'reviewing' as const, updatedAt: Date.now() }
              : r
          );

          return {
            groups: [...state.groups, newGroup],
            records: updatedRecords,
          };
        });
        get().runSelfCheck();
        return groupId;
      },

      confirmGroup: (groupId: string, reviewer: string) => {
        set((state) => {
          const group = state.groups.find((g) => g.id === groupId);
          if (!group) return state;

          const members = group.memberIds
            .map((id) => state.records.find((r) => r.id === id))
            .filter(Boolean) as SongRecord[];

          const primaryMember = members[0];
          if (!primaryMember) return state;

          const updatedRecords = state.records.map((r) =>
            group.memberIds.includes(r.id)
              ? {
                  ...r,
                  emotionTag: primaryMember.emotionTag,
                  emotionConfidence: primaryMember.emotionConfidence,
                  emotionUpdatedAt: Date.now(),
                  status: 'confirmed' as const,
                  updatedAt: Date.now(),
                }
              : r
          );

          const updatedGroups = state.groups.map((g) =>
            g.id === groupId
              ? { ...g, reviewStatus: 'confirmed' as const, reviewedBy: reviewer, reviewedAt: Date.now() }
              : g
          );

          return { records: updatedRecords, groups: updatedGroups };
        });
        get().runSelfCheck();
      },

      rejectGroup: (groupId: string) => {
        set((state) => {
          const group = state.groups.find((g) => g.id === groupId);
          if (!group) return state;

          const updatedRecords = state.records.map((r) =>
            group.memberIds.includes(r.id)
              ? { ...r, groupId: undefined, status: 'pending' as const, updatedAt: Date.now() }
              : r
          );

          const updatedGroups = state.groups.map((g) =>
            g.id === groupId
              ? { ...g, reviewStatus: 'rejected' as const, reviewedAt: Date.now() }
              : g
          );

          return { records: updatedRecords, groups: updatedGroups };
        });
        get().runSelfCheck();
      },

      removeFromGroup: (recordId: string) => {
        set((state) => {
          const record = state.records.find((r) => r.id === recordId);
          if (!record || !record.groupId) return state;

          const group = state.groups.find((g) => g.id === record.groupId);
          if (!group) return state;

          const updatedGroup = {
            ...group,
            memberIds: group.memberIds.filter((id) => id !== recordId),
          };

          const updatedGroups =
            updatedGroup.memberIds.length < 2
              ? state.groups.filter((g) => g.id !== group.id)
              : state.groups.map((g) => (g.id === group.id ? updatedGroup : g));

          return {
            records: state.records.map((r) =>
              r.id === recordId ? { ...r, groupId: undefined, updatedAt: Date.now() } : r
            ),
            groups: updatedGroups,
          };
        });
        get().runSelfCheck();
      },

      runSelfCheck: () => {
        const { records, groups } = get();
        const results = runAllSelfChecks(records, groups);
        set({ selfCheckResults: results, lastSelfCheckAt: Date.now() });
      },

      resolveIssue: (issueId: string) => {
        set((state) => ({
          selfCheckResults: state.selfCheckResults.map((result) => ({
            ...result,
            issues: result.issues.map((issue) =>
              issue.id === issueId ? { ...issue, resolved: true } : issue
            ),
            passed: result.issues.every(
              (issue) => issue.id === issueId ? true : issue.resolved
            ),
          })),
        }));
      },

      recalculateEmotion: (recordId: string) => {
        set((state) => {
          const record = state.records.find((r) => r.id === recordId);
          if (!record) return state;

          const updates = recalculateEmotionForRecord(record);

          return {
            records: state.records.map((r) =>
              r.id === recordId ? { ...r, ...updates, updatedAt: Date.now() } : r
            ),
          };
        });
        get().runSelfCheck();
      },

      recalculateAllEmotions: () => {
        set((state) => ({
          records: state.records.map((r) => {
            const updates = recalculateEmotionForRecord(r);
            return { ...r, ...updates, updatedAt: Date.now() };
          }),
        }));
        get().runSelfCheck();
      },

      loadSampleData: () => {
        set({
          records: sampleRecords,
          groups: sampleGroups,
          importHistory: sampleImportHistory,
        });
        get().runSelfCheck();
      },

      clearAllData: () => {
        set({
          records: [],
          groups: [],
          selfCheckResults: [],
          importHistory: [],
          previewRows: [],
          lastSelfCheckAt: null,
        });
      },
    }),
    {
      name: 'emotion-label-storage',
      version: 1,
    }
  )
);
