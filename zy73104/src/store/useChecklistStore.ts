import { create } from "zustand";
import type { Checklist, ChecklistStatus, Role, CreateNoteReq, RevisionDiff } from "shared/types";
import { STATUS_LABEL, ROLE_LABEL } from "shared/types";
import { initialChecklists, LAYER_NAME_REGEX } from "@/data/mockData";

type StatusFilter = "all" | ChecklistStatus;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function now(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

interface ChecklistStore {
  checklists: Checklist[];
  currentRole: Role;
  statusFilter: StatusFilter;
  loading: boolean;
  fetchChecklists: () => Promise<void>;
  fetchOne: (id: string) => Checklist | undefined;
  createChecklist: (payload: Partial<Checklist>) => Checklist;
  updateChecklist: (id: string, payload: Partial<Checklist>) => Checklist | undefined;
  changeStatus: (id: string, toStatus: ChecklistStatus, reason: string, changedBy: Role) => Checklist | undefined;
  addNote: (id: string, noteReq: CreateNoteReq) => Checklist | undefined;
  withdrawNote: (id: string, noteId: string, role: Role) => Checklist | undefined;
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
    await new Promise((r) => setTimeout(r, 200));
    set({ checklists: deepClone(initialChecklists), loading: false });
  },

  fetchOne: (id: string) => {
    return get().checklists.find((c) => c.id === id);
  },

  createChecklist: (payload: Partial<Checklist>) => {
    const newItem: Checklist = {
      id: genId("rd"),
      code: payload.code || `RD-${String(get().checklists.length + 1).padStart(3, "0")}`,
      projectName: payload.projectName || "",
      layerName: payload.layerName || "",
      isLayerNameValid: LAYER_NAME_REGEX.test(payload.layerName || ""),
      status: payload.status || "pending",
      versions: payload.versions || [{ version: "v1", isLatest: true, isValid: true, releasedAt: now(), remark: "初版" }],
      drainPoints: payload.drainPoints || [],
      bimNotes: payload.bimNotes || [],
      revisions: [],
      createdAt: now(),
      updatedAt: now(),
      handledBy: payload.handledBy || "architect",
      assignee: payload.assignee || "",
    } as Checklist;

    set({ checklists: [...get().checklists, newItem] });
    return newItem;
  },

  updateChecklist: (id: string, payload: Partial<Checklist>) => {
    const { checklists } = get();
    const idx = checklists.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    const updated = {
      ...checklists[idx],
      ...payload,
      updatedAt: now(),
    };
    if (payload.layerName !== undefined) {
      updated.isLayerNameValid = LAYER_NAME_REGEX.test(payload.layerName);
    }

    const newList = [...checklists];
    newList[idx] = updated;
    set({ checklists: newList });
    return updated;
  },

  changeStatus: (id: string, toStatus: ChecklistStatus, reason: string, changedBy: Role) => {
    const { checklists } = get();
    const idx = checklists.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    const target = deepClone(checklists[idx]);
    const fromStatus = target.status;

    const revision: RevisionDiff = {
      id: genId("rev"),
      changedAt: now(),
      changedBy,
      fromStatus,
      toStatus,
      reason,
      fieldChanges: [
        { field: "status", oldValue: STATUS_LABEL[fromStatus], newValue: STATUS_LABEL[toStatus] },
        { field: "handledBy", oldValue: ROLE_LABEL[target.handledBy], newValue: ROLE_LABEL[changedBy] },
      ],
    };

    target.status = toStatus;
    target.revisions.push(revision);
    target.handledBy = changedBy;
    target.updatedAt = now();

    const newList = [...checklists];
    newList[idx] = target;
    set({ checklists: newList });
    return target;
  },

  addNote: (id: string, noteReq: CreateNoteReq) => {
    const { checklists } = get();
    const idx = checklists.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    const target = deepClone(checklists[idx]);
    target.bimNotes.push({
      id: genId("n"),
      content: noteReq.content,
      createdAt: now(),
      createdBy: noteReq.createdBy,
      isWithdrawn: false,
      isSupplementary: noteReq.isSupplementary || false,
      versionTag: noteReq.versionTag,
    });
    target.updatedAt = now();

    const newList = [...checklists];
    newList[idx] = target;
    set({ checklists: newList });
    return target;
  },

  withdrawNote: (id: string, noteId: string, role: Role) => {
    const { checklists } = get();
    const idx = checklists.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;

    const target = deepClone(checklists[idx]);
    const noteIdx = target.bimNotes.findIndex((n) => n.id === noteId);
    if (noteIdx === -1) return undefined;

    target.bimNotes[noteIdx].isWithdrawn = true;
    target.bimNotes[noteIdx].withdrawnAt = now();
    target.bimNotes[noteIdx].withdrawnBy = role;
    target.updatedAt = now();

    const newList = [...checklists];
    newList[idx] = target;
    set({ checklists: newList });
    return target;
  },

  setRole: (r: Role) => set({ currentRole: r }),

  setFilter: (f: StatusFilter) => set({ statusFilter: f }),
}));
