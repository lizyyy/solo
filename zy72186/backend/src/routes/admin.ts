import { Router } from 'express';
import { db } from '../data/database';

const router = Router();

router.post('/reset', (_req, res) => {
  db.resetDatabase();
  
  res.json({
    success: true,
    message: 'Database has been reset to initial state',
  });
});

router.get('/health', (_req, res) => {
  const samples = db.getSamples();
  
  res.json({
    success: true,
    data: {
      status: 'healthy',
      sampleCount: samples.length,
      reviewCount: samples.reduce((acc, s) => acc + s.reviewHistory.length, 0),
    },
  });
});

export default router;
