import { Router, Request, Response } from 'express';
import { BatchService } from '../services/BatchService.js';
import { ViscosityService } from '../services/ViscosityService.js';
import { CorrectionService } from '../services/CorrectionService.js';
import { ConfirmationService } from '../services/ConfirmationService.js';
import { GradingService } from '../services/GradingService.js';
import { TimelineService } from '../services/TimelineService.js';
import type {
  CreateBatchRequest,
  CreateCorrectionRequest,
  CreateConfirmationRequest,
} from '../../shared/types.js';

const router = Router();
const batchService = new BatchService();
const viscosityService = new ViscosityService();
const correctionService = new CorrectionService();
const confirmationService = new ConfirmationService();
const gradingService = new GradingService();
const timelineService = new TimelineService();

router.get('/', (_req: Request, res: Response) => {
  try {
    const batches = batchService.getAllBatches();
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const batch = batchService.getBatchById(req.params.id);
    if (!batch) {
      res.status(404).json({ error: '批次不存在' });
      return;
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const request = req.body as CreateBatchRequest;
    if (!request.materialId || !request.studentId || !request.studentName) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    const result = batchService.createBatch(request);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/timeline', (req: Request, res: Response) => {
  try {
    const events = timelineService.getFullTimeline(req.params.id);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/viscosity', (req: Request, res: Response) => {
  try {
    const history = viscosityService.getEstimateHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/viscosity', (req: Request, res: Response) => {
  try {
    const estimate = viscosityService.runEstimate(req.params.id);
    res.status(201).json(estimate);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/corrections', (req: Request, res: Response) => {
  try {
    const request = req.body as CreateCorrectionRequest;
    if (!request.content || !request.author || !request.category) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    const correction = correctionService.addCorrection(req.params.id, request);
    res.status(201).json(correction);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/confirmations', (req: Request, res: Response) => {
  try {
    const request = req.body as CreateConfirmationRequest;
    if (!request.content || !request.confirmer) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    const confirmation = confirmationService.addConfirmation(req.params.id, request);
    res.status(201).json(confirmation);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/grading', (req: Request, res: Response) => {
  try {
    const sheet = gradingService.getGradingSheet(req.params.id);
    if (!sheet) {
      res.status(404).json({ error: '批改表不存在，请先生成' });
      return;
    }
    res.json(sheet);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/grading', (req: Request, res: Response) => {
  try {
    const sheet = gradingService.generateGradingSheet(req.params.id);
    res.status(201).json(sheet);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/versions', (req: Request, res: Response) => {
  try {
    const batch = batchService.getBatchById(req.params.id);
    if (!batch) {
      res.status(404).json({ error: '批次不存在' });
      return;
    }
    const versions = batchService.getBatchVersions(batch.materialId, batch.studentId);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
