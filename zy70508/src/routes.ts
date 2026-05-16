import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { canaryStore } from './store';
import { CanaryStatus, TransitionType } from './types';
import { getAllowedTransitions, isTerminalStatus } from './stateMachine';

const router = Router();

const CreateCanarySchema = z.object({
  schemaName: z.string().min(1),
  schemaVersion: z.string().min(1),
  schemaContent: z.string().min(1),
  consumerIds: z.array(z.string()).min(1),
  canaryRatio: z.number().min(0).max(100),
  createdBy: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

const StatusTransitionSchema = z.object({
  transitionType: z.nativeEnum(TransitionType),
  reason: z.string().min(1),
  operatedBy: z.string().min(1),
  consumerId: z.string().optional()
});

const ManualCorrectionSchema = z.object({
  status: z.nativeEnum(CanaryStatus).optional(),
  canaryRatio: z.number().min(0).max(100).optional(),
  consumers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    confirmedAt: z.date().optional(),
    confirmedBy: z.string().optional()
  })).optional(),
  correctedBy: z.string().min(1),
  correctionReason: z.string().min(1)
});

const CompatibilityCheckSchema = z.object({
  previousSchema: z.string().min(1)
});

router.post('/canaries', (req: Request, res: Response) => {
  try {
    const validated = CreateCanarySchema.parse(req.body);
    const canary = canaryStore.create(validated);
    res.status(201).json({
      success: true,
      data: canary
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request',
      details: error instanceof z.ZodError ? error.errors : undefined
    });
  }
});

router.get('/canaries', (req: Request, res: Response) => {
  try {
    const filters = {
      schemaName: req.query.schemaName as string,
      status: req.query.status as CanaryStatus,
      consumerId: req.query.consumerId as string
    };
    const canaries = canaryStore.list(filters);
    res.json({
      success: true,
      data: canaries,
      total: canaries.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error'
    });
  }
});

router.get('/canaries/:id', (req: Request, res: Response) => {
  try {
    const canary = canaryStore.getById(req.params.id);
    if (!canary) {
      return res.status(404).json({
        success: false,
        error: 'Canary not found'
      });
    }
    res.json({
      success: true,
      data: canary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal error'
    });
  }
});

router.post('/canaries/:id/transitions', (req: Request, res: Response) => {
  try {
    const validated = StatusTransitionSchema.parse(req.body);
    const result = canaryStore.transitionStatus(req.params.id, validated);
    res.json({
      success: true,
      data: result,
      message: `状态已更新为: ${result.status}`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors
      });
    }
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Transition failed'
    });
  }
});

router.post('/canaries/:id/correct', (req: Request, res: Response) => {
  try {
    const validated = ManualCorrectionSchema.parse(req.body);
    const result = canaryStore.manualCorrect(req.params.id, validated);
    res.json({
      success: true,
      data: result,
      message: '人工修正已应用'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors
      });
    }
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Correction failed'
    });
  }
});

router.post('/canaries/:id/compatibility', (req: Request, res: Response) => {
  try {
    const validated = CompatibilityCheckSchema.parse(req.body);
    const issues = canaryStore.checkCompatibility(req.params.id, validated.previousSchema);
    res.json({
      success: true,
      data: {
        issues,
        isCompatible: issues.every(i => i.type !== 'breaking'),
        breakingCount: issues.filter(i => i.type === 'breaking').length,
        warningCount: issues.filter(i => i.type === 'warning').length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors
      });
    }
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Compatibility check failed'
    });
  }
});

router.get('/canaries/:id/export', (req: Request, res: Response) => {
  try {
    const exportData = canaryStore.exportForConfirmation(req.params.id);
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    });
  }
});

router.get('/meta/statuses', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      statuses: Object.values(CanaryStatus),
      transitions: Object.values(TransitionType),
      transitionsAllowed: Object.fromEntries(
        Object.values(CanaryStatus).map(s => [s, getAllowedTransitions(s)])
      ),
      terminalStatuses: Object.values(CanaryStatus).filter(isTerminalStatus)
    }
  });
});

export default router;