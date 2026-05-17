import { Router } from "express";
import { ExportController } from "../controllers/export.controller";

const router = Router();

router.post("/", ExportController.createRequest);
router.get("/", ExportController.getRequests);
router.get("/:id", ExportController.getRequestById);
router.post("/:id/approve", ExportController.approveRequest);
router.post("/:id/reject", ExportController.rejectRequest);
router.post("/:id/verify", ExportController.verifyHashChain);
router.post("/:id/report", ExportController.generateReport);
router.get("/:id/export", ExportController.exportEvents);
router.get("/:id/history", ExportController.getProcessingHistory);
router.post("/:id/correction", ExportController.addManualCorrection);
router.post("/:id/failure", ExportController.handleFailure);

export default router;
