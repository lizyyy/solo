import { Router, Request, Response } from "express";
import { db } from "../db/init";
import { AuditRepository } from "../repositories/AuditRepository";

const router = Router();

const auditRepo = new AuditRepository(db);

router.get("/", (req: Request, res: Response) => {
  try {
    const recordId = req.query.recordId as string;
    const logs = auditRepo.findAll(recordId);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: "获取审计日志失败", details: (error as Error).message });
  }
});

router.get("/:recordId", (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const logs = auditRepo.findAll(recordId);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Get record audit logs error:", error);
    res.status(500).json({ error: "获取记录审计日志失败", details: (error as Error).message });
  }
});

export default router;
