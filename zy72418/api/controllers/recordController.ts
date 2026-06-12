import { Router, Request, Response } from "express";
import { db } from "../db/init";
import { RecordRepository } from "../repositories/RecordRepository";
import { AuditRepository } from "../repositories/AuditRepository";
import { ConflictRepository } from "../repositories/ConflictRepository";
import { RecordService } from "../services/RecordService";
import type { UpdateRecordRequest, ReviewSubstituteRequest } from "@shared/types";

const router = Router();

const recordRepo = new RecordRepository(db);
const auditRepo = new AuditRepository(db);
const conflictRepo = new ConflictRepository(db);

const recordService = new RecordService(recordRepo, auditRepo, conflictRepo);

router.get("/", (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const records = recordService.getAllRecords(status);
    const hash = recordService.getDataHash(records);

    res.json({
      success: true,
      data: records,
      dataHash: hash,
    });
  } catch (error) {
    console.error("Get records error:", error);
    res.status(500).json({ error: "获取记录列表失败", details: (error as Error).message });
  }
});

router.get("/export", (req: Request, res: Response) => {
  try {
    const csv = recordService.exportToCSV();
    const records = recordService.getRecordsForExport();
    const hash = recordService.getDataHash(records);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=audio_records_export.csv`);
    res.setHeader("X-Data-Hash", hash);
    res.send("\uFEFF" + csv);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "导出失败", details: (error as Error).message });
  }
});

router.get("/temporary-substitutes", (req: Request, res: Response) => {
  try {
    const records = recordService.getTemporarySubstitutes();
    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Get temp subs error:", error);
    res.status(500).json({ error: "获取临时替补记录失败", details: (error as Error).message });
  }
});

router.get("/unreviewed-substitutes", (req: Request, res: Response) => {
  try {
    const records = recordService.getUnreviewedSubstitutes();
    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    console.error("Get unreviewed subs error:", error);
    res.status(500).json({ error: "获取待复核记录失败", details: (error as Error).message });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = recordService.getRecordById(id);

    if (!record) {
      return res.status(404).json({ error: "记录不存在" });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Get record error:", error);
    res.status(500).json({ error: "获取记录详情失败", details: (error as Error).message });
  }
});

router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateRecordRequest;

    if (!body.operator || !body.reason) {
      return res.status(400).json({ error: "操作人和理由不能为空" });
    }

    const updated = recordService.updateRecord(id, body);

    if (!updated) {
      return res.status(404).json({ error: "记录不存在" });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update record error:", error);
    res.status(500).json({ error: "更新记录失败", details: (error as Error).message });
  }
});

router.post("/review-substitute", (req: Request, res: Response) => {
  try {
    const body = req.body as ReviewSubstituteRequest;

    if (!body.recordId || body.approved === undefined || !body.reason || !body.operator) {
      return res.status(400).json({ error: "参数不完整" });
    }

    const updated = recordService.reviewTemporarySubstitute(body);

    if (!updated) {
      return res.status(404).json({ error: "记录不存在或不是临时替补" });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Review substitute error:", error);
    res.status(500).json({ error: "复核失败", details: (error as Error).message });
  }
});

export default router;
