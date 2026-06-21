import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState, DrawingMetrics, NoteBlock, NoteTag,
  ValueChangeLog, DrawingStatus, Drawing, ExportLog,
  DrawingVersion, MaterialBatch, User,
} from '@/types';
import { METRIC_FIELD_LABELS } from '@/types';
import { INITIAL_STATE, USERS } from './mockData';
import { nowIso, uid } from '@/utils/date';
import * as api from '@/services/api';

interface StoreState extends AppState {
  dirtyExport: boolean;

  setCurrentUser: (userId: string) => void;

  addNote: (payload: {
    drawingId: string;
    content: string;
    tag: NoteTag;
    isRawBimClue?: boolean;
  }) => Promise<NoteBlock | null>;

  deleteNote: (noteId: string) => Promise<boolean>;

  updateMetric: (payload: {
    drawingId: string;
    field: keyof DrawingMetrics;
    newValue: number;
    reason: string;
  }) => Promise<ValueChangeLog | null>;

  setDrawingStatus: (drawingId: string, status: DrawingStatus) => Promise<boolean>;

  markMaterialSupplied: (materialId: string) => Promise<void>;
  setMaterialMissing: (payload: { materialId: string; reviewHint: string }) => Promise<void>;

  logExport: (payload: { type: 'pdf' | 'csv' | 'json'; drawingId?: string; fileName: string }) => Promise<ExportLog | null>;

  resetAll: () => void;

  hydrateFromApi: () => Promise<void>;

  mergeDrawingDetail: (detail: {
    drawing: Drawing;
    versions: DrawingVersion[];
    notes: NoteBlock[];
    materials: MaterialBatch[];
    changeLogs: ValueChangeLog[];
  }) => void;
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

      addNote: async ({ drawingId, content, tag, isRawBimClue = false }) => {
        const { drawings, currentUser, notes } = get();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (!drawing) return null;

        try {
          const res = await api.addNote(drawingId, {
            content: content.trim(),
            tag,
            isRawBimClue,
            authorId: currentUser.id,
            authorName: currentUser.name,
          });

          if (!res.ok || !res.data) {
            console.error('[addNote] API failed:', res.error);
            return null;
          }

          const newNote = res.data;
          const updatedDrawings = drawings.map((d) =>
            d.id === drawingId ? { ...d, updatedAt: newNote.createdAt || nowIso() } : d,
          );
          set({ notes: [...notes, newNote], drawings: updatedDrawings, dirtyExport: true });
          return newNote;
        } catch (e) {
          console.error('[addNote] Unexpected error:', e);
          return null;
        }
      },

      deleteNote: async (noteId) => {
        const { notes } = get();
        const target = notes.find((n) => n.id === noteId);
        if (!target || target.isRawBimClue) return false;

        try {
          const res = await api.deleteNote(target.drawingId, noteId);
          if (!res.ok) {
            console.error('[deleteNote] API failed:', res.error);
            return false;
          }

          set({
            notes: notes.filter((n) => n.id !== noteId),
            dirtyExport: true,
          });
          return true;
        } catch (e) {
          console.error('[deleteNote] Unexpected error:', e);
          return false;
        }
      },

      updateMetric: async ({ drawingId, field, newValue, reason }) => {
        if (!reason || reason.trim().length < 2) return null;
        const { drawings, currentUser, changeLogs } = get();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (!drawing) return null;
        const oldValue = drawing.metrics[field];
        if (oldValue === newValue) return null;

        try {
          const res = await api.updateMetric(drawingId, {
            field,
            newValue,
            reason: reason.trim(),
            operatorId: currentUser.id,
            operatorName: currentUser.name,
          });

          if (!res.ok) {
            console.error('[updateMetric] API failed:', res.error);
            return null;
          }

          const log = res.data;
          if (!log) return null;

          const updatedDrawings: Drawing[] = drawings.map((d) =>
            d.id === drawingId
              ? { ...d, metrics: { ...d.metrics, [field]: newValue }, updatedAt: log.changedAt || nowIso() }
              : d,
          );
          set({
            drawings: updatedDrawings,
            changeLogs: [...changeLogs, log],
            dirtyExport: true,
          });
          return log;
        } catch (e) {
          console.error('[updateMetric] Unexpected error:', e);
          return null;
        }
      },

