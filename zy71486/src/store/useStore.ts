import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NoiseRecord, Room, Course, Conflict, ProcessingStatus, ImportBatch, ImportSourceType, ProcessingStatusType, StatusHistoryEntry } from '@/types';
import { CONFLICT_LABELS, DECIBEL_THRESHOLD } from '@/types';
import * as sampleDataModule from '@/data/sampleData';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function dateToWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  return String(d.getDay() || 7);
}

function timeOverlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

interface AppState {
  noiseRecords: NoiseRecord[];
  rooms: Room[];
  courses: Course[];
  conflicts: Conflict[];
  processingStatuses: ProcessingStatus[];
  importBatches: ImportBatch[];

  importNoiseData: (records: Omit<NoiseRecord, 'id' | 'batchId' | 'isUpdate' | 'isDuplicate' | 'previousVersionId'>[]) => ImportBatch;
  importRoomData: (rooms: Omit<Room, 'id' | 'batchId'>[]) => ImportBatch;
  importCourseData: (courses: Omit<Course, 'id' | 'batchId'>[]) => ImportBatch;
  loadSampleData: () => void;
  detectConflicts: () => void;
  updateProcessingStatus: (noiseRecordId: string, status: ProcessingStatusType, handler: string, result: string) => void;
  resolveConflict: (conflictId: string, resolution: string) => void;
  exportReport: (format: 'csv' | 'json') => string;
  clearAllData: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      noiseRecords: [],
      rooms: [],
      courses: [],
      conflicts: [],
      processingStatuses: [],
      importBatches: [],

      importNoiseData: (incoming) => {
        const batchId = generateId();
        let newCount = 0;
        let updatedCount = 0;
        let duplicateCount = 0;
        const existing = get().noiseRecords;
        const result: NoiseRecord[] = [...existing];

        for (const rec of incoming) {
          const matchIdx = result.findIndex(
            (r) => r.roomId === rec.roomId && r.date === rec.date && r.startTime === rec.startTime && !r.isDuplicate
          );

          if (matchIdx >= 0) {
            const existingRec = result[matchIdx];
            const isSameData =
              existingRec.endTime === rec.endTime &&
              existingRec.decibel === rec.decibel &&
              existingRec.complaintSource === rec.complaintSource &&
              existingRec.description === rec.description;

            if (isSameData) {
              duplicateCount++;
              result.push({
                ...rec,
                id: generateId(),
                batchId,
                isUpdate: false,
                isDuplicate: true,
                previousVersionId: existingRec.id,
              });
            } else {
              updatedCount++;
              const oldId = existingRec.id;
              result.push({
                ...rec,
                id: generateId(),
                batchId,
                isUpdate: true,
                isDuplicate: false,
                previousVersionId: oldId,
              });
            }
          } else {
            newCount++;
            result.push({
              ...rec,
              id: generateId(),
              batchId,
              isUpdate: false,
              isDuplicate: false,
              previousVersionId: null,
            });
          }
        }

        const newStatuses: ProcessingStatus[] = [];
        const existingStatusIds = new Set(get().processingStatuses.map((s) => s.noiseRecordId));
        for (const r of result) {
          if (!existingStatusIds.has(r.id) && !r.isDuplicate) {
            newStatuses.push({
              id: generateId(),
              noiseRecordId: r.id,
              status: 'PENDING',
              handler: '',
              result: '',
              previousResult: null,
              previousStatus: null,
              updatedAt: new Date().toISOString(),
              history: [],
            });
          }
        }

        const batch: ImportBatch = {
          id: batchId,
          sourceType: 'NOISE',
          totalCount: incoming.length,
          newCount,
          updatedCount,
          duplicateCount,
          importedAt: new Date().toISOString(),
        };

        set((s) => ({
          noiseRecords: result,
          processingStatuses: [...s.processingStatuses, ...newStatuses],
          importBatches: [...s.importBatches, batch],
        }));

        return batch;
      },

