import { create } from "zustand";
import { loadSessions, saveSessions, loadSteps, saveSteps, loadNotes, saveNotes, loadSupplements, saveSupplements, loadCustomLevelGroups, saveCustomLevelGroups, loadCustomLevels, saveCustomLevels } from "@/utils/storage";
import type { Session, SessionStep, TeacherNote, SupplementNote, ConflictItem, LevelGroup, Level } from "@/types";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface DataStore {
  sessions: Session[];
  currentViewSession: Session | null;
  currentViewSteps: SessionStep[];
  currentViewNotes: TeacherNote[];
  currentViewSupplements: SupplementNote[];
  conflicts: ConflictItem[];
  pendingImport: { sessions: Session[]; steps: Record<string, SessionStep[]>; notes: TeacherNote[]; levelGroups: LevelGroup[]; levels: Level[] } | null;

  loadAllSessions: () => void;
  viewSession: (sessionId: string) => void;
  addSupplement: (sessionId: string, content: string) => void;
  importData: (json: string) => { success: boolean; message: string };
  resolveConflict: (index: number, resolution: "keep_original" | "use_import") => void;
  applyImport: () => void;
  clearPendingImport: () => void;
  deleteSession: (sessionId: string) => void;
}

export const useDataStore = create<DataStore>((set, get) => ({
  sessions: [],
  currentViewSession: null,
  currentViewSteps: [],
  currentViewNotes: [],
  currentViewSupplements: [],
  conflicts: [],
  pendingImport: null,

  loadAllSessions: () => {
    const sessions = loadSessions();
    set({ sessions });
  },

  viewSession: (sessionId: string) => {
    const sessions = loadSessions();
    const session = sessions.find((s) => s.id === sessionId) || null;
    const steps = session ? loadSteps(sessionId) : [];
    const notes = loadNotes(sessionId);
    const supplements = loadSupplements(sessionId);
    set({ currentViewSession: session, currentViewSteps: steps, currentViewNotes: notes, currentViewSupplements: supplements });
  },

  addSupplement: (sessionId: string, content: string) => {
    const existing = loadSupplements(sessionId);
    const prevContent = existing.length > 0 ? existing[existing.length - 1].content : undefined;

    let diffType: SupplementNote["diffType"] = "added";
    if (prevContent && prevContent !== content) {
      diffType = "changed";
    }

    const note: SupplementNote = {
      id: genId(),
      sessionId,
      content,
      createdAt: Date.now(),
      diffType,
      previousContent: diffType === "changed" ? prevContent : undefined,
    };

    existing.push(note);
    saveSupplements(sessionId, existing);
    set({ currentViewSupplements: existing });
  },

  importData: (json: string) => {
    try {
      const data = JSON.parse(json);
      const importedSessions: Session[] = data.sessions || [];
      const importedSteps: Record<string, SessionStep[]> = data.steps || {};
      const importedNotes: TeacherNote[] = data.notes || [];
      const importedLevelGroups: LevelGroup[] = data.levelGroups || [];
      const importedLevels: Level[] = data.levels || [];

      const existingSessions = loadSessions();
      const conflicts: ConflictItem[] = [];

      for (const impSession of importedSessions) {
        const existing = existingSessions.find((s) => s.id === impSession.id);
        if (existing) {
          if (existing.score !== impSession.score) {
            conflicts.push({
              field: `对局 ${impSession.id} - 得分`,
              originalValue: String(existing.score),
              importValue: String(impSession.score),
              resolution: "unresolved",
            });
          }
          if (existing.endTime !== impSession.endTime) {
            conflicts.push({
              field: `对局 ${impSession.id} - 结束时间`,
              originalValue: new Date(existing.endTime || 0).toLocaleString(),
              importValue: new Date(impSession.endTime || 0).toLocaleString(),
              resolution: "unresolved",
            });
          }
        }
      }

      const existingCustomGroups = loadCustomLevelGroups();
      for (const impGroup of importedLevelGroups) {
        const existing = existingCustomGroups.find((g) => g.id === impGroup.id);
        if (existing) {
          if (existing.name !== impGroup.name) {
            conflicts.push({
              field: `关卡组 ${impGroup.id} - 名称`,
              originalValue: existing.name,
              importValue: impGroup.name,
              resolution: "unresolved",
            });
          }
        }
      }

      for (const impNote of importedNotes) {
        const existingNotes = loadNotes(impNote.sessionId);
        const conflict = existingNotes.find(
          (n) => n.source === impNote.source && n.timestamp === impNote.timestamp && n.content !== impNote.content
        );
        if (conflict) {
          conflicts.push({
            field: `备注 - ${impNote.sessionId.slice(0, 8)}`,
            originalValue: conflict.content,
            importValue: impNote.content,
            resolution: "unresolved",
          });
        }
      }

      set({
        conflicts,
        pendingImport: { sessions: importedSessions, steps: importedSteps, notes: importedNotes, levelGroups: importedLevelGroups, levels: importedLevels },
      });

      if (conflicts.length > 0) {
        return { success: true, message: `导入数据包含 ${conflicts.length} 个冲突，请逐项确认` };
      }
      return { success: true, message: "数据检查通过，可以导入" };
    } catch {
      return { success: false, message: "JSON 格式错误，请检查数据" };
    }
  },

  resolveConflict: (index: number, resolution: "keep_original" | "use_import") => {
    set((state) => {
      const newConflicts = [...state.conflicts];
      newConflicts[index] = { ...newConflicts[index], resolution };
      return { conflicts: newConflicts };
    });
  },

  applyImport: () => {
    const { pendingImport, conflicts } = get();
    if (!pendingImport) return;

    const existingSessions = loadSessions();
    const mergedSessions = [...existingSessions];

    for (const impSession of pendingImport.sessions) {
      const existIdx = mergedSessions.findIndex((s) => s.id === impSession.id);
      if (existIdx >= 0) {
        const relatedConflicts = conflicts.filter((c) => c.field.includes(impSession.id));
        const allResolved = relatedConflicts.every((c) => c.resolution !== "unresolved");
        const useImport = relatedConflicts.some((c) => c.resolution === "use_import");

        if (allResolved && useImport) {
          mergedSessions[existIdx] = impSession;
        }
      } else {
        mergedSessions.push(impSession);
      }
    }

    saveSessions(mergedSessions);

    for (const [sessionId, steps] of Object.entries(pendingImport.steps)) {
      const existingSteps = loadSteps(sessionId);
      if (existingSteps.length === 0) {
        saveSteps(sessionId, steps);
      }
    }

    for (const note of pendingImport.notes) {
      const existingNotes = loadNotes(note.sessionId);
      const conflict = conflicts.find(
        (c) => c.field.includes(note.sessionId.slice(0, 8)) && c.resolution === "use_import"
      );
      if (conflict) {
        const idx = existingNotes.findIndex(
          (n) => n.source === note.source && n.timestamp === note.timestamp
        );
        if (idx >= 0) {
          existingNotes[idx] = note;
        } else {
          existingNotes.push(note);
        }
      } else {
        const exists = existingNotes.some(
          (n) => n.source === note.source && n.timestamp === note.timestamp
        );
        if (!exists) {
          existingNotes.push(note);
        }
      }
      saveNotes(note.sessionId, existingNotes);
    }

    if (pendingImport.levelGroups.length > 0 || pendingImport.levels.length > 0) {
      const existingGroups = loadCustomLevelGroups();
      const existingLevels = loadCustomLevels();

      for (const impGroup of pendingImport.levelGroups) {
        const existIdx = existingGroups.findIndex((g) => g.id === impGroup.id);
        if (existIdx >= 0) {
          const relatedConflicts = conflicts.filter((c) => c.field.includes(impGroup.id));
          const useImport = relatedConflicts.some((c) => c.resolution === "use_import");
          const allResolved = relatedConflicts.every((c) => c.resolution !== "unresolved");
          if (allResolved && useImport) {
            existingGroups[existIdx] = impGroup;
          }
        } else {
          existingGroups.push(impGroup);
        }
      }

      for (const impLevel of pendingImport.levels) {
        const exists = existingLevels.some((l) => l.id === impLevel.id);
        if (!exists) {
          existingLevels.push(impLevel);
        }
      }

      saveCustomLevelGroups(existingGroups);
      saveCustomLevels(existingLevels);
    }

    set({ pendingImport: null, conflicts: [], sessions: mergedSessions });
  },

  clearPendingImport: () => set({ pendingImport: null, conflicts: [] }),

  deleteSession: (sessionId: string) => {
    const sessions = loadSessions().filter((s) => s.id !== sessionId);
    saveSessions(sessions);
    set({ sessions, currentViewSession: null, currentViewSteps: [], currentViewNotes: [], currentViewSupplements: [] });
  },
}));