      setDrawingStatus: async (drawingId, status) => {
        const { drawings, notes, currentUser, changeLogs } = get();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (!drawing) return false;
        if (status === 'reviewing' || status === 'closed') {
          const hasTreatedNote = notes.some(
            (n) => n.drawingId === drawingId && (n.tag === 'review' || n.tag === 'fix'),
          );
          if (!hasTreatedNote) return false;
        }

        try {
          const res = await api.updateDrawingStatus(
            drawingId,
            status,
            currentUser.id,
            currentUser.name,
          );
          if (!res.ok) {
            console.error('[setDrawingStatus] API failed:', res.error);
            return false;
          }

          const ts = nowIso();
          const updated = drawings.map((d) =>
            d.id === drawingId ? { ...d, status, updatedAt: ts } : d,
          );

          const statusLog: ValueChangeLog = {
            id: uid('c-'),
            drawingId,
            fieldName: 'status' as keyof DrawingMetrics,
            fieldLabel: '图纸状态',
            oldValue: drawing.status === 'abnormal' ? 1 : drawing.status === 'reviewing' ? 2 : drawing.status === 'closed' ? 3 : 0,
            newValue: status === 'abnormal' ? 1 : status === 'reviewing' ? 2 : status === 'closed' ? 3 : 0,
            reason: `状态流转为 ${status}`,
            operatorId: currentUser.id,
            operatorName: currentUser.name,
            changedAt: ts,
          };

          set({ drawings: updated, changeLogs: [...changeLogs, statusLog], dirtyExport: true });
          return true;
        } catch (e) {
          console.error('[setDrawingStatus] Unexpected error:', e);
          return false;
        }
      },

      markMaterialSupplied: async (materialId) => {
        const { materials, drawings, currentUser, changeLogs } = get();
        const target = materials.find((m) => m.id === materialId);
        if (!target) return;

        try {
          const res = await api.markMaterialSupplied(materialId, currentUser.name);
          if (!res.ok) {
            console.error('[markMaterialSupplied] API failed:', res.error);
            return;
          }

          const ts = nowIso();
          const updatedMaterials = materials.map((m) =>
            m.id === materialId ? { ...m, isMissing: false, suppliedAt: ts } : m,
          );
          const updatedDrawings = drawings.map((d) =>
            d.id === target.drawingId ? { ...d, updatedAt: ts } : d,
          );

          const supplyLog: ValueChangeLog = {
            id: uid('c-'),
            drawingId: target.drawingId,
            fieldName: 'materialSupplied' as keyof DrawingMetrics,
            fieldLabel: `材料到位: ${target.materialName}`,
            oldValue: 1,
            newValue: 0,
            reason: '材料批次已到货并核验',
            operatorId: currentUser.id,
            operatorName: currentUser.name,
            changedAt: ts,
          };

          set({
            materials: updatedMaterials,
            drawings: updatedDrawings,
            changeLogs: [...changeLogs, supplyLog],
            dirtyExport: true,
          });
        } catch (e) {
          console.error('[markMaterialSupplied] Unexpected error:', e);
        }
      },