      importRoomData: (incoming) => {
        const batchId = generateId();
        let newCount = 0;
        let updatedCount = 0;
        let duplicateCount = 0;
        const existing = get().rooms;
        const result: Room[] = [...existing];

        for (const rm of incoming) {
          const matchIdx = result.findIndex((r) => r.roomId === rm.roomId);
          if (matchIdx >= 0) {
            const existingRoom = result[matchIdx];
            const isSameData =
              existingRoom.name === rm.name &&
              existingRoom.location === rm.location &&
              existingRoom.soundproofLevel === rm.soundproofLevel;
            if (isSameData) {
              duplicateCount++;
            } else {
              updatedCount++;
              result[matchIdx] = { ...rm, id: existingRoom.id, batchId };
            }
          } else {
            newCount++;
            result.push({ ...rm, id: generateId(), batchId });
          }
        }

        const batch: ImportBatch = {
          id: batchId,
          sourceType: 'ROOM',
          totalCount: incoming.length,
          newCount,
          updatedCount,
          duplicateCount,
          importedAt: new Date().toISOString(),
        };

        set((s) => ({
          rooms: result,
          importBatches: [...s.importBatches, batch],
        }));

        return batch;
      },

      importCourseData: (incoming) => {
        const batchId = generateId();
        let newCount = 0;
        let updatedCount = 0;
        let duplicateCount = 0;
        const existing = get().courses;
        const result: Course[] = [...existing];

        for (const crs of incoming) {
          const matchIdx = result.findIndex(
            (c) => c.roomId === crs.roomId && c.weekday === crs.weekday && c.startTime === crs.startTime
          );
          if (matchIdx >= 0) {
            const existingCourse = result[matchIdx];
            const isSameData =
              existingCourse.courseName === crs.courseName &&
              existingCourse.teacher === crs.teacher &&
              existingCourse.endTime === crs.endTime;
            if (isSameData) {
              duplicateCount++;
            } else {
              updatedCount++;
              result[matchIdx] = { ...crs, id: existingCourse.id, batchId };
            }
          } else {
            newCount++;
            result.push({ ...crs, id: generateId(), batchId });
          }
        }

        const batch: ImportBatch = {
          id: batchId,
          sourceType: 'COURSE',
          totalCount: incoming.length,
          newCount,
          updatedCount,
          duplicateCount,
          importedAt: new Date().toISOString(),
        };

        set((s) => ({
          courses: result,
          importBatches: [...s.importBatches, batch],
        }));

        return batch;
      },

      loadSampleData: () => {
        const state = get();
        const { sampleNoiseRecords, sampleRooms, sampleCourses } = sampleDataModule;
        state.importNoiseData(sampleNoiseRecords);
        state.importRoomData(sampleRooms);
        state.importCourseData(sampleCourses);
        get().detectConflicts();
      },

      detectConflicts: () => {
        const { noiseRecords, rooms, courses } = get();
        const newConflicts: Conflict[] = [];
        const roomIds = new Set(rooms.map((r) => r.roomId));

        for (const record of noiseRecords) {
          if (record.isDuplicate) continue;

          if (!roomIds.has(record.roomId)) {
            const existingConflict = get().conflicts.find(
              (c) => c.noiseRecordId === record.id && c.type === 'ROOM_NOT_FOUND'
            );
            if (!existingConflict) {
              newConflicts.push({
                id: generateId(),
                type: 'ROOM_NOT_FOUND',
                noiseRecordId: record.id,
                description: `分贝记录引用房间 ${record.roomId}，但房间台账中无此编号`,
                resolution: '',
                isResolved: false,
                createdAt: new Date().toISOString(),
              });
            }
          }

          if (roomIds.has(record.roomId)) {
            const weekday = dateToWeekday(record.date);
            const matchedCourses = courses.filter(
              (c) => c.roomId === record.roomId && c.weekday === weekday && timeOverlaps(c.startTime, c.endTime, record.startTime, record.endTime)
            );

            if (matchedCourses.length === 0) {
              const existingConflict = get().conflicts.find(
                (c) => c.noiseRecordId === record.id && c.type === 'TIME_MISMATCH'
              );
              if (!existingConflict) {
                newConflicts.push({
                  id: generateId(),
                  type: 'TIME_MISMATCH',
                  noiseRecordId: record.id,
                  description: `${record.date} ${record.startTime}-${record.endTime} 房间${record.roomId}无对应课程安排`,
                  resolution: '',
                  isResolved: false,
                  createdAt: new Date().toISOString(),
                });
              }
            }
          }

          const room = rooms.find((r) => r.roomId === record.roomId);
          if (room) {
            const levelMap: Record<string, number> = { A: 60, B: 70, C: 80, D: 90 };
            const threshold = levelMap[room.soundproofLevel] ?? DECIBEL_THRESHOLD;
            if (record.decibel > threshold + 10) {
              const existingConflict = get().conflicts.find(
                (c) => c.noiseRecordId === record.id && c.type === 'DATA_INCONSISTENT'
              );
              if (!existingConflict) {
                newConflicts.push({
                  id: generateId(),
                  type: 'DATA_INCONSISTENT',
                  noiseRecordId: record.id,
                  description: `${record.roomId}(${room.name})隔音等级${room.soundproofLevel}，超标阈值${threshold}dB，实测${record.decibel}dB，超出预期${record.decibel - threshold}dB`,
                  resolution: '',
                  isResolved: false,
                  createdAt: new Date().toISOString(),
                });
              }
            }
          }
        }

        set((s) => ({
          conflicts: [...s.conflicts.filter((c) => c.isResolved), ...newConflicts],
        }));
      },

