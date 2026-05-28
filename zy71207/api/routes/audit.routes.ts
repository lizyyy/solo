import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { RateService } from '../services/rate.service';
import { RollbackService } from '../services/rollback.service';
import { ExportService } from '../services/export.service';
import { ContractRepository } from '../repositories/contract.repository';
import { AuditStatus } from '../../shared/types';

const router = Router();
const auditService = new AuditService();
const rateService = new RateService();
const rollbackService = new RollbackService();
const exportService = new ExportService();

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = auditService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/audits', (req: Request, res: Response) => {
  try {
    const { status, customerId, productId, startDate, endDate } = req.query;
    const filters = {
      status: status as AuditStatus | undefined,
      customerId: customerId as string | undefined,
      productId: productId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };
    const audits = auditService.getAllAudits(filters);
    res.json(audits);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/audits/:id', (req: Request, res: Response) => {
  try {
    const audit = auditService.getAuditById(req.params.id);
    if (!audit) {
      res.status(404).json({ error: 'Audit record not found' });
      return;
    }
    res.json(audit);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/audits/:id/chain', (req: Request, res: Response) => {
  try {
    const chain = auditService.getAuditChain(req.params.id);
    res.json(chain);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/audits', (req: Request, res: Response) => {
  try {
    const { customerId, productId, chargeId } = req.body;
    if (!customerId || !productId || !chargeId) {
      res.status(400).json({ error: 'customerId, productId, and chargeId are required' });
      return;
    }
    const audit = auditService.createAudit(customerId, productId, chargeId);
    res.status(201).json(audit);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/audits/:id/recalculate', (req: Request, res: Response) => {
  try {
    const audit = auditService.recalculateAudit(req.params.id);
    res.json(audit);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/audits/:id/rollback', (req: Request, res: Response) => {
  try {
    const audit = auditService.getAuditById(req.params.id);
    if (!audit) {
      res.status(404).json({ error: 'Audit record not found' });
      return;
    }
    const plan = rollbackService.generateRollbackPlan(audit);
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/audits/:id/resolve', (req: Request, res: Response) => {
  try {
    const audit = auditService.resolveAudit(req.params.id);
    res.json(audit);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/rate-versions', (_req: Request, res: Response) => {
  try {
    const rates = rateService.getAllRates();
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/contracts', (_req: Request, res: Response) => {
  try {
    const contractRepo = new ContractRepository();
    const contracts = contractRepo.findAll();
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/export/audit/:id', (req: Request, res: Response) => {
  try {
    const buffer = exportService.exportAuditToExcel(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${req.params.id}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/export/audits', (req: Request, res: Response) => {
  try {
    const { status, customerId, productId, startDate, endDate } = req.query;
    const filters = {
      status: status as AuditStatus | undefined,
      customerId: customerId as string | undefined,
      productId: productId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };
    const buffer = exportService.exportAuditsToExcel(undefined, filters);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="audits-export.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/rollback/:id/execute', (req: Request, res: Response) => {
  try {
    const rollback = rollbackService.executeRollback(req.params.id);
    res.json(rollback);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
