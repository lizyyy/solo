import { Router, Request, Response } from 'express';
import { windowService } from '../services/windowService';
import { CreateWindowRequest, UpdateWindowStatusRequest, WindowStatus } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const request: CreateWindowRequest = req.body;
    const window = windowService.createWindow(request);
    res.status(201).json(window);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  const { databaseName, status } = req.query;
  const windows = windowService.getWindows({
    databaseName: databaseName as string,
    status: status as WindowStatus
  });
  res.json(windows);
});

router.get('/:id', (req: Request, res: Response) => {
  const window = windowService.getWindow(req.params.id);
  if (!window) {
    return res.status(404).json({ error: 'Window not found' });
  }
  res.json(window);
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const request: UpdateWindowStatusRequest = req.body;
    const window = windowService.updateWindowStatus(req.params.id, request);
    if (!window) {
      return res.status(400).json({ error: 'Failed to update status' });
    }
    res.json(window);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/block', (req: Request, res: Response) => {
  try {
    const { serviceName, operation, sqlStatement, blockedBy } = req.body;
    const blocked = windowService.blockWrite(req.params.id, serviceName, operation, sqlStatement, blockedBy);
    if (!blocked) {
      return res.status(400).json({ error: 'Failed to block write' });
    }
    res.status(201).json(blocked);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/blocked', (req: Request, res: Response) => {
  const blocked = windowService.getBlockedWrites(req.params.id);
  res.json(blocked);
});

router.post('/:id/recovery-conditions/:conditionType/satisfy', (req: Request, res: Response) => {
  try {
    const { verifiedBy } = req.body;
    const success = windowService.satisfyRecoveryCondition(
      req.params.id,
      req.params.conditionType,
      verifiedBy
    );
    if (!success) {
      return res.status(400).json({ error: 'Failed to satisfy condition' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/services', (req: Request, res: Response) => {
  try {
    const { serviceName, serviceOwner, writeOperations, estimatedImpact, addedBy } = req.body;
    const service = windowService.addAffectedService(
      req.params.id,
      { serviceName, serviceOwner, writeOperations, estimatedImpact },
      addedBy
    );
    if (!service) {
      return res.status(404).json({ error: 'Window not found' });
    }
    res.status(201).json(service);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/services/:serviceId', (req: Request, res: Response) => {
  try {
    const { removedBy } = req.body;
    const success = windowService.removeAffectedService(
      req.params.id,
      req.params.serviceId,
      removedBy
    );
    if (!success) {
      return res.status(404).json({ error: 'Window or service not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/report', (req: Request, res: Response) => {
  try {
    const { exportedBy } = req.body;
    const report = windowService.generateReport(req.params.id, exportedBy);
    if (!report) {
      return res.status(404).json({ error: 'Window not found' });
    }
    res.json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/reports', (req: Request, res: Response) => {
  const reports = windowService.getReports(req.params.id);
  res.json(reports);
});

router.get('/:id/exceptions', (req: Request, res: Response) => {
  const exceptions = windowService.getExceptions(req.params.id);
  res.json(exceptions);
});

router.patch('/exceptions/:id/handle', (req: Request, res: Response) => {
  try {
    const { handledBy, handlingNote } = req.body;
    const success = windowService.handleException(req.params.id, handledBy, handlingNote);
    if (!success) {
      return res.status(404).json({ error: 'Exception not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/corrections', (req: Request, res: Response) => {
  const corrections = windowService.getCorrections(req.params.id);
  res.json(corrections);
});

router.post('/:id/manual-correct', (req: Request, res: Response) => {
  try {
    const { correctionType, oldValue, newValue, correctedBy, reason } = req.body;
    const success = windowService.manualCorrect(
      req.params.id,
      correctionType,
      oldValue,
      newValue,
      correctedBy,
      reason
    );
    if (!success) {
      return res.status(404).json({ error: 'Window not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export const windowsRouter = router;
