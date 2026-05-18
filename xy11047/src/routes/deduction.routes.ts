import express from 'express';
import { deductionService } from '../services/deduction.service';

const router = express.Router();

router.post('/', async (req, res) => {
  const result = await deductionService.createDeduction(req.body);
  res.json(result);
});

router.get('/', (req, res) => {
  const { orderId } = req.query;
  const result = deductionService.getDeductions(orderId as string);
  res.json(result);
});

router.get('/:id', (req, res) => {
  const result = deductionService.getDeduction(req.params.id);
  res.json(result);
});

router.post('/action', async (req, res) => {
  const result = await deductionService.performAction(req.body);
  res.json(result);
});

router.get('/:id/audit-logs', (req, res) => {
  const result = deductionService.getAuditLogs(req.params.id);
  res.json(result);
});

router.get('/:id/available-actions', (req, res) => {
  const { role } = req.query;
  const result = deductionService.getAvailableActions(req.params.id, role as string);
  res.json(result);
});

export default router;