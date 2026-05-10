import { Router, Request, Response } from "express";
import { VaccinationService } from "../services/VaccinationService";
import { SupplementaryService } from "../services/SupplementaryService";
import { TraceabilityService } from "../services/TraceabilityService";
import { ReportService } from "../services/ReportService";

const router = Router();
const vaccinationService = new VaccinationService();
const supplementaryService = new SupplementaryService();
const traceabilityService = new TraceabilityService();
const reportService = new ReportService();

router.post("/pens", async (req: Request, res: Response) => {
  try {
    const pen = await vaccinationService.createPen(req.body);
    res.status(201).json(pen);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/plans", async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      scheduledDate: new Date(req.body.scheduledDate),
    };
    const plan = await vaccinationService.createPlan(data);
    res.status(201).json(plan);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/veterinarians", async (req: Request, res: Response) => {
  try {
    const vet = await vaccinationService.createVeterinarian(req.body);
    res.status(201).json(vet);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/batches", async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      productionDate: new Date(req.body.productionDate),
      expiryDate: new Date(req.body.expiryDate),
    };
    const batch = await vaccinationService.createBatch(data);
    res.status(201).json(batch);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/records", async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      vaccinationDate: new Date(req.body.vaccinationDate),
    };
    const record = await vaccinationService.createVaccinationRecord(data);
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/records/:id/confirm", async (req: Request, res: Response) => {
  try {
    const { veterinarianId } = req.body;
    const record = await vaccinationService.confirmRecord(req.params.id, veterinarianId);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/records/:id/reject", async (req: Request, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    const record = await vaccinationService.rejectRecord(req.params.id, rejectionReason);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/records/:id/history", async (req: Request, res: Response) => {
  try {
    const history = await vaccinationService.getRecordWithHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/plans/:id/stuck-points", async (req: Request, res: Response) => {
  try {
    const stuckPoints = await vaccinationService.getCurrentStuckPoint(req.params.id);
    if (!stuckPoints) {
      res.status(404).json({ error: "计划不存在" });
      return;
    }
    res.json(stuckPoints);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/supplementary", async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      actualVaccinationDate: new Date(req.body.actualVaccinationDate),
    };
    const supplementary = await supplementaryService.submitSupplementary(data);
    res.status(201).json(supplementary);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/supplementary/:id/approve", async (req: Request, res: Response) => {
  try {
    const { reviewedBy, reviewComments } = req.body;
    const supplementary = await supplementaryService.approveSupplementary({
      supplementaryId: req.params.id,
      reviewedBy,
      reviewComments,
    });
    res.json(supplementary);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/supplementary/:id/reject", async (req: Request, res: Response) => {
  try {
    const { reviewedBy, reviewComments } = req.body;
    const supplementary = await supplementaryService.rejectSupplementary({
      supplementaryId: req.params.id,
      reviewedBy,
      reviewComments,
    });
    res.json(supplementary);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/trace/batches/:id", async (req: Request, res: Response) => {
  try {
    const trace = await traceabilityService.traceBatch(req.params.id);
    res.json(trace);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/trace/pens/:id", async (req: Request, res: Response) => {
  try {
    const trace = await traceabilityService.tracePen(req.params.id);
    res.json(trace);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/trace/records/:id/timeline", async (req: Request, res: Response) => {
  try {
    const timeline = await traceabilityService.getRecordTimeline(req.params.id);
    res.json(timeline);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/reports", async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      reportPeriodStart: new Date(req.body.reportPeriodStart),
      reportPeriodEnd: new Date(req.body.reportPeriodEnd),
    };
    const report = await reportService.generateQuarantineReport(data);
    res.status(201).json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/reports/:id/submit", async (req: Request, res: Response) => {
  try {
    const report = await reportService.submitReport(req.params.id);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/reports/:id/approve", async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    const report = await reportService.approveReport(req.params.id, approvedBy);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/reports/:id/reject", async (req: Request, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    const report = await reportService.rejectReport(req.params.id, rejectionReason);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get("/reports/:id/status", async (req: Request, res: Response) => {
  try {
    const status = await reportService.getReportStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/batches/:id/validate", async (req: Request, res: Response) => {
  try {
    const isValid = await vaccinationService.validateBatchForQuarantine(req.params.id);
    res.json({ isValid });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
