import { Router, Request, Response } from "express";
import { db } from "../db/init";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ConflictRepository } from "../repositories/ConflictRepository";
import { AuthorizationRepository } from "../repositories/AuthorizationRepository";
import { RecordService } from "../services/RecordService";
import { SelfCheckService } from "../services/SelfCheckService";

const router = Router();

const recordRepo = new RecordRepository(db);
const auditRepo = new AuditRepository(db);
const conflictRepo = new ConflictRepository(db);
const authRepo = new AuthorizationRepository(db);

const recordService = new RecordService(recordRepo, auditRepo, conflictRepo);
const selfCheckService = new SelfCheckService(recordRepo, conflictRepo, auditRepo, recordService);

router.get("/", (req: Request, res: Response) => {
  try {
    const report = selfCheckService.runSelfCheck();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Self check error:", error);
    res.status(500).json({ error: "自检失败", details: (error as Error).message });
  }
});

router.get("/run", (req: Request, res: Response) => {
  try {
    const report = selfCheckService.runSelfCheck();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Self check error:", error);
    res.status(500).json({ error: "自检失败", details: (error as Error).message });
  }
});

export default router;
