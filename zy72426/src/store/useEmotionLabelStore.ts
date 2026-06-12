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
import { sampleRecords, sampleGroups, sampleImportHistory, sampleLastImportInfo } from '@/data/sampleData';
import { parseCSVFile, generatePreview, convertToRecords, ParsedCSVRow } from '@/utils/csvParser';
import { findNameMappingCandidates } from '@/utils/nameMatcher';
import { recalculateEmotionForRecord } from '@/utils/emotionCalculator';
import { runAllSelfChecks } from '@/utils/selfCheckEngine';
import {
  buildUnifiedView,
  UnifiedDataView,
  ImportResultInfo,
  verifyDataConsistency,
  DataSource,
  ConsistencyDiff,
} from '@/utils/unifiedDataApi';

interface EmotionLabelState {
  records: SongRecord[];
  groups: SongGroup[];
  selfCheckResults: SelfCheckResult[];
  importHistory: ImportLog[];
  previewRows: ImportPreviewRow[];
  isLoading: boolean;
  lastSelfCheckAt: number | null;
  lastImportInfo: ImportResultInfo | null;
  consistencyCheckResult: { passed: boolean; diffs: ConsistencyDiff[]; checkedAt: number | null };

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

  getUnifiedView: (source?: DataSource) => UnifiedDataView;
  runConsistencyCheck: () => void;
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const buildAndVerify = (records: SongRecord[], groups: SongGroup[]) => {
  const pageView = buildUnifiedView(records, groups, 'page');
  const exportView = buildUnifiedView(records, groups, 'export');
  const reportView = buildUnifiedView(records, groups, 'report');
  const check1 = verifyDataConsistency(pageView, exportView);
  const check2 = verifyDataConsistency(pageView, reportView);
  return {
    passed: check1.passed && check2.passed,
    diffs: [...check1.diffs, ...check2.diffs],
    checkedAt: Date.now(),
  };
};

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
      lastImportInfo: null,
      consistencyCheckResult: { passed: true, diffs: [], checkedAt: null },

      getUnifiedView: (source: DataSource = 'api') => {
        return buildUnifiedView(get().records, get().groups, source);
      },

      runConsistencyCheck: () => {
        const result = buildAndVerify(get().records, get().groups);
        set({ consistencyCheckResult: result });
      },

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

          const existingRecords = get().records;

          const existingKeyMap = new Map<string, SongRecord>();
          existingRecords.forEach((r) => {
            const key = `${r.liveName.trim()}|${r.copyrightName.trim()}`;
            existingKeyMap.set(key, r);
          });

          const newRows: ParsedCSVRow[] = [];
          const reusedPairs: { existingRecord: SongRecord; matchedRowNumber: number }[] = [];
          const duplicatePairs: { newRecord: SongRecord; existingRecord: SongRecord }[] = [];

          parsedRows.forEach((row) => {
            const liveName = ((row['现场名'] as string) || row['liveName'] || '').trim();
            const copyrightName = ((row['版权名'] as string) || row['copyrightName'] || '').trim();
            const key = `${liveName}|${copyrightName}`;
            if (existingKeyMap.has(key)) {
              reusedPairs.push({
                existingRecord: existingKeyMap.get(key)!,
                matchedRowNumber: row.originalRowNumber,
              });
            } else {
              newRows.push(row);
            }
          });

          const newRecords = convertToRecords(newRows, importVersion, operator);

          newRecords.forEach((nr) => {
            const nrKey = `${nr.liveName.trim()}|${nr.copyrightName.trim()}`;
            if (existingKeyMap.has(nrKey)) {
              duplicatePairs.push({
                newRecord: nr,
                existingRecord: existingKeyMap.get(nrKey)!,
              });
            }
          });

          const allRecordsForMapping = [...existingRecords, ...newRecords];
          const nameMappingGroups = findNameMappingCandidates(allRecordsForMapping);
          const existingGroupMap = new Map(get().groups.map((g) => [g.id, { ...g }]));
          const nameMappingCandidates: { recordIds: string[]; suggestedGroupName: string }[] = [];

