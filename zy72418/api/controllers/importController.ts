import { Router, Request, Response } from "express";
import { db } from "../db/init";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ConflictRepository } from "../repositories/ConflictRepository";
import { AuthorizationRepository } from "../repositories/AuthorizationRepository";
import { DuplicateService } from "../services/DuplicateService";
import { ConflictService } from "../services/ConflictService";
import { ImportService } from "../services/ImportService";

const router = Router();

const recordRepo = new RecordRepository(db);
const auditRepo = new AuditRepository(db);
const conflictRepo = new ConflictRepository(db);
const authRepo = new AuthorizationRepository(db);

const duplicateService = new DuplicateService(recordRepo);
const conflictService = new ConflictService(conflictRepo, authRepo, recordRepo, auditRepo);
const importService = new ImportService(recordRepo, auditRepo, duplicateService, conflictService);

router.post("/preview", (req: Request, res: Response) => {
  try {
    const { csvContent, fileName } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: "CSV内容不能为空" });
    }

    const records = importService.parseCSV(csvContent);
    const preview = importService.previewImport(records);

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    console.error("Import preview error:", error);
    res.status(500).json({ error: "导入预览失败", details: (error as Error).message });
  }
});

router.post("/confirm", (req: Request, res: Response) => {
  try {
    const { preview, importedBy } = req.body;

    if (!preview) {
      return res.status(400).json({ error: "预览数据不能为空" });
    }

    const records = importService.confirmImport(preview, importedBy || "阿梅");

    res.json({
      success: true,
      data: {
        records,
        count: records.length,
      },
    });
  } catch (error) {
    console.error("Import confirm error:", error);
    res.status(500).json({ error: "导入确认失败", details: (error as Error).message });
  }
});

router.get("/sample-csv", (req: Request, res: Response) => {
  try {
    const csv = importService.generateSampleCSV();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sample_audio_remarks.csv");
    res.send("\uFEFF" + csv);
  } catch (error) {
    console.error("Sample CSV error:", error);
    res.status(500).json({ error: "生成样例CSV失败" });
  }
});

export default router;
