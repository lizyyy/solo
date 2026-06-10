import type {
  Checklist,
  ChecklistStatus,
  ReviewStats,
  BimNote,
  RevisionDiff,
  Role,
} from "../../shared/types.js";
import { initialChecklists, LAYER_NAME_REGEX } from "./initialData.js";

let checklists: Checklist[] = JSON.parse(JSON.stringify(initialChecklists));

export function getChecklists(filter?: { status?: ChecklistStatus }): Checklist[] {
  if (filter?.status) {
    return checklists.filter((c) => c.status === filter.status);
  }
  return checklists;
}

export function getChecklist(id: string): Checklist | undefined {
  return checklists.find((c) => c.id === id);
}

function genId(prefix: string): string {
  const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${prefix}-${n}`;
}

function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function createChecklist(
  data: Partial<Omit<Checklist, "createdAt" | "updatedAt" | "revisions" | "bimNotes">> & {
    bimNotes?: BimNote[];
  }
): Checklist {
  const now = nowStr();
  const id = data.id || genId("rd");
  const code = data.code || `RD-${checklists.length + 1}`.padStart(3, "0");
  const newItem: Checklist = {
    id,
    code,
    projectName: data.projectName || "",
    layerName: data.layerName || "",
    isLayerNameValid: LAYER_NAME_REGEX.test(data.layerName || ""),
    status: data.status || "pending",
    versions: data.versions || [],
    drainPoints: data.drainPoints || [],
    bimNotes: data.bimNotes || [],
    revisions: [],
    createdAt: now,
    updatedAt: now,
    handledBy: data.handledBy || "architect",
    assignee: data.assignee || "",
  };
  checklists.push(newItem);
  return newItem;
}

export function updateChecklist(
  id: string,
  data: Partial<Omit<Checklist, "id" | "createdAt" | "revisions" | "bimNotes" | "updatedAt">>
): Checklist | undefined {
  const idx = checklists.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  const old = checklists[idx];
  checklists[idx] = {
    ...old,
    ...data,
    layerName: data.layerName !== undefined ? data.layerName : old.layerName,
    isLayerNameValid:
      data.layerName !== undefined
        ? LAYER_NAME_REGEX.test(data.layerName)
        : old.isLayerNameValid,
    updatedAt: nowStr(),
  };
  return checklists[idx];
}

export function addNote(
  checklistId: string,
  noteData: {
    content: string;
    createdBy: Role;
    isSupplementary?: boolean;
    versionTag?: string;
  }
): Checklist | undefined {
  const item = checklists.find((c) => c.id === checklistId);
  if (!item) return undefined;
  const note: BimNote = {
    id: genId("n"),
    content: noteData.content,
    createdAt: nowStr(),
    createdBy: noteData.createdBy,
    isWithdrawn: false,
    isSupplementary: noteData.isSupplementary || false,
    versionTag: noteData.versionTag,
  };
  item.bimNotes.push(note);
  item.updatedAt = nowStr();
  return item;
}

export function withdrawNote(
  checklistId: string,
  noteId: string,
  withdrawnBy: Role
): Checklist | undefined {
  const item = checklists.find((c) => c.id === checklistId);
  if (!item) return undefined;
  const note = item.bimNotes.find((n) => n.id === noteId);
  if (!note) return item;
  note.isWithdrawn = true;
  note.withdrawnAt = nowStr();
  note.withdrawnBy = withdrawnBy;
  item.updatedAt = nowStr();
  return item;
}

export function changeStatus(
  checklistId: string,
  toStatus: ChecklistStatus,
  changedBy: Role,
  reason: string,
  fieldChanges: Array<{ field: string; oldValue: string; newValue: string }>
): Checklist | undefined {
  const item = checklists.find((c) => c.id === checklistId);
  if (!item) return undefined;
  const fromStatus = item.status;
  item.status = toStatus;
  const revision: RevisionDiff = {
    id: genId("rev"),
    changedAt: nowStr(),
    changedBy,
    fromStatus,
    toStatus,
    reason: reason || "",
    fieldChanges,
  };
  item.revisions.push(revision);
  item.updatedAt = nowStr();
  return item;
}

export function reviewStats(): ReviewStats {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const total = checklists.length;
  let confirmed = 0,
    pending = 0,
    returned = 0,
    suspended = 0;
  let anomalyCount = 0;
  for (const c of checklists) {
    switch (c.status) {
      case "confirmed":
        confirmed++;
        break;
      case "pending":
        pending++;
        break;
      case "returned":
        returned++;
        break;
      case "suspended":
        suspended++;
        break;
    }
    const hasWithdrawnNote = c.bimNotes.some((n) => n.isWithdrawn);
    if (c.status === "suspended" || hasWithdrawnNote) {
      anomalyCount++;
    }
  }
  const reviewedCount = confirmed + returned;
  return {
    month,
    total,
    confirmed,
    pending,
    returned,
    suspended,
    reviewedCount,
    anomalyCount,
  };
}
