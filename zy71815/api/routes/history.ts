import { Router, type Request, type Response } from "express";
import db from "../db.js";
import type { OperationLog } from "../../shared/types.js";

const router = Router();

router.get("/", (req: Request, res: Response): void => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const record_id = req.query.record_id as string | undefined;
  const operation_type = req.query.operation_type as string | undefined;
  const date_start = req.query.date_start as string | undefined;
  const date_end = req.query.date_end as string | undefined;

  if (record_id) {
    conditions.push("record_id = ?");
    params.push(record_id);
  }
  if (operation_type) {
    conditions.push("operation_type = ?");
    params.push(operation_type);
  }
  if (date_start) {
    conditions.push("created_at >= ?");
    params.push(date_start);
  }
  if (date_end) {
    conditions.push("created_at <= ?");
    params.push(date_end);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const logs = db
    .prepare(`SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT 100`)
    .all(...params) as OperationLog[];

  res.json({ success: true, data: logs });
});

router.get("/record/:recordId", (req: Request, res: Response): void => {
  const { recordId } = req.params;
  const logs = db
    .prepare("SELECT * FROM operation_logs WHERE record_id = ? ORDER BY created_at DESC")
    .all(recordId) as OperationLog[];

  res.json({ success: true, data: logs });
});

export default router;
