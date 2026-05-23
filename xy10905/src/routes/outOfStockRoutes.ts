import { Router } from "express";
import * as controller from "../controllers/outOfStockController";

const router = Router();

router.post("/items", controller.createOutOfStockItem);
router.get("/items", controller.getOutOfStockItems);
router.get("/items/:id", controller.getOutOfStockItem);
router.post("/items/:id/allocate", controller.startAllocation);
router.put("/items/:id/manual", controller.manualUpdate);
router.post("/items/:id/complete", controller.markAsCompleted);
router.post("/items/:id/cancel", controller.cancelOutOfStockItem);

router.get("/items/:outOfStockItemId/plans", controller.getCompensationPlans);
router.put("/plans/:planId/type", controller.updateCompensationType);

router.post("/confirmations/confirm", controller.confirmCompensation);
router.post("/confirmations/reject", controller.rejectCompensation);

router.post("/settlement", controller.generateSettlementReport);
router.get("/settlement", controller.getSettlementReports);

router.get("/exceptions", controller.getExceptionLogs);
router.put("/exceptions/:id/resolve", controller.resolveExceptionLog);

export default router;
