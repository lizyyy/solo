import { Router, type Request, type Response } from "express";
import { executeBatch } from "../services/batchService.js";
import type { BatchRequest } from "../../shared/types.js";

const router = Router();

router.post("/", (req: Request, res: Response): void => {
  const { record_ids, operation, reason } = req.body as BatchRequest;

  if (!record_ids || !Array.isArray(record_ids) || record_ids.length === 0) {
    res.status(400).json({
      success: false,
      error: "请选择要操作的记录",
    });
    return;
  }

  if (!operation || (operation !== "confirm" && operation !== "withdraw")) {
    res.status(400).json({
      success: false,
      error: "操作类型不合法",
    });
    return;
  }

  const result = executeBatch({ record_ids, operation, reason });
  res.json({ success: true, data: result });
});

export default router;
