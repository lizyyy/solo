import express from 'express';
import * as queryService from '../services/queryService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await queryService.getDashboardSummary();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
