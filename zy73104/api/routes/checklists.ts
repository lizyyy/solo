import { Router, type Request, type Response } from "express";
import type { ChecklistStatus, Role, BimNote, DrawingVersion, DrainPoint } from "../../shared/types.js";
import {
  getChecklists,
  getChecklist,
  createChecklist,
  addNote,
  withdrawNote,
} from "../store/checklistStore.js";
import {
  updateChecklistWithValidation,
  changeStatusWithSnapshot,
} from "../services/checklistService.js";

type UpdateData = Partial<{
  code: string;
  projectName: string;
  layerName: string;
  status: ChecklistStatus;
  versions: DrawingVersion[];
  drainPoints: DrainPoint[];
  bimNotes: BimNote[];
  handledBy: Role;
  assignee: string;
  isLayerNameValid: boolean;
}>;

const router = Router();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query;
  const filter = status ? { status: status as ChecklistStatus } : undefined;
  const list = getChecklists(filter);
  res.json({
    success: true,
    data: list,
  });
});

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const item = getChecklist(req.params.id);
  if (!item) {
    res.status(404).json({
      success: false,
      error: "Checklist not found",
    });
    return;
  }
  res.json({
    success: true,
    data: item,
  });
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const data = req.body || {};
  const item = createChecklist(data);
  res.status(201).json({
    success: true,
    data: item,
  });
});

router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  const data = (req.body || {}) as UpdateData;
  const item = updateChecklistWithValidation(req.params.id, data);
  if (!item) {
    res.status(404).json({
      success: false,
      error: "Checklist not found",
    });
    return;
  }
  res.json({
    success: true,
    data: item,
  });
});

router.patch("/:id/status", async (req: Request, res: Response): Promise<void> => {
  const { toStatus, reason, changedBy } = req.body || {};
  if (!toStatus) {
    res.status(400).json({
      success: false,
      error: "toStatus is required",
    });
    return;
  }
  const item = changeStatusWithSnapshot(
    req.params.id,
    toStatus as ChecklistStatus,
    changedBy as Role,
    reason
  );
  if (!item) {
    res.status(404).json({
      success: false,
      error: "Checklist not found",
    });
    return;
  }
  res.json({
    success: true,
    data: item,
  });
});

router.post("/:id/notes", async (req: Request, res: Response): Promise<void> => {
  const { content, createdBy, isSupplementary, versionTag } = req.body || {};
  if (!content || !createdBy) {
    res.status(400).json({
      success: false,
      error: "content and createdBy are required",
    });
    return;
  }
  const item = addNote(req.params.id, {
    content,
    createdBy: createdBy as Role,
    isSupplementary,
    versionTag,
  });
  if (!item) {
    res.status(404).json({
      success: false,
      error: "Checklist not found",
    });
    return;
  }
  res.status(201).json({
    success: true,
    data: item,
  });
});

router.patch(
  "/:id/notes/:noteId/withdraw",
  async (req: Request, res: Response): Promise<void> => {
    const { withdrawnBy } = req.body || {};
    if (!withdrawnBy) {
      res.status(400).json({
        success: false,
        error: "withdrawnBy is required",
      });
      return;
    }
    const item = withdrawNote(
      req.params.id,
      req.params.noteId,
      withdrawnBy as Role
    );
    if (!item) {
      res.status(404).json({
        success: false,
        error: "Checklist not found",
      });
      return;
    }
    res.json({
      success: true,
      data: item,
    });
  }
);

export default router;
