import express from 'express';
import { getDashboardStats } from '../store';

const router = express.Router();

router.get('/dashboard', (_req, res) => {
  try {
    const stats = getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

export default router;
