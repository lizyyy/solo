import { Router, type Request, type Response } from "express";
import { generateExport } from "../services/exportService.js";
import type { SettlementFilter, SettlementStatus } from "../../shared/types.js";

const router = Router();

router.post("/", (req: Request, res: Response): void => {
  const {
    filter,
    export_scope,
    selected_ids,
    include_reconciliation_note,
  } = req.body as {
    filter?: Partial<SettlementFilter>;
    export_scope?: "filtered" | "selected";
    selected_ids?: string[];
    include_reconciliation_note?: boolean;
  };

  const fullFilter: SettlementFilter = {
    store_name: filter?.store_name,
    activity_name: filter?.activity_name,
    settlement_period_start: filter?.settlement_period_start,
    settlement_period_end: filter?.settlement_period_end,
    status: filter?.status as SettlementStatus | undefined,
    amount_min: filter?.amount_min,
    amount_max: filter?.amount_max,
    page: 1,
    page_size: 9999,
  };

  try {
    const buffer = generateExport({
      filter: fullFilter,
      export_scope: export_scope || "filtered",
      selected_ids: selected_ids || [],
      include_reconciliation_note: include_reconciliation_note || false,
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(`结算明细_${timestamp}.xlsx`)}`
    );
    res.send(buffer);
  } catch (error) {
    throw error;
  }
});

export default router;
