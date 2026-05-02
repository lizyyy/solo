import express, { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { signatureService } from '../signature';
import { dispatcherService } from '../dispatcher';
import { reportService } from '../report';
import { CreateTemplateInput, UpdateTemplateInput, CreateSimulationInput } from '../types';

export const router = Router();

router.use(express.json());

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

router.get('/templates', (req: Request, res: Response) => {
  const templates = storage.getAllTemplates();
  res.json({ data: templates });
});

router.get('/templates/:id', (req: Request, res: Response) => {
  const template = storage.getTemplate(req.params.id);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json({ data: template });
});

router.post('/templates', (req: Request, res: Response) => {
  const body = req.body as CreateTemplateInput;
  
  if (!body.name || !body.eventType || !body.payload || !body.secret || !body.idempotencyKeyPath) {
    res.status(400).json({ 
      error: 'Missing required fields: name, eventType, payload, secret, idempotencyKeyPath' 
    });
    return;
  }

  const template = storage.createTemplate(body);
  res.status(201).json({ data: template });
});

router.put('/templates/:id', (req: Request, res: Response) => {
  const body = req.body as UpdateTemplateInput;
  const template = storage.updateTemplate(req.params.id, body);
  
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  
  res.json({ data: template });
});

router.delete('/templates/:id', (req: Request, res: Response) => {
  const deleted = storage.deleteTemplate(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.status(204).send();
});

router.get('/simulations', (req: Request, res: Response) => {
  const simulations = storage.getAllSimulations();
  res.json({ data: simulations });
});

router.get('/simulations/:id', (req: Request, res: Response) => {
  const simulation = storage.getSimulation(req.params.id);
  if (!simulation) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  
  const deliveries = storage.getDeliveriesBySimulation(simulation.id);
  const deadLetters = storage.getDeadLetterItemsBySimulation(simulation.id);
  
  res.json({ 
    data: {
      simulation,
      deliveries,
      deadLetters
    }
  });
});

router.post('/simulations', async (req: Request, res: Response) => {
  const body = req.body as CreateSimulationInput;
  
  if (!body.name || !body.strategy || !body.templateIds || !body.targetUrl) {
    res.status(400).json({ 
      error: 'Missing required fields: name, strategy, templateIds, targetUrl' 
    });
    return;
  }

  if (!Array.isArray(body.templateIds) || body.templateIds.length === 0) {
    res.status(400).json({ error: 'templateIds must be a non-empty array' });
    return;
  }

  const validStrategies = ['normal', 'out_of_order', 'duplicate', 'delayed', 'signature_error', 'partial_failure'];
  if (!validStrategies.includes(body.strategy)) {
    res.status(400).json({ error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` });
    return;
  }

  for (const templateId of body.templateIds) {
    const template = storage.getTemplate(templateId);
    if (!template) {
      res.status(404).json({ error: `Template not found: ${templateId}` });
      return;
    }
  }

  const simulation = storage.createSimulation(body);
  
  res.status(201).json({ 
    data: simulation,
    message: 'Simulation started'
  });

  setImmediate(async () => {
    await dispatcherService.executeSimulation(body);
  });
});

router.get('/simulations/:id/deliveries', (req: Request, res: Response) => {
  const simulation = storage.getSimulation(req.params.id);
  if (!simulation) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  
  const deliveries = storage.getDeliveriesBySimulation(simulation.id);
  res.json({ data: deliveries });
});

router.get('/deliveries/:id', (req: Request, res: Response) => {
  const delivery = storage.getDelivery(req.params.id);
  if (!delivery) {
    res.status(404).json({ error: 'Delivery not found' });
    return;
  }
  res.json({ data: delivery });
});

router.get('/dead-letters', (req: Request, res: Response) => {
  const items = storage.getPendingDeadLetterItems();
  res.json({ data: items });
});

router.get('/dead-letters/:id', (req: Request, res: Response) => {
  const item = storage.getDeadLetterQueueItem(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Dead letter not found' });
    return;
  }
  res.json({ data: item });
});

router.post('/dead-letters/:id/replay', async (req: Request, res: Response) => {
  const result = await dispatcherService.replayDeadLetterItem(req.params.id);
  
  if (!result) {
    res.status(404).json({ error: 'Dead letter not found or already replayed' });
    return;
  }
  
  res.json({ 
    data: result,
    message: 'Dead letter replayed'
  });
});

router.post('/dead-letters/replay-all', async (req: Request, res: Response) => {
  const count = await dispatcherService.replayAllPendingDeadLetters();
  res.json({ 
    data: { replayedCount: count },
    message: `Replayed ${count} dead letters`
  });
});

router.get('/idempotency-ledger', (req: Request, res: Response) => {
  const entries = storage.getAllIdempotencyLedger();
  res.json({ data: entries });
});

router.get('/idempotency-ledger/:key', (req: Request, res: Response) => {
  const entry = storage.getIdempotencyEntry(req.params.key);
  if (!entry) {
    res.status(404).json({ error: 'Idempotency entry not found' });
    return;
  }
  res.json({ data: entry });
});

router.get('/reports/simulations/:id', (req: Request, res: Response) => {
  const report = reportService.getSimulationReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json({ data: report });
});

router.get('/reports/simulations/:id/json', (req: Request, res: Response) => {
  const report = reportService.getSimulationReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=simulation-${req.params.id}.json`);
  res.send(reportService.exportToJSON(report));
});

router.get('/reports/simulations/:id/markdown', (req: Request, res: Response) => {
  const report = reportService.getSimulationReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=simulation-${req.params.id}.md`);
  res.send(reportService.exportSimulationToMarkdown(report));
});

router.get('/reports/full', (req: Request, res: Response) => {
  const report = reportService.getFullReport();
  res.json({ data: report });
});

router.get('/reports/full/json', (req: Request, res: Response) => {
  const report = reportService.getFullReport();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=full-report.json');
  res.send(reportService.exportToJSON(report));
});

router.get('/reports/full/markdown', (req: Request, res: Response) => {
  const report = reportService.getFullReport();
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=full-report.md');
  res.send(reportService.exportFullReportToMarkdown(report));
});

router.post('/signature/test', (req: Request, res: Response) => {
  const { payload, secret } = req.body as { payload: Record<string, unknown>; secret: string };
  
  if (!payload || !secret) {
    res.status(400).json({ error: 'Missing required fields: payload, secret' });
    return;
  }

  const result = signatureService.generateSignature(payload, secret);
  
  res.json({
    data: {
      signature: result.signature,
      digest: result.digest,
      timestamp: result.timestamp,
      header: signatureService.buildSignatureHeader(result.signature, result.timestamp)
    }
  });
});

router.post('/signature/verify', (req: Request, res: Response) => {
  const { payload, signature, secret, timestamp, toleranceMs } = req.body as {
    payload: Record<string, unknown>;
    signature: string;
    secret: string;
    timestamp: number;
    toleranceMs?: number;
  };
  
  if (!payload || !signature || !secret || !timestamp) {
    res.status(400).json({ error: 'Missing required fields: payload, signature, secret, timestamp' });
    return;
  }

  const isValid = signatureService.verifySignature(
    payload,
    signature,
    secret,
    timestamp,
    toleranceMs
  );
  
  res.json({ data: { valid: isValid } });
});

router.get('/stats', (req: Request, res: Response) => {
  const templates = storage.getAllTemplates();
  const simulations = storage.getAllSimulations();
  const ledger = storage.getAllIdempotencyLedger();
  const deadLetters = storage.getPendingDeadLetterItems();

  const allDeliveries: { isSuccess: boolean }[] = [];
  for (const sim of simulations) {
    const deliveries = storage.getDeliveriesBySimulation(sim.id);
    allDeliveries.push(...deliveries);
  }

  res.json({
    data: {
      templates: templates.length,
      simulations: simulations.length,
      deliveries: {
        total: allDeliveries.length,
        successful: allDeliveries.filter(d => d.isSuccess).length,
        failed: allDeliveries.filter(d => !d.isSuccess).length,
      },
      idempotencyKeys: ledger.length,
      pendingDeadLetters: deadLetters.filter(d => !d.isReplayed).length,
    }
  });
});
