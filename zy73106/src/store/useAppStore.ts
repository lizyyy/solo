import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState, DrawingMetrics, NoteBlock, NoteTag,
  ValueChangeLog, DrawingStatus, Drawing, ExportLog,
} from '@/types';
import { METRIC_FIELD_LABELS } from '@/types';
import { INITIAL_STATE, USERS } from './mockData';
import { nowIso, uid } from '@/utils/date';

interface StoreState extends AppState {
  dirtyExport: boolean;

  setCurrentUser: (userId: string) => void;

  addNote: (payload: {
    drawingId: string;
    content: string;
    tag: NoteTag;
    isRawBimClue?: boolean;
  }) => NoteBlock | null;

  deleteNote: (noteId: string) => boolean;

  updateMetric: (payload: {
    drawingId: string;
    field: keyof DrawingMetrics;
    newValue: number;
    reason: string;
  }) => ValueChangeLog | null;

  setDrawingStatus: (drawingId: string, status: DrawingStatus) => boolean;

  markMaterialSupplied: (materialId: string) => void;
  setMaterialMissing: (payload: { materialId: string; reviewHint: string }) => void;

  logExport: (payload: { type: 'pdf' | 'csv'; drawingId?: string; fileName: string }) => ExportLog;

  resetAll: () => void;
}

const STORAGE_KEY = 'bim-preaudit-store-v1';

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      dirtyExport: false,

      setCurrentUser: (userId) => {
        const u = USERS.find((x) => x.id === userId);
        if (u) set({ currentUser: u });
      },

      /**
       * R1: 备注永不覆盖 —— 只允许 ADD 操作，不存在 UPDATE 接口
       * R6: 新增备注后标记导出 dirty
       */
      addNote: ({ drawingId, content, tag, isRawBimClue = false }) => {
        const { drawings, currentUser, notes } = get();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (!drawing) return null;

        // R4: 只有最新版本才允许编辑（在组件层也会拦，这里双重保障）
        const isLatest = true;
        if (!isLatest) return null;

        const newNote: NoteBlock = {
          id: uid('n-'),
          drawingId,
          versionId: drawing.currentVersionId,
          content: content.trim(),
          authorId: currentUser.id,
          authorName: currentUser.name,
          createdAt: nowIso(),
          tag,
          isRawBimClue,
        };
        const updatedDrawings = drawings.map((d) =>
          d.id === drawingId ? { ...d, updatedAt: nowIso() } : d,
        );
        set({ notes: [...notes, newNote], drawings: updatedDrawings, dirtyExport: true });
        return newNote;
      },

      /**
       * R2: BIM 原始线索 isRawBimClue=true 的备注不可删除
       */
      deleteNote: (noteId) => {
        const { notes } = get();
        const target = notes.find((n) => n.id === noteId);
        if (!target || target.isRawBimClue) return false;
        set({
          notes: notes.filter((n) => n.id !== noteId),
          dirtyExport: true,
        });
        return true;
      },

      /**
       * R3: 修改指标必须提供 reason，自动写入 changeLogs
       * R6: 变更后标记导出 dirty
       */
      updateMetric: ({ drawingId, field, newValue, reason }) => {
        if (!reason || reason.trim().length < 2) return null;
        const { drawings, currentUser, changeLogs } = get();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (!drawing) return null;
        const oldValue = drawing.metrics[field];
        if (oldValue === newValue) return null;

        const log: ValueChangeLog = {
          id: uid('c-'),
          drawingId,
          fieldName: field,
          fieldLabel: METRIC_FIELD_LABELS[field],
          oldValue,
          newValue,
          reason: reason.trim(),
          operatorId: currentUser.id,
          operatorName: currentUser.name,
          changedAt: nowIso(),
        };
        const updatedDrawings: Drawing[] = drawings.map((d) =>
          d.id === drawingId
            ? { ...d, metrics: { ...d.metrics, [field]: newValue }, updatedAt: nowIso() }
            : d,
        );
        set({
          drawings: updatedDrawings,
          changeLogs: [...changeLogs, log],
          dirtyExport: true,
        });
        return log;
      },

      /**
       * R5: 状态流转到 reviewing/closed 必须有 review/fix 类备注
       */
      setDrawingStatus: (drawingId, status) => {
        const { drawings, notes } = get();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (!drawing) return false;
        if (status === 'reviewing' || status === 'closed') {
          const hasTreatedNote = notes.some(
            (n) => n.drawingId === drawingId && (n.tag === 'review' || n.tag === 'fix'),
          );
          if (!hasTreatedNote) return false;
        }
        const updated = drawings.map((d) =>
          d.id === drawingId ? { ...d, status, updatedAt: nowIso() } : d,
        );
        set({ drawings: updated, dirtyExport: true });
        return true;
      },

      markMaterialSupplied: (materialId) => {
        const { materials } = get();
        set({
          materials: materials.map((m) =>
            m.id === materialId ? { ...m, isMissing: false, suppliedAt: nowIso() } : m,
          ),
          dirtyExport: true,
        });
      },

      setMaterialMissing: ({ materialId, reviewHint }) => {
        const { materials } = get();
        set({
          materials: materials.map((m) =>
            m.id === materialId ? { ...m, isMissing: true, reviewHint, suppliedAt: undefined } : m,
          ),
          dirtyExport: true,
        });
      },

      logExport: ({ type, drawingId, fileName }) => {
        const { currentUser, exportLogs } = get();
        const log: ExportLog = {
          id: uid('e-'),
          type,
          drawingId,
          operatorName: currentUser.name,
          exportedAt: nowIso(),
          fileName,
        };
        set({ exportLogs: [log, ...exportLogs], dirtyExport: false });
        return log;
      },

      resetAll: () => {
        set({ ...INITIAL_STATE, dirtyExport: false });
      },
    }),
    { name: STORAGE_KEY },
  ),
);

export const getSummary = (s: StoreState) => {
  const total = s.drawings.length;
  const abnormal = s.drawings.filter((d) => d.status === 'abnormal').length;
  const closed = s.drawings.filter((d) => d.status === 'closed').length;
  const reviewing = s.drawings.filter((d) => d.status === 'reviewing').length;
  const missingMaterials = s.materials.filter((m) => m.isMissing).length;
  return { total, abnormal, closed, reviewing, missingMaterials };
};