      updateProcessingStatus: (noiseRecordId, status, handler, result) => {
        set((s) => {
          const idx = s.processingStatuses.findIndex((p) => p.noiseRecordId === noiseRecordId);
          if (idx < 0) return s;

          const current = s.processingStatuses[idx];
          const historyEntry: StatusHistoryEntry = {
            status: current.status,
            result: current.result,
            handler: current.handler,
            updatedAt: current.updatedAt,
          };

          const updated: ProcessingStatus = {
            ...current,
            status,
            handler: handler || current.handler,
            result: result || current.result,
            previousResult: current.result,
            previousStatus: current.status,
            updatedAt: new Date().toISOString(),
            history: [...current.history, historyEntry],
          };

          const newStatuses = [...s.processingStatuses];
          newStatuses[idx] = updated;
          return { processingStatuses: newStatuses };
        });
      },

      resolveConflict: (conflictId, resolution) => {
        set((s) => ({
          conflicts: s.conflicts.map((c) =>
            c.id === conflictId ? { ...c, resolution, isResolved: true } : c
          ),
        }));
      },

      exportReport: (format) => {
        const { noiseRecords, rooms, courses, conflicts, processingStatuses } = get();
        const activeRecords = noiseRecords.filter((r) => !r.isDuplicate);

        const reportData = activeRecords.map((r) => {
          const room = rooms.find((rm) => rm.roomId === r.roomId);
          const weekday = dateToWeekday(r.date);
          const matchedCourses = courses.filter(
            (c) => c.roomId === r.roomId && c.weekday === weekday && timeOverlaps(c.startTime, c.endTime, r.startTime, r.endTime)
          );
          const recordConflicts = conflicts.filter((c) => c.noiseRecordId === r.id);
          const status = processingStatuses.find((p) => p.noiseRecordId === r.id);

          return {
            id: r.id,
            房间编号: r.roomId,
            房间名称: room?.name ?? '未找到',
            位置: room?.location ?? '未知',
            隔音等级: room?.soundproofLevel ?? '未知',
            日期: r.date,
            开始时间: r.startTime,
            结束时间: r.endTime,
            分贝: r.decibel,
            超标: r.decibel > DECIBEL_THRESHOLD ? '是' : '否',
            投诉来源: r.complaintSource,
            描述: r.description,
            关联课程: matchedCourses.map((c) => c.courseName).join('、') || '无',
            任课教师: matchedCourses.map((c) => c.teacher).join('、') || '无',
            更新标记: r.isUpdate ? '已更新' : '新增',
            冲突数量: recordConflicts.length,
            冲突详情: recordConflicts.map((c) => `${CONFLICT_LABELS[c.type]}: ${c.description}${c.isResolved ? ' (已解决)' : ''}`).join('; '),
            处理状态: status ? status.status : '未录入',
            处理人: status?.handler ?? '',
            处理结果: status?.result ?? '',
            历史版本数: status?.history.length ?? 0,
          };
        });

        if (format === 'json') {
          return JSON.stringify(reportData, null, 2);
        }

        const headers = Object.keys(reportData[0] || {});
        const csvRows = [
          headers.join(','),
          ...reportData.map((row) =>
            headers.map((h) => {
              const val = String((row as Record<string, unknown>)[h] ?? '');
              return val.includes(',') ? `"${val}"` : val;
            }).join(',')
          ),
        ];
        return csvRows.join('\n');
      },

      clearAllData: () => {
        set({
          noiseRecords: [],
          rooms: [],
          courses: [],
          conflicts: [],
          processingStatuses: [],
          importBatches: [],
        });
      },
    }),
    {
      name: 'noise-complaint-ledger',
    }
  )
);
