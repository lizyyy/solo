import { Router, Request, Response } from "express";
import { db } from "../db/init";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ConflictRepository } from "../repositories/ConflictRepository";
import { AuthorizationRepository } from "../repositories/AuthorizationRepository";
import { ConflictService } from "../services/ConflictService";
import type { ResolveConflictRequest } from "@shared/types";

const router = Router();

const recordRepo = new RecordRepository(db);
const auditRepo = new AuditRepository(db);
const conflictRepo = new ConflictRepository(db);
const authRepo = new AuthorizationRepository(db);

const conflictService = new ConflictService(conflictRepo, authRepo, recordRepo, auditRepo);

router.get("/", async (req: Request, res: Response) => {
  try {
    const includeResolved = req.query.includeResolved === "true";
    const conflicts = conflictService.getUnresolvedConflicts();

    const conflictsWithRecords = conflicts.map((c) => ({
      ...c,
      record: recordRepo.findById(c.recordId),
    }));

    res.json({
      success: true,
      data: includeResolved ? conflictRepo.findAll(true) : conflictsWithRecords,
    });
  } catch (error) {
    console.error("Get conflicts error:", error);
    res.status(500).json({ error: "获取冲突列表失败", details: (error as Error).message });
  }
});

router.post("/detect-all", async (req: Request, res: Response) => {
  try {
    const conflicts = await conflictService.detectAllConflicts();
    res.json({
      success: true,
      data: {
        detectedCount: conflicts.length,
        conflicts,
      },
    });
  } catch (error) {
    console.error("Detect conflicts error:", error);
    res.status(500).json({ error: "冲突检测失败", details: (error as Error).message });
  }
});

router.post("/:id/resolve", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as ResolveConflictRequest;

    if (!body.resolution || !body.reason) {
      return res.status(400).json({ error: "处理方式和理由不能为空" });
    }

    if (body.resolution !== "confirm" && body.resolution !== "reject") {
      return res.status(400).json({ error: "处理方式必须是 confirm 或 reject" });
    }

    const resolved = conflictService.resolveConflict(id, body);

    if (!resolved) {
      return res.status(404).json({ error: "冲突记录不存在或已处理" });
    }

    res.json({
      success: true,
      data: resolved,
    });
  } catch (error) {
    console.error("Resolve conflict error:", error);
    res.status(500).json({ error: "处理冲突失败", details: (error as Error).message });
  }
});

export default router;
