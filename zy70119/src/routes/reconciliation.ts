import express from 'express';
import reconciliationService from '../services/reconciliationService';
import { successResponse, errorResponse } from '../utils/business';

const router = express.Router();

router.post('/run', (req, res) => {
  const { storeId, channelId, autoFix, operator } = req.body;

  const result = reconciliationService.runReconciliation(
    storeId,
    channelId,
    autoFix === true,
    operator || 'API调用者'
  );
  
  res.json(result);
});

router.get('/history', (req, res) => {
  const { limit } = req.query as { limit?: string };
  const limitNum = limit ? parseInt(limit) : 50;
  
  const result = reconciliationService.getJobHistory(limitNum);
  res.json(result);
});

router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const result = reconciliationService.getJobDetail(jobId);
  res.json(result);
});

export default router;
