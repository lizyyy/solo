import { Router, Request, Response } from 'express';
import { auditService } from '../services/auditService';
import { CreateAuditRequest, AuditActionRequest, AuditStatus } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const request: CreateAuditRequest = req.body;
  const result = auditService.createAudit(request);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/', (req: Request, res: Response) => {
  const result = auditService.getAllAudits();
  res.json(result);
});

router.get('/:id', (req: Request, res: Response) => {
  const result = auditService.getAuditById(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

router.post('/action', (req: Request, res: Response) => {
  const request: AuditActionRequest = req.body;
  const result = auditService.executeAction(request);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/status/:status', (req: Request, res: Response) => {
  const status = req.params.status as AuditStatus;
  const result = auditService.getAuditsByStatus(status);
  res.json(result);
});

router.get('/:id/consistency', (req: Request, res: Response) => {
  const result = auditService.checkConsistency(req.params.id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

router.get('/violations/wind-warning', (req: Request, res: Response) => {
  const result = auditService.getWindWarningViolations();
  res.json(result);
});

export default router;
