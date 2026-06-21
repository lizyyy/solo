import { create } from "zustand";
import type { Checklist, ChecklistStatus, Role, CreateNoteReq } from "shared/types";
import { api } from "@/utils/api";

type StatusFilter = "all" | ChecklistStatus;

interface ChecklistStore {
  checklists: Checklist[];
  currentRole: Role;
  statusFilter: StatusFilter;
  loading: boolean;
  fetchChecklists: () => Promise<void>;
  fetchOne: (id: string) => Checklist | undefined;
  createChecklist: (payload: Partial<Checklist>) => Promise<Checklist>;
  updateChecklist: (id: string, payload: Partial<Checklist>) => Promise<Checklist | undefined>;
  changeStatus: (id: string, toStatus: ChecklistStatus, reason: string, changedBy: Role) => Promise<Checklist | undefined>;
  addNote: (id: string, noteReq: CreateNoteReq) => Promise<Checklist | undefined>;
  withdrawNote: (id: string, noteId: string, role: Role) => Promise<Checklist | undefined>;
  setRole: (r: Role) => void;
  setFilter: (f: StatusFilter) => void;
}

export const useChecklistStore = create<ChecklistStore>((set, get) => ({
  checklists: [],
  currentRole: "architect",
  statusFilter: "all",
  loading: false,

  fetchChecklists: async () => {
    set({ loading: true });
    try {
      const data = await api.getChecklists();
      set({ checklists: data, loading: false });
    } catch (e) {
      console.error("fetchChecklists failed:", e);
      set({ loading: false });
    }
  },

  fetchOne: (id: string) => {
    return get().checklists.find((c) => c.id === id);
  },

  createChecklist: async (payload: Partial<Checklist>) => {
    const newItem = await api.createChecklist(payload);
    set({ checklists: [...get().checklists, newItem] });
    return newItem;
  },

  updateChecklist: async (id: string, payload: Partial<Checklist>) => {
    try {
      const updated = await api.updateChecklist(id, payload);
      const list = [...get().checklists];
      const idx = list.findIndex((c) => c.id === id);
      if (idx !== -1) {
        list[idx] = updated;
        set({ checklists: list });
      }
      return updated;
    } catch (e) {
      console.error("updateChecklist failed:", e);
      return undefined;
    }
  },

  changeStatus: async (id: string, toStatus: ChecklistStatus, reason: string, changedBy: Role) => {
    try {
      const updated = await api.changeStatus(id, toStatus, reason, changedBy);
      const list = [...get().checklists];
      const idx = list.findIndex((c) => c.id === id);
      if (idx !== -1) {
        list[idx] = updated;
        set({ checklists: list });
      }
      return updated;
    } catch (e) {
      console.error("changeStatus failed:", e);
      return undefined;
    }
  },

  addNote: async (id: string, noteReq: CreateNoteReq) => {
    try {
      const updated = await api.addNote(id, noteReq);
      const list = [...get().checklists];
      const idx = list.findIndex((c) => c.id === id);
      if (idx !== -1) {
        list[idx] = updated;
        set({ checklists: list });
      }
      return updated;
    } catch (e) {
      console.error("addNote failed:", e);
      return undefined;
    }
  },

  withdrawNote: async (id: string, noteId: string, role: Role) => {
    try {
      const updated = await api.withdrawNote(id, noteId, role);
      const list = [...get().checklists];
      const idx = list.findIndex((c) => c.id === id);
      if (idx !== -1) {
        list[idx] = updated;
        set({ checklists: list });
      }
      return updated;
    } catch (e) {
      console.error("withdrawNote failed:", e);
      return undefined;
    }
  },

  setRole: (r: Role) => set({ currentRole: r }),
  setFilter: (f: StatusFilter) => set({ statusFilter: f }),
}));