      setMaterialMissing: async ({ materialId, reviewHint }) => {
        const { materials, drawings, currentUser, changeLogs } = get();
        const target = materials.find((m) => m.id === materialId);
        if (!target) return;

        try {
          const res = await api.markMaterialMissing(
            materialId,
            reviewHint,
            currentUser.name,
            currentUser.id,
          );
          if (!res.ok) {
            console.error('[setMaterialMissing] API failed:', res.error);
            return;
          }

          const ts = nowIso();
          const updatedMaterials = materials.map((m) =>
            m.id === materialId ? { ...m, isMissing: true, reviewHint, suppliedAt: undefined } : m,
          );
          const updatedDrawings = drawings.map((d) =>
            d.id === target.drawingId ? { ...d, updatedAt: ts } : d,
          );

          const missingLog: ValueChangeLog = {
            id: uid('c-'),
            drawingId: target.drawingId,
            fieldName: 'materialMissing' as keyof DrawingMetrics,
            fieldLabel: `材料缺料: ${target.materialName}`,
            oldValue: 0,
            newValue: 1,
            reason: reviewHint || '标记为缺料',
            operatorId: currentUser.id,
            operatorName: currentUser.name,
            changedAt: ts,
          };

          set({
            materials: updatedMaterials,
            drawings: updatedDrawings,
            changeLogs: [...changeLogs, missingLog],
            dirtyExport: true,
          });
        } catch (e) {
          console.error('[setMaterialMissing] Unexpected error:', e);
        }
      },

      logExport: async ({ type, drawingId, fileName }) => {
        const { currentUser, exportLogs } = get();

        try {
          const res = await api.addExportLog({
            type: type,
            drawingId,
            operatorName: currentUser.name,
            fileName,
          });
          if (!res.ok || !res.data) {
            console.error('[logExport] API failed:', res.error);
            return null;
          }

          const log = res.data;
          set({ exportLogs: [log, ...exportLogs], dirtyExport: false });
          return log;
        } catch (e) {
          console.error('[logExport] Unexpected error:', e);
          return null;
        }
      },

      resetAll: () => {
        set({ ...INITIAL_STATE, dirtyExport: false });
      },

      hydrateFromApi: async () => {
        try {
          const [drawingsRes, usersRes] = await Promise.all([
            api.getDrawings(),
            api.getUsers(),
          ]);

          if (drawingsRes.ok && drawingsRes.data) {
            const plainDrawings: Drawing[] = drawingsRes.data.map((d) => {
              const { summary: _summary, ...rest } = d;
              return rest as Drawing;
            });
            set({ drawings: plainDrawings });
          }

          if (usersRes.ok && usersRes.data && usersRes.data.length > 0) {
            const { currentUser } = get();
            const stillExists = usersRes.data.find((u: User) => u.id === currentUser.id);
            if (stillExists) {
              set({ currentUser: stillExists });
            }
          }
        } catch (e) {
          console.error('[hydrateFromApi] Unexpected error:', e);
        }
      },

      mergeDrawingDetail: ({ drawing, versions, notes, materials, changeLogs }) => {
        const {
          drawings: curDrawings,
          versions: curVersions,
          notes: curNotes,
          materials: curMaterials,
          changeLogs: curChangeLogs,
        } = get();

        const drawingId = drawing.id;

        const nextDrawings = curDrawings.some((d) => d.id === drawingId)
          ? curDrawings.map((d) => (d.id === drawingId ? drawing : d))
          : [...curDrawings, drawing];

        const nextVersions = [
          ...curVersions.filter((v) => v.drawingId !== drawingId),
          ...versions,
        ];

        const nextNotes = [
          ...curNotes.filter((n) => n.drawingId !== drawingId),
          ...notes,
        ];

        const nextMaterials = [
          ...curMaterials.filter((m) => m.drawingId !== drawingId),
          ...materials,
        ];

        const existingIds = new Set(
          curChangeLogs.filter((c) => c.drawingId !== drawingId).map((c) => c.id),
        );
        const mergedChangeLogs = [
          ...curChangeLogs.filter((c) => c.drawingId !== drawingId),
          ...changeLogs.filter((c) => {
            if (existingIds.has(c.id)) return false;
            existingIds.add(c.id);
            return true;
          }),
        ];

        set({
          drawings: nextDrawings,
          versions: nextVersions,
          notes: nextNotes,
          materials: nextMaterials,
          changeLogs: mergedChangeLogs,
        });
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
