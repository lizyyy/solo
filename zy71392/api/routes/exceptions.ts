import express, { type Request, type Response } from 'express';
import exceptionRepository from '../repositories/exceptionRepository.js';
import activityRepository from '../repositories/activityRepository.js';
import type { ExceptionStatus } from '../types/index.js';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { script_id, status } = req.query;
    const exceptions = exceptionRepository.list(
      script_id ? parseInt(script_id as string, 10) : undefined,
      status as ExceptionStatus
    );
    res.json({ success: true, data: exceptions });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { script_id, permission_id, reason, expires_at, impact_scope, risk_note } = req.body;
    const exc = exceptionRepository.create({
      script_id,
      permission_id,
      reason,
      status: 'pending',
      expires_at,
      impact_scope,
      risk_note,
    });
    activityRepository.create('exception_create', `创建例外: ${reason.slice(0, 30)}`, { exceptionId: exc.id });
    res.json({ success: true, data: exc });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reason, expires_at, impact_scope, risk_note } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (reason) updates.reason = reason;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (impact_scope) updates.impact_scope = impact_scope;
    if (risk_note) updates.risk_note = risk_note;
    exceptionRepository.update(id, updates);
    activityRepository.create('exception_update', `更新例外 ${id}`, { exceptionId: id, status });
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    exceptionRepository.delete(id);
    activityRepository.create('exception_delete', `删除例外 ${id}`);
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/long-running', (_req: Request, res: Response) => {
  try {
    const exceptions = exceptionRepository.getLongRunningExceptions(30);
    res.json({ success: true, data: exceptions });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
