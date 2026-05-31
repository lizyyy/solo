import { Router, type Request, type Response } from "express";
import {
  listSettlements,
  getSettlementById,
  confirmSettlements,
  withdrawSettlements,
  getDashboardStats,
} from "../services/settlementService.js";
import type { SettlementFilter, SettlementStatus } from "../../shared/types.js";

const router = Router();

router.get("/", (req: Request, res: Response): void => {
  const filter: SettlementFilter = {
    store_name: req.query.store_name as string | undefined,
    activity_name: req.query.activity_name as string | undefined,
    settlement_period_start: req.query.settlement_period_start as string | undefined,
    settlement_period_end: req.query.settlement_period_end as string | undefined,
    status: req.query.status as SettlementStatus | undefined,
    amount_min: req.query.amount_min ? Number(req.query.amount_min) : undefined,
    amount_max: req.query.amount_max ? Number(req.query.amount_max) : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    page_size: req.query.page_size ? Number(req.query.page_size) : 20,
  };

  const result = listSettlements(filter);
  res.json({ success: true, data: result });
});

router.get("/stats", (_req: Request, res: Response): void => {
  const stats = getDashboardStats();
  res.json({ success: true, data: stats });
});

router.get("/:id", (req: Request, res: Response): void => {
  const record = getSettlementById(req.params.id);
  res.json({ success: true, data: record });
});

router.put("/:id/confirm", (req: Request, res: Response): void => {
  const id = req.params.id;
  const result = confirmSettlements([id]);
  if (result.success === 0) {
    res.status(400).json({
      success: false,
      error: "只有待确认状态的记录才能确认",
    });
    return;
  }
  res.json({ success: true, data: { id, status: "confirmed" } });
});

router.put("/:id/withdraw", (req: Request, res: Response): void => {
  const id = req.params.id;
  const { reason } = req.body;
  if (!reason || reason.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: "撤回原因不能为空",
    });
    return;
  }
  const result = withdrawSettlements([id], reason);
  if (result.success === 0) {
    res.status(400).json({
      success: false,
      error: "只有已确认状态的记录才能撤回",
    });
    return;
  }
  res.json({ success: true, data: { id, status: "withdrawn" } });
});

export default router;
