import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ChannelTableEntry,
  Track,
  Annotation,
  Conflict,
  ImportRecord,
  AppState,
  ConflictResolution,
  ChannelFileStatus,
} from '@/types';
import { generateMockData } from '@/utils/mockData';
import { generateId } from '@/utils/fileParser';

const initialState = {
  channelTable: [] as ChannelTableEntry[],
  tracks: [] as Track[],
  annotations: [] as Annotation[],
  conflicts: [] as Conflict[],
  importRecords: [] as ImportRecord[],
  currentPage: 'import',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addChannelEntry: (entry: ChannelTableEntry) =>
        set((state) => ({
          channelTable: [...state.channelTable, entry],
        })),

      addChannelEntries: (entries: ChannelTableEntry[]) =>
        set((state) => ({
          channelTable: [...state.channelTable, ...entries],
        })),

      updateChannelEntry: (id: string, updates: Partial<ChannelTableEntry>) =>
        set((state) => ({
          channelTable: state.channelTable.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteChannelEntry: (id: string) =>
        set((state) => ({
          channelTable: state.channelTable.filter((e) => e.id !== id),
        })),

      addTrack: (track: Track) =>
        set((state) => ({
          tracks: [...state.tracks, track],
        })),

      updateTrack: (id: string, updates: Partial<Track>) =>
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        })),

      deleteTrack: (id: string) =>
        set((state) => ({
          tracks: state.tracks.filter((t) => t.id !== id),
          annotations: state.annotations.filter((a) => a.trackId !== id),
          conflicts: state.conflicts.map((c) =>
            c.trackId === id ? { ...c, trackId: undefined } : c
          ),
          importRecords: state.importRecords.filter((r) => r.trackId !== id),
        })),

      addAnnotation: (annotation: Annotation) =>
        set((state) => ({
          annotations: [...state.annotations, annotation],
        })),

      addConflict: (conflict: Conflict) =>
        set((state) => ({
          conflicts: [...state.conflicts, conflict],
        })),

      resolveConflict: (
        id: string,
        resolution: ConflictResolution,
        options?: { manualValue?: any; resolvedBy?: string; resolutionReason?: string }
      ) =>
        set((state) => {
          const conflict = state.conflicts.find((c) => c.id === id);
          if (!conflict) return state;

          const now = new Date().toISOString();
          const resolvedBy = options?.resolvedBy || '林老师';
          const resolutionReason = options?.resolutionReason || '';
          const manualValue = options?.manualValue;

          let newTracks = state.tracks;
          let newChannelTable = state.channelTable;
          let newImportRecords = state.importRecords;

          const buildResolutionNote = (
            action: string,
            extra?: { sideEffect?: string }
          ): string => {
            const parts = [
              `冲突类型：${conflict.conflictType}`,
              `字段：${conflict.field}`,
              `数据源A(${conflict.sourceA})：${JSON.stringify(conflict.originalValueA)}`,
              `数据源B(${conflict.sourceB})：${JSON.stringify(conflict.originalValueB)}`,
              `裁决动作：${action}`,
            ];
            if (extra?.sideEffect) parts.push(`处理结果：${extra.sideEffect}`);
            if (resolutionReason) parts.push(`处理原因：${resolutionReason}`);
            parts.push(`处理人：${resolvedBy}`);
            parts.push(`处理时间：${now}`);
            return parts.join(' | ');
          };

          if (conflict.conflictType === 'value_mismatch') {
            const resolvedValue =
              resolution === 'A'
                ? conflict.originalValueA
                : resolution === 'B'
                ? conflict.originalValueB
                : manualValue;

            newTracks = state.tracks.map((t) => {
              if (t.id !== conflict.trackId) return t;
              const actionStr =
                resolution === 'A'
                  ? `采用数据源A：${resolvedValue}`
                  : resolution === 'B'
                  ? `采用数据源B：${resolvedValue}`
                  : `人工输入：${resolvedValue}`;
              return {
                ...t,
                [conflict.field]: resolvedValue,
                resolutionNote: buildResolutionNote(actionStr),
                resolvedBy,
                updatedAt: now,
              };
            });

            const pendingConflicts = state.conflicts.filter(
              (c) => c.trackId === conflict.trackId && c.id !== id && c.status === 'pending'
            );
            if (pendingConflicts.length === 0) {
              newTracks = newTracks.map((t) =>
                t.id === conflict.trackId ? { ...t, status: 'normal' as const } : t
              );
            }
          } else if (conflict.conflictType === 'extra_file') {
            if (resolution === 'A') {
              if (conflict.trackId) {
                const resolutionNoteStr = buildResolutionNote(
                  '已删除该文件（从曲目台账软移除）',
                  { sideEffect: '文件记录保留，仅标记为已删除；导入记录、批注、冲突历史全部保留可审计' }
                );
                newTracks = state.tracks.map((t) =>
                  t.id === conflict.trackId
                    ? {
                        ...t,
                        status: 'deleted' as const,
                        channelTableId: undefined,
                        resolutionNote: resolutionNoteStr,
                        resolvedBy,
                        updatedAt: now,
                      }
                    : t
                );
                newImportRecords = state.importRecords.map((r) =>
                  r.trackId === conflict.trackId
                    ? {
                        ...r,
                        status: 'deleted_manually' as const,
                        resolutionNote: resolutionNoteStr,
                        resolvedBy,
                        resolutionReason,
                        resolvedAt: now,
                      }
                    : r
                );
              }
            } else if (resolution === 'B' || resolution === 'ignore') {
              newTracks = state.tracks.map((t) => {
                if (t.id !== conflict.trackId) return t;
                return {
                  ...t,
                  status: 'normal' as const,
                  channelTableId: undefined,
                  resolutionNote: buildResolutionNote(
                    resolution === 'B' ? '保留该文件（不关联通道表）' : '暂忽略，待后续处理'
                  ),
                  resolvedBy,
                  updatedAt: now,
                };
              });
            } else if (resolution === 'add_to_channel') {
              const newEntryId = generateId();
              const track = state.tracks.find((t) => t.id === conflict.trackId);
              if (track) {
                newChannelTable = [
                  ...state.channelTable,
                  {
                    id: newEntryId,
                    channelNo: track.channelNo || String(state.channelTable.length + 1),
                    trackName: track.trackName,
                    artist: track.artist,
                    duration: track.duration,
                    source: `裁决补录·${resolvedBy}`,
                    note: `通过冲突裁决补录，来源文件：${track.fileName}`,
                    fileStatus: 'matched' as ChannelFileStatus,
                    resolutionNote: `由多余文件裁决补录，原始文件名：${track.fileName} | 处理人：${resolvedBy} | 处理时间：${now}${resolutionReason ? ` | 处理原因：${resolutionReason}` : ''}`,
                    resolvedBy,
                    resolutionReason,
                    resolvedAt: now,
                    createdAt: now,
                    updatedAt: now,
                  },
                ];
                newTracks = state.tracks.map((t) => {
                  if (t.id !== conflict.trackId) return t;
                  return {
                    ...t,
                    status: 'normal' as const,
                    channelTableId: newEntryId,
                    resolutionNote: buildResolutionNote(
                      '已将该文件补录到舞台通道表',
                      { sideEffect: `新增通道条目ID=${newEntryId}` }
                    ),
                    resolvedBy,
                    updatedAt: now,
                  };
                });
              }
            } else if (resolution === 'manual' && manualValue !== undefined) {
              newTracks = state.tracks.map((t) => {
                if (t.id !== conflict.trackId) return t;
                return {
                  ...t,
                  status: 'normal' as const,
                  trackName: typeof manualValue === 'string' ? manualValue : t.trackName,
                  resolutionNote: buildResolutionNote(`人工修正：${manualValue}`),
                  resolvedBy,
                  updatedAt: now,
                };
              });
            }
          } else if (conflict.conflictType === 'missing_file') {
            let fileStatus: ChannelFileStatus = 'pending';
            let actionLabel = '';
            let sideEffect = '';

            if (resolution === 'ignore' || resolution === 'A') {
              fileStatus = 'confirmed_missing';
              actionLabel = '已确认：现场实际未使用，不补传文件';
              sideEffect = '通道表条目保留；标记为已确认无文件，不再提醒';
            } else if (resolution === 'B') {
              fileStatus = 'pending_upload';
              actionLabel = '已标记：待补传文件';
              sideEffect = '通道表条目保留；等待后续上传对应音频';
            } else if (resolution === 'delete_track' && conflict.channelEntryId) {
              fileStatus = 'removed_from_setlist';
              actionLabel = '已从曲目单移除（软删除，保留审计）';
              sideEffect = '不物理删除通道表条目，仅标记为已移除；可导出核查';
            }

            if (conflict.channelEntryId) {
              const resolutionNoteStr = buildResolutionNote(actionLabel, {
                sideEffect: sideEffect || undefined,
              });
              newChannelTable = state.channelTable.map((e) =>
                e.id === conflict.channelEntryId
                  ? {
                      ...e,
                      fileStatus,
                      resolutionNote: resolutionNoteStr,
                      resolvedBy,
                      resolutionReason,
                      resolvedAt: now,
                      updatedAt: now,
                    }
                  : e
              );
            }

            if (conflict.trackId) {
              newTracks = state.tracks.map((t) => {
                if (t.id !== conflict.trackId) return t;
                return {
                  ...t,
                  status: 'normal' as const,
                  resolutionNote: buildResolutionNote(actionLabel),
                  resolvedBy,
                  updatedAt: now,
                };
              });
            }
          }

          const updatedConflicts = state.conflicts.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: 'resolved' as const,
                  resolution,
                  manualValue,
                  resolvedBy,
                  resolutionReason,
                  resolvedAt: now,
                }
              : c
          );

          return {
            conflicts: updatedConflicts,
            tracks: newTracks,
            channelTable: newChannelTable,
            importRecords: newImportRecords,
          };
        }),

      addImportRecord: (record: ImportRecord) =>
        set((state) => ({
          importRecords: [...state.importRecords, record],
        })),

      updateImportRecord: (id: string, updates: Partial<ImportRecord>) =>
        set((state) => ({
          importRecords: state.importRecords.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      setCurrentPage: (page: string) => set({ currentPage: page }),

      clearAll: () => set(initialState),

      loadMockData: () => {
        const mock = generateMockData();
        set({
          channelTable: mock.channelTable,
          tracks: mock.tracks,
          annotations: mock.annotations,
          conflicts: mock.conflicts,
          importRecords: mock.importRecords,
        });
      },
    }),
    {
      name: 'music-royalty-tracker-storage',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          persisted = { ...persisted, channelTable: [] };
        }
        const now = new Date().toISOString();
        if (version < 3) {
          persisted.conflicts = (persisted.conflicts || []).map((c: any) => ({
            ...c,
            conflictType:
              c.valueA === '无匹配记录' || c.sourceA === '缺失检测'
                ? c.sourceA === '缺失检测'
                  ? 'missing_file'
                  : 'extra_file'
                : 'value_mismatch',
            originalValueA: c.valueA,
            originalValueB: c.valueB,
            channelEntryId: undefined,
            createdAt: c.createdAt || now,
          }));
          persisted.tracks = (persisted.tracks || []).map((t: any) => ({
            ...t,
            resolutionNote: t.resolutionNote || undefined,
            resolvedBy: t.resolvedBy || undefined,
          }));
        }
        if (version < 4) {
          persisted.channelTable = (persisted.channelTable || []).map((e: any) => ({
            ...e,
            fileStatus:
              e.fileStatus ||
              (persisted.tracks || []).some((t: any) => t.channelTableId === e.id)
                ? 'matched'
                : 'pending',
            resolutionNote: e.resolutionNote || undefined,
            resolvedBy: e.resolvedBy || undefined,
            resolutionReason: e.resolutionReason || undefined,
            resolvedAt: e.resolvedAt || undefined,
          }));
          persisted.importRecords = (persisted.importRecords || []).map((r: any) => ({
            ...r,
            status: r.status === 'deleted_manually' ? r.status : r.status,
            resolutionNote: r.resolutionNote || undefined,
            resolvedBy: r.resolvedBy || undefined,
            resolutionReason: r.resolutionReason || undefined,
            resolvedAt: r.resolvedAt || undefined,
          }));
          persisted.tracks = (persisted.tracks || []).map((t: any) => ({
            ...t,
            status: t.status === 'deleted' ? t.status : t.status,
          }));
        }
        return persisted;
      },
    }
  )
);

export const getTrackWithDetails = (trackId: string) => {
  const state = useAppStore.getState();
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return null;

  return {
    ...track,
    annotations: state.annotations.filter((a) => a.trackId === trackId),
    conflicts: state.conflicts.filter((c) => c.trackId === trackId),
    importRecord: state.importRecords.find((r) => r.trackId === trackId),
    channelEntry: track.channelTableId
      ? state.channelTable.find((e) => e.id === track.channelTableId)
      : undefined,
  };
};
