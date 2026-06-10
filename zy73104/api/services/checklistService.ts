import type {
  Checklist,
  ChecklistStatus,
  Role,
} from "../../shared/types.js";
import { STATUS_LABEL, ROLE_LABEL } from "../../shared/types.js";
import { LAYER_NAME_REGEX } from "../store/initialData.js";
import {
  getChecklist,
  changeStatus as storeChangeStatus,
  updateChecklist,
} from "../store/checklistStore.js";
import { validateLayerName } from "./validateService.js";
import type { BimNote, DrawingVersion, DrainPoint } from "../../shared/types.js";

export { LAYER_NAME_REGEX };

type UpdateChecklistData = Partial<Omit<Checklist, "id" | "createdAt" | "revisions" | "bimNotes" | "updatedAt" | "isLayerNameValid">> & {
  versions?: DrawingVersion[];
  drainPoints?: DrainPoint[];
  bimNotes?: BimNote[];
  isLayerNameValid?: boolean;
};

export function buildFieldChangesSnapshot(
  oldItem: Checklist,
  toStatus: ChecklistStatus,
  changedBy: Role,
  reason?: string
): Array<{ field: string; oldValue: string; newValue: string }> {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
  const statusLabel = STATUS_LABEL;
  const roleLabel = ROLE_LABEL;

  changes.push({
    field: "status",
    oldValue: statusLabel[oldItem.status],
    newValue: statusLabel[toStatus],
  });

  const newHandledBy: Role = toStatus === "returned" || toStatus === "pending"
    ? "architect"
    : toStatus === "suspended"
      ? "operations"
      : oldItem.handledBy;

  if (newHandledBy !== oldItem.handledBy) {
    changes.push({
      field: "handledBy",
      oldValue: roleLabel[oldItem.handledBy],
      newValue: `${roleLabel[newHandledBy]}（${reason || "状态变更"}）`,
    });
  }

  return changes;
}

export function updateChecklistWithValidation(
  id: string,
  data: UpdateChecklistData
): Checklist | undefined {
  const current = getChecklist(id);
  if (!current) return undefined;

  const merged: UpdateChecklistData = { ...data };
  if (data.layerName !== undefined) {
    const validation = validateLayerName(data.layerName);
    merged.isLayerNameValid = validation.valid;
  }
  return updateChecklist(id, merged);
}

export function changeStatusWithSnapshot(
  checklistId: string,
  toStatus: ChecklistStatus,
  changedBy: Role,
  reason?: string
): Checklist | undefined {
  const current = getChecklist(checklistId);
  if (!current) return undefined;
  if (current.status === toStatus) return current;

  const fieldChanges = buildFieldChangesSnapshot(
    current,
    toStatus,
    changedBy,
    reason
  );
  return storeChangeStatus(
    checklistId,
    toStatus,
    changedBy,
    reason || "",
    fieldChanges
  );
}