          nameMappingGroups.forEach((memberIds) => {
            const newMemberIds = memberIds.filter((id) =>
              newRecords.some((r) => r.id === id)
            );
            const existingMemberIds = memberIds.filter((id) =>
              existingRecords.some((r) => r.id === id)
            );

            if (newMemberIds.length + existingMemberIds.length >= 2) {
              const allMembers = [...newMemberIds, ...existingMemberIds].map(
                (id) =>
                  newRecords.find((r) => r.id === id) ||
                  existingRecords.find((r) => r.id === id)
              );
              let canonicalName = '';
              if (allMembers.length > 0 && allMembers[0]) {
                canonicalName = allMembers[0].liveName || allMembers[0].copyrightName;
              }

              if (existingMemberIds.length > 0) {
                const existingGroup = get().groups.find((g) =>
                  existingMemberIds.some((id) => g.memberIds.includes(id))
                );
                if (existingGroup) {
                  const combinedIds = [...new Set([...existingGroup.memberIds, ...newMemberIds])];
                  existingGroupMap.set(existingGroup.id, {
                    ...existingGroup,
                    memberIds: combinedIds,
                  });
                  newRecords.forEach((record) => {
                    if (newMemberIds.includes(record.id)) {
                      record.groupId = existingGroup.id;
                      record.status = 'reviewing';
                    }
                  });
                  nameMappingCandidates.push({
                    recordIds: combinedIds,
                    suggestedGroupName: existingGroup.canonicalName || canonicalName,
                  });
                } else {
                  const groupId = `grp_${generateId()}`;
                  existingGroupMap.set(groupId, {
                    id: groupId,
                    canonicalName,
                    memberIds: [...newMemberIds, ...existingMemberIds],
                    reviewStatus: 'pending',
                  });
                  newRecords.forEach((record) => {
                    if (newMemberIds.includes(record.id)) {
                      record.groupId = groupId;
                      record.status = 'reviewing';
                    }
                  });
                  existingRecords.forEach((record) => {
                    if (existingMemberIds.includes(record.id) && !record.groupId) {
                      const found = existingRecords.find((r) => r.id === record.id);
                      if (found) {
                        found.groupId = groupId;
                        found.status = 'reviewing';
                      }
                    }
                  });
                  nameMappingCandidates.push({
                    recordIds: [...newMemberIds, ...existingMemberIds],
                    suggestedGroupName: canonicalName,
                  });
                }
              } else if (newMemberIds.length >= 2) {
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
                nameMappingCandidates.push({
                  recordIds: newMemberIds,
                  suggestedGroupName: canonicalName,
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

          const updatedExisting = existingRecords.map((r) => {
            for (const [groupId, group] of existingGroupMap.entries()) {
              if (group.memberIds.includes(r.id)) {
                if (!r.groupId || r.groupId !== groupId) {
                  return { ...r, groupId, status: 'reviewing' as const };
                }
              }
            }
            return r;
          });

          const finalRecords = [...updatedExisting, ...newRecords];
          const finalGroups = Array.from(existingGroupMap.values());
          const consistencyResult = buildAndVerify(finalRecords, finalGroups);
          const importBatch = get().importHistory.length + 1;

          const resultingReviewCount = finalRecords.filter((r) => r.status === 'reviewing').length;
          const reusedPairsForDisplay = reusedPairs.map((p) => {
            const existingRecord = p.existingRecord;
            const group = existingRecord.groupId
              ? finalGroups.find((g) => g.id === existingRecord.groupId)
              : undefined;
            return {
              newKey: `${existingRecord.liveName}|${existingRecord.copyrightName}|${p.matchedRowNumber}`,
              liveName: existingRecord.liveName,
              copyrightName: existingRecord.copyrightName,
              existingOriginalRow: existingRecord.originalRowNumber,
              existingGroupCount: group ? group.memberIds.length : 1,
            };
          });

          const rejectedDuplicates = duplicatePairs.map((p) => ({
            row: p.newRecord.originalRowNumber,
            liveName: p.newRecord.liveName,
            copyrightName: p.newRecord.copyrightName,
            duplicateOfOriginalRow: p.existingRecord.originalRowNumber,
          }));

          set((state) => ({
            records: finalRecords,
            groups: finalGroups,
            importHistory: [...state.importHistory, importLog],
            previewRows: [],
            isLoading: false,
            lastImportInfo: {
              importVersion,
              importBatch,
              importedAt: Date.now(),
              operator,
              rawRows: parsedRows.length,
              totalRowsInFile: parsedRows.length,
              newRows: newRecords.length,
              reusedRows: reusedPairs.length,
              resultingReviewCount,
              newRecords,
              reusedRecords: reusedPairs,
              reusedPairs: reusedPairsForDisplay,
              rejectedDuplicates,
              duplicateWarnings: duplicatePairs,
              nameMappingCandidates,
            },
            consistencyCheckResult: consistencyResult,
          }));

          get().runSelfCheck();
        } catch (error) {
          console.error('Import CSV error:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      updateRecord: (id: string, updates: Partial<SongRecord>, operator: string, reason?: string) => {
        let affectedGroup: string[] = [id];

        set((state) => {
          const record = state.records.find((r) => r.id === id);
          if (!record) return state;

          if (record.groupId) {
            const group = state.groups.find((g) => g.id === record.groupId);
            if (group && group.reviewStatus === 'confirmed') {
              affectedGroup = group.memberIds;
            }
          }

          const manualChanges: ManualChange[] = [];
          Object.entries(updates).forEach(([field, newValue]) => {
            const oldValue = (record as unknown as Record<string, unknown>)[field];
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

          const applyUpdatesToRecord = (r: SongRecord): SongRecord => {
            if (!affectedGroup.includes(r.id)) return r;
            return {
              ...r,
              ...updates,
              manualChanges: [...r.manualChanges, ...manualChanges],
              updatedAt: Date.now(),
            };
          };

          const updatedRecords = state.records.map(applyUpdatesToRecord);
          const consistency = buildAndVerify(updatedRecords, state.groups);

          return {
            records: updatedRecords,
            consistencyCheckResult: consistency,
          };
        });

        if (updates.audioNote !== undefined) {
          affectedGroup.forEach((rid) => get().recalculateEmotion(rid));
        } else {
          get().runSelfCheck();
          get().runConsistencyCheck();
        }
      },

      batchUpdateStatus: (ids: string[], status: RecordStatus) => {
        set((state) => {
          const updatedRecords = state.records.map((r) =>
            ids.includes(r.id) ? { ...r, status, updatedAt: Date.now() } : r
          );
          const consistency = buildAndVerify(updatedRecords, state.groups);
          return { records: updatedRecords, consistencyCheckResult: consistency };
        });
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

          const consistency = buildAndVerify(updatedRecords, [...state.groups, newGroup]);

          return {
            groups: [...state.groups, newGroup],
            records: updatedRecords,
            consistencyCheckResult: consistency,
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

          const consistency = buildAndVerify(updatedRecords, updatedGroups);

          return { records: updatedRecords, groups: updatedGroups, consistencyCheckResult: consistency };
        });
        get().runSelfCheck();
        get().runConsistencyCheck();
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

          const consistency = buildAndVerify(updatedRecords, updatedGroups);

          return { records: updatedRecords, groups: updatedGroups, consistencyCheckResult: consistency };
        });
        get().runSelfCheck();
        get().runConsistencyCheck();
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

          const updatedRecords = state.records.map((r) =>
            r.id === recordId ? { ...r, groupId: undefined, updatedAt: Date.now() } : r
          );

          const consistency = buildAndVerify(updatedRecords, updatedGroups);

          return {
            records: updatedRecords,
            groups: updatedGroups,
            consistencyCheckResult: consistency,
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
          const updatedRecords = state.records.map((r) =>
            r.id === recordId ? { ...r, ...updates, updatedAt: Date.now() } : r
          );
          const consistency = buildAndVerify(updatedRecords, state.groups);
          return { records: updatedRecords, consistencyCheckResult: consistency };
        });
        get().runSelfCheck();
        get().runConsistencyCheck();
      },

      recalculateAllEmotions: () => {
        set((state) => {
          const updatedRecords = state.records.map((r) => {
            const updates = recalculateEmotionForRecord(r);
            return { ...r, ...updates, updatedAt: Date.now() };
          });
          const consistency = buildAndVerify(updatedRecords, state.groups);
          return { records: updatedRecords, consistencyCheckResult: consistency };
        });
        get().runSelfCheck();
        get().runConsistencyCheck();
      },

      loadSampleData: () => {
        const consistency = buildAndVerify(sampleRecords, sampleGroups);
        set({
          records: sampleRecords,
          groups: sampleGroups,
          importHistory: sampleImportHistory,
          lastImportInfo: sampleLastImportInfo,
          consistencyCheckResult: consistency,
        });
        get().runSelfCheck();
        get().runConsistencyCheck();
      },

      clearAllData: () => {
        set({
          records: [],
          groups: [],
          selfCheckResults: [],
          importHistory: [],
          previewRows: [],
          lastSelfCheckAt: null,
          lastImportInfo: null,
          consistencyCheckResult: { passed: true, diffs: [], checkedAt: null },
        });
      },
    }),
    {
      name: 'emotion-label-storage',
      version: 2,
    }
  )
);
